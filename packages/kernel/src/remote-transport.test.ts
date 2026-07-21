import { LoopbackTransportHub, LoopbackTransportProvider } from "@karya/transport-service";
import { describe, expect, it } from "vitest";
import { createKaryaCore } from "./factory";

describe("remote transport integration", () => {
  it("moves an immutable operation between trusted logical replicas and replays it once", async () => {
    const hub = new LoopbackTransportHub();
    const replicaA = createKaryaCore({
      seed: { includeDemoContent: false },
      transport: { provider: new LoopbackTransportProvider(hub) },
      account: { device: { name: "Replica A" } },
    });
    const replicaB = createKaryaCore({
      seed: { includeDemoContent: false },
      transport: { provider: new LoopbackTransportProvider(hub) },
      account: { device: { name: "Replica B" } },
    });
    await Promise.all([replicaA.boot(), replicaB.boot()]);

    const [deviceA, deviceB] = await Promise.all([replicaA.shell.currentDevice(), replicaB.shell.currentDevice()]);
    if (!deviceA || !deviceB) throw new Error("Replica devices were not initialized");
    await replicaA.registry.resolve("accountService").registerDevice({ ...deviceB, trustState: "trusted" });
    await replicaB.registry.resolve("accountService").registerDevice({ ...deviceA, trustState: "trusted" });

    const resource = await replicaA.shell.createNote(undefined, "Transported note", "Local-first body");
    expect(
      (await replicaA.shell.pendingSyncOperations()).map(({ entityType, entityId }) => [entityType, entityId]),
    ).toContainEqual(["resource", resource.id]);
    await replicaA.shell.connectTransport();
    await replicaA.shell.synchronizeTransport();
    await replicaB.shell.connectTransport();
    await replicaB.shell.synchronizeTransport();
    await replicaB.shell.synchronizeTransport();

    expect((await replicaB.registry.resolve("synchronizationService").status()).lastReplayAt).toBeDefined();
    expect((await replicaB.registry.resolve("resourceService").getResource(resource.id))?.metadata.title).toBe(
      "Transported note",
    );
    expect((await replicaA.shell.getTransportStatus()).queueSize).toBe(0);

    await Promise.all([replicaA.shutdown(), replicaB.shutdown()]);
  });
});
