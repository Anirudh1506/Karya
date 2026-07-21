import { describe, expect, it } from "vitest";
import { ReferenceKspAdapterFactory } from "./reference-adapter";
import { KspReplicaSimulator } from "./replica-simulator";

describe("KSP deterministic replay", () => {
  it("produces identical outcomes, receipts, cursors, and acknowledgements for 50,000 operations", async () => {
    const first = await replayScenario(50_000);
    const second = await replayScenario(50_000);

    expect(second.digest).toBe(first.digest);
    expect(second.receipts).toEqual(first.receipts);
    expect(second.replayOrder).toEqual(first.replayOrder);
    expect(second.cursor).toBe(first.cursor);
    expect(second.acknowledged).toEqual(first.acknowledged);
  }, 120_000);

  it("suppresses duplicate delivery and resumes after lost acknowledgements and partial replay", async () => {
    const adapter = new ReferenceKspAdapterFactory().create();
    const source = new KspReplicaSimulator(adapter, "device:deterministic-source", { batchSize: 128 });
    for (let index = 0; index < 500; index += 1) source.createOperation(`operation:${index}`);
    adapter.injectFault("lost-upload-response");
    await source.synchronizeWithRetry(2, { maximumWindows: 0 });

    let target = new KspReplicaSimulator(adapter, "device:deterministic-target", { batchSize: 128 });
    await expect(target.synchronize({ interruptReplayAfter: 73 })).rejects.toMatchObject({
      code: "transport-failure",
    });
    target = target.restart();
    await target.synchronize();
    const beforeDuplicate = target.digest();
    adapter.injectFault("duplicate-download");
    await target.synchronize();

    expect(target.digest()).toBe(beforeDuplicate);
    expect(target.state.receipts.size).toBe(500);
    expect(new Set(target.state.replayOrder).size).toBe(500);
  });
});

async function replayScenario(operationCount: number) {
  const adapter = new ReferenceKspAdapterFactory().create();
  const source = new KspReplicaSimulator(adapter, "device:replay-source", { batchSize: 128 });
  for (let index = 0; index < operationCount; index += 1) source.createOperation(`payload:${index}`);
  await source.synchronize({ maximumWindows: 0 });
  const target = new KspReplicaSimulator(adapter, "device:replay-target", { batchSize: 128 });
  await target.bootstrap();
  return {
    digest: target.digest(),
    receipts: [...target.state.receipts].sort(),
    replayOrder: target.state.replayOrder,
    cursor: target.state.cursor,
    acknowledged: [...source.state.accepted].sort(),
  };
}
