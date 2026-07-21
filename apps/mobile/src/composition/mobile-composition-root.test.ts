import { describe, expect, it, vi } from "vitest";
import type { KaryaCore } from "@karya/core";
import type { PlatformProviders } from "@karya/platform";
import { NoopPlatformProviders } from "@karya/platform";
import type { MobilePersistence } from "./mobile-composition-root";

vi.mock("../persistence/expo-sqlite-store", () => ({ ExpoSqliteStore: class {} }));
vi.mock("../platform/expo-platform-providers", () => ({ ExpoPlatformProviders: class {} }));
vi.mock("react-native", () => ({ Platform: { OS: "ios", Version: "test" } }));

import { createMobileCompositionRoot } from "./mobile-composition-root";

describe("Mobile composition root", () => {
  it("owns ordered startup, lifecycle, and shutdown", async () => {
    const calls: string[] = [];
    const persistence = {
      initialize: vi.fn(async () => {
        calls.push("sqlite:open");
      }),
      close: vi.fn(async () => {
        calls.push("sqlite:close");
      }),
      seedIfEmpty: vi.fn(),
    } as unknown as MobilePersistence;
    const core = {
      boot: vi.fn(async () => calls.push("core:boot")),
      suspend: vi.fn(async () => calls.push("core:suspend")),
      resume: vi.fn(async () => calls.push("core:resume")),
      shutdown: vi.fn(async () => {
        calls.push("core:shutdown");
        await persistence.close();
      }),
    } as unknown as KaryaCore;
    const coreFactory = vi.fn(() => {
      calls.push("core:compose");
      return core;
    });

    const root = createMobileCompositionRoot({
      platform: new NoopPlatformProviders() as PlatformProviders,
      persistence,
      coreFactory,
    });

    await root.start();
    await root.start();
    await root.suspend();
    await root.suspend();
    await root.resume();
    await root.resume();
    await root.shutdown();
    await root.shutdown();

    expect(calls).toEqual([
      "sqlite:open",
      "core:compose",
      "core:boot",
      "core:suspend",
      "core:resume",
      "core:shutdown",
      "sqlite:close",
    ]);
    expect(root.getState()).toBe("stopped");
    expect(coreFactory).toHaveBeenCalledOnce();
  });
});
