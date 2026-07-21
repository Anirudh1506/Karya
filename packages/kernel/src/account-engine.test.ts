import { InMemoryRepository } from "@karya/persistence";
import type { KaryaAccount, SyncDeviceState, TrustedDevice } from "@karya/types";
import { describe, expect, it } from "vitest";
import { createKaryaCore } from "./factory";

describe("Karya Account Engine integration", () => {
  it("generates installation identity, owns Profiles, and restores Account state", async () => {
    const accounts = new InMemoryRepository<KaryaAccount>();
    const devices = new InMemoryRepository<TrustedDevice>();
    const states = new InMemoryRepository<SyncDeviceState>();
    const persistence = { accounts, trustedDevices: devices, syncDeviceStates: states };
    const first = createKaryaCore({
      seed: { includeDemoContent: false },
      persistence,
      account: { displayName: "Anirudh's Karya", device: { name: "iPhone", platform: "ios" } },
    });
    await first.boot();
    const account = await first.shell.currentAccount();
    const device = await first.shell.currentDevice();
    expect(account).toMatchObject({ displayName: "Anirudh's Karya", status: "active" });
    expect(account?.profileIds).toContain("profile-primary");
    expect(device).toMatchObject({ name: "iPhone", trustState: "trusted" });
    expect((await first.shell.replicaMembership())[0]).toMatchObject({ authorized: true });
    await first.shutdown();

    const second = createKaryaCore({ seed: { includeDemoContent: false }, persistence });
    await second.boot();
    expect((await second.shell.currentAccount())?.id).toBe(account?.id);
    expect((await second.shell.currentDevice())?.id).toBe(device?.id);
    await second.shutdown();
  });

  it("records Account Activity and authorizes only trusted replica members", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const accountService = core.registry.resolve("accountService");
    await accountService.registerDevice({
      id: "remote-device",
      name: "Remote",
      platform: "android",
      trustState: "untrusted",
      syncCapabilities: { operations: true, content: true, background: true },
    });
    const operation = {
      id: "remote-operation",
      deviceId: "remote-device",
      sequence: 1,
      timestamp: new Date().toISOString(),
      entityType: "profile" as const,
      entityId: "profile-primary",
      operationType: "ProfileUpdated",
      payload: JSON.stringify(core.shell.getSnapshotSync().profiles.active),
      dependencies: [],
      acknowledgementState: "pending" as const,
    };
    await expect(core.shell.replaySyncOperations([operation])).rejects.toThrow("not authorized");
    await accountService.changeTrust("remote-device", "trusted");
    await core.shell.replaySyncOperations([operation]);
    expect((await core.shell.activitiesByEventType("DeviceRegistered", 10)).map(({ object }) => object.id)).toContain(
      "remote-device",
    );
    expect(await core.shell.activitiesByEventType("DeviceTrustChanged", 10)).toHaveLength(1);
    await core.shutdown();
  });
});
