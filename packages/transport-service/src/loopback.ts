import type {
  EntityId,
  SyncOperation,
  TransportAcknowledgement,
  TransportBatch,
  TransportDownload,
  TransportSessionContext,
} from "@karya/types";
import type { TransportProvider } from "./contracts";

export class LoopbackTransportHub {
  private readonly operations = new Map<EntityId, SyncOperation>();
  private readonly order: EntityId[] = [];

  append(batch: TransportBatch): readonly EntityId[] {
    for (const operation of batch.operations) {
      if (this.operations.has(operation.id)) continue;
      this.operations.set(operation.id, operation);
      this.order.push(operation.id);
    }
    return batch.operations.map(({ id }) => id);
  }

  read(replicaId: EntityId, cursor?: string): TransportDownload {
    const offset = parseCursor(cursor);
    const operations = this.order
      .slice(offset)
      .map((id) => this.operations.get(id))
      .filter((operation): operation is SyncOperation => Boolean(operation))
      .filter((operation) => operation.deviceId !== replicaId);
    return {
      batches: operations.length
        ? [{ id: `loopback:${offset}:${this.order.length}`, replicaId: "loopback", operations }]
        : [],
      cursor: String(this.order.length),
    };
  }
}

export class LoopbackTransportProvider implements TransportProvider {
  readonly id = "loopback";
  private context?: TransportSessionContext;
  private connected = false;
  private uploadFailures = 0;
  private acknowledgementLimit?: number;

  constructor(private readonly hub = new LoopbackTransportHub()) {}

  async connect(context: TransportSessionContext): Promise<void> {
    this.context = context;
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async upload(batch: TransportBatch): Promise<TransportAcknowledgement> {
    this.assertConnected();
    if (this.uploadFailures > 0) {
      this.uploadFailures -= 1;
      throw new Error("Loopback transport upload failed");
    }
    const accepted = this.hub.append(batch);
    return {
      batchId: batch.id,
      operationIds: accepted.slice(0, this.acknowledgementLimit ?? accepted.length),
    };
  }

  async download(cursor?: string): Promise<TransportDownload> {
    this.assertConnected();
    return this.hub.read(this.context?.replicaId ?? "unknown", cursor);
  }

  async acknowledge(_acknowledgement: TransportAcknowledgement): Promise<void> {
    this.assertConnected();
  }

  simulateUploadFailures(count: number): void {
    this.uploadFailures = Math.max(0, count);
  }

  simulatePartialAcknowledgement(limit?: number): void {
    this.acknowledgementLimit = limit;
  }

  simulateOffline(): void {
    this.connected = false;
  }

  private assertConnected(): void {
    if (!this.connected) throw new Error("Loopback transport is offline");
  }
}

function parseCursor(cursor?: string): number {
  const value = Number.parseInt(cursor ?? "0", 10);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
