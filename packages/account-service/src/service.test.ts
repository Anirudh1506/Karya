import { InMemoryEventBus } from "@karya/event-bus";
import { InMemoryRepository } from "@karya/persistence";
import type { KaryaAccount, SyncDeviceState, TrustedDevice } from "@karya/types";
import { describe, expect, it, vi } from "vitest";
import { DefaultAccountEngine } from "./service";

describe("Karya Account Engine", () => {
  it("creates an Account, registers the installation identity, and restores it", async () => {
    const fixture = createFixture();
    await fixture.engine.start();
    const account = await fixture.engine.create("Personal Karya", "owner@example.com");
    const device = await fixture.engine.currentDevice();
    expect(account.profileIds).toEqual(["profile-1"]);
    expect(device).toMatchObject({ id: "device-local", accountId: account.id, trustState: "trusted" });
    expect(await fixture.engine.authorizeSynchronization("device-local")).toBe(true);
    await fixture.engine.stop();

    const restarted = fixture.createEngine();
    await restarted.start();
    expect((await restarted.current())?.id).toBe(account.id);
    expect((await restarted.currentDevice())?.id).toBe(device?.id);
  });

  it("owns device lifecycle, stable metadata export, and replica membership", async () => {
    const fixture = createFixture();
    await fixture.engine.start();
    await fixture.engine.create("Karya");
    await fixture.engine.registerDevice({
      id: "device-remote",
      name: "iPhone",
      platform: "ios",
      trustState: "untrusted",
      syncCapabilities: { operations: true, content: true, background: false },
    });
    expect(await fixture.engine.authorizeSynchronization("device-remote")).toBe(false);
    await fixture.engine.changeTrust("device-remote", "trusted");
    await fixture.engine.renameDevice("device-remote", "Travel iPhone");
    expect(await fixture.engine.authorizeSynchronization("device-remote")).toBe(true);
    expect(await fixture.engine.replicaMembership()).toHaveLength(2);
    const exported = await fixture.engine.exportMetadata();
    expect(exported).toMatchObject({ format: "karya-account-metadata", formatVersion: 1 });
    await fixture.engine.unregisterDevice("device-remote");
    expect(await fixture.engine.device("device-remote")).toBeUndefined();
  });

  it("publishes Activity-source events and keeps Account ID immutable", async () => {
    const fixture = createFixture();
    const created = vi.fn();
    const updated = vi.fn();
    fixture.bus.subscribe("AccountCreated", created);
    fixture.bus.subscribe("AccountUpdated", updated);
    await fixture.engine.start();
    const original = await fixture.engine.create("Karya");
    const renamed = await fixture.engine.rename("Karya Home");
    expect(renamed.id).toBe(original.id);
    expect(renamed.version).toBeGreaterThan(original.version);
    expect(created).toHaveBeenCalledOnce();
    expect(updated).toHaveBeenCalledOnce();
  });
});

function createFixture() {
  const bus = new InMemoryEventBus();
  const accounts = new InMemoryRepository<KaryaAccount>();
  const devices = new InMemoryRepository<TrustedDevice>();
  const deviceStates = new InMemoryRepository<SyncDeviceState>([
    { id: "local-device", deviceId: "device-local", nextSequence: 1 },
  ]);
  const createEngine = () =>
    new DefaultAccountEngine(
      bus,
      { accounts, devices, deviceStates },
      { name: "Mac", platform: "macos", platformVersion: "26" },
      async () => ["profile-1"],
    );
  return { bus, createEngine, engine: createEngine() };
}
