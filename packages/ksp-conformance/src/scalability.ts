import type { KspConformanceAdapterFactory, KspMetrics } from "./contracts";
import { KspReplicaSimulator } from "./replica-simulator";

export interface KspScalabilityOptions {
  replicas?: number;
  operations?: number;
  receipts?: number;
  longRunningCycles?: number;
}

export interface KspScalabilityFinding {
  replicas: number;
  operations: number;
  receipts: number;
  longRunningCycles: number;
  replayedOperations: number;
  uniqueReceipts: number;
  deterministic: boolean;
  historyComplete: boolean;
  durationMs: number;
  metrics: Readonly<KspMetrics>;
}

export async function validateKspScalability(
  factory: KspConformanceAdapterFactory,
  options: KspScalabilityOptions = {},
): Promise<KspScalabilityFinding> {
  const replicaCount = options.replicas ?? 100;
  const operationCount = options.operations ?? 100_000;
  const receiptCount = options.receipts ?? 1_000_000;
  const longRunningCycles = options.longRunningCycles ?? 1_000;
  const startedAt = performance.now();
  const adapter = factory.create("loopback");
  const base = Math.floor(operationCount / replicaCount);
  let remainder = operationCount % replicaCount;

  for (let replicaIndex = 0; replicaIndex < replicaCount; replicaIndex += 1) {
    const replica = new KspReplicaSimulator(adapter, `device:scale:${replicaIndex}`, { batchSize: 128 });
    const count = base + (remainder-- > 0 ? 1 : 0);
    for (let operationIndex = 0; operationIndex < count; operationIndex += 1) {
      replica.createOperation(`scale:${replicaIndex}:${operationIndex}`);
    }
    await replica.synchronize({ maximumWindows: 0 });
  }

  let bootstrap = new KspReplicaSimulator(adapter, "device:scale:bootstrap", { batchSize: 128 });
  await bootstrap.bootstrap({ maximumWindows: 5 });
  bootstrap = bootstrap.restart();
  await bootstrap.bootstrap();

  const firstReplay = bootstrap.state.replayOrder;
  const replayedOperations = bootstrap.state.receipts.size;
  const deterministic = firstReplay.length === new Set(firstReplay).size;
  const historyComplete = replayedOperations === operationCount && bootstrap.state.ready;

  const ledger = new CompactReceiptLedger(receiptCount);
  for (let receipt = 0; receipt < receiptCount; receipt += 1) ledger.add(receipt);
  for (let receipt = 0; receipt < receiptCount; receipt += 2) ledger.add(receipt);

  for (let cycle = 0; cycle < longRunningCycles; cycle += 1) await bootstrap.heartbeat();

  return {
    replicas: replicaCount,
    operations: operationCount,
    receipts: receiptCount,
    longRunningCycles,
    replayedOperations,
    uniqueReceipts: ledger.size,
    deterministic,
    historyComplete,
    durationMs: performance.now() - startedAt,
    metrics: adapter.metrics(),
  };
}

export class CompactReceiptLedger {
  private readonly values: Uint8Array;
  private count = 0;

  constructor(readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 0) throw new Error("Receipt capacity must be non-negative");
    this.values = new Uint8Array(Math.ceil(capacity / 8));
  }

  get size(): number {
    return this.count;
  }

  add(index: number): boolean {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) {
      throw new Error(`Receipt index is outside the ledger: ${index}`);
    }
    const byte = Math.floor(index / 8);
    const mask = 1 << (index % 8);
    if ((this.values[byte] & mask) !== 0) return false;
    this.values[byte] |= mask;
    this.count += 1;
    return true;
  }

  has(index: number): boolean {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.capacity) return false;
    return (this.values[Math.floor(index / 8)] & (1 << (index % 8))) !== 0;
  }
}
