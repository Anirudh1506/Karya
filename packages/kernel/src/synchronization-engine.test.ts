import { describe, expect, it } from "vitest";
import { createKaryaCore } from "./factory";

describe("Synchronization Engine integration", () => {
  it("logs Core changes without networking and exposes queue status", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const before = await core.shell.getSyncStatus();
    const resource = await core.shell.createNote(undefined, "Replicated note");
    const operations = await core.shell.pendingSyncOperations();
    expect(
      operations.some(
        (operation) => operation.entityId === resource.id && operation.operationType === "ResourceCreated",
      ),
    ).toBe(true);
    expect((await core.shell.getSyncStatus()).deviceId).toBe(before.deviceId);
    expect((await core.shell.getSyncStatus()).queueSize).toBeGreaterThan(0);
    await core.shutdown();
  });

  it("acknowledges queued operations while retaining immutable identity", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    await core.shell.createProfile("Replicated profile");
    const [pending] = await core.shell.pendingSyncOperations();
    await core.shell.acknowledgeSyncOperations([pending.id]);
    const acknowledged = await core.shell.acknowledgedSyncOperations();
    expect(acknowledged.find((operation) => operation.id === pending.id)?.payload).toBe(pending.payload);
    await core.shutdown();
  });
});
