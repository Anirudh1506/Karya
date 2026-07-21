import { createKaryaCore, type KaryaCore, type KaryaKernelOptions } from "@karya/core";
import type { PlatformProviders } from "@karya/platform";
import { ExpoSqliteStore } from "../persistence/expo-sqlite-store";
import { ExpoPlatformProviders } from "../platform/expo-platform-providers";
import { Platform } from "react-native";

export type MobileCompositionState =
  "created" | "starting" | "running" | "suspended" | "stopping" | "stopped" | "failed";

export type MobilePersistence = ExpoSqliteStore;

export interface MobileCompositionRootOptions {
  platform?: PlatformProviders;
  persistence?: MobilePersistence;
  coreFactory?: (options: KaryaKernelOptions) => KaryaCore;
}

export interface MobileCompositionRoot {
  start(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  shutdown(): Promise<void>;
  getState(): MobileCompositionState;
  getCore(): KaryaCore | undefined;
}

export function createMobileCompositionRoot(options: MobileCompositionRootOptions = {}): MobileCompositionRoot {
  const platform = options.platform ?? new ExpoPlatformProviders();
  const persistence = options.persistence ?? new ExpoSqliteStore();
  const coreFactory = options.coreFactory ?? createKaryaCore;
  let core: KaryaCore | undefined;
  let state: MobileCompositionState = "created";
  let queue = Promise.resolve();

  const startCore = async () => {
    if (state === "running" || state === "suspended") return;
    if (state === "stopped") throw new Error("Mobile composition root cannot restart after shutdown");
    state = "starting";
    try {
      await persistence.initialize();
      core = coreFactory({
        platform,
        account: {
          device: {
            name: `${Platform.OS === "ios" ? "iPhone" : "Android"} device`,
            platform: Platform.OS === "web" ? "unknown" : Platform.OS,
            platformVersion: String(Platform.Version),
          },
        },
        seed: { includeDemoContent: false },
        persistence: {
          accounts: persistence.accounts,
          trustedDevices: persistence.trustedDevices,
          transportSessions: persistence.transportSessions,
          activities: persistence.activities,
          notifications: persistence.notifications,
          editableContents: persistence.editableContents,
          editCheckpoints: persistence.editCheckpoints,
          editSessions: persistence.editSessions,
          syncOperations: persistence.syncOperations,
          syncDeviceStates: persistence.syncDeviceStates,
          syncReplayReceipts: persistence.syncReplayReceipts,
          syncConflicts: persistence.syncConflicts,
          applications: persistence.applications,
          profiles: persistence.profiles,
          resourceQueries: persistence.resourceQueries,
          resources: persistence.aggregateResources,
          searchQueries: persistence.searchQueries,
          search: persistence.search,
          sessions: persistence.sessions,
          settings: persistence.settings,
          workspaces: persistence.aggregateWorkspaces,
          workspaceQueries: persistence.workspaceQueries,
          unitOfWork: persistence.unitOfWork,
          initialize: () => persistence.initialize(),
          seedIfEmpty: (seed) => persistence.seedIfEmpty(seed),
          close: () => persistence.close(),
        },
      });
      await core.boot();
      state = "running";
    } catch (error) {
      state = "failed";
      await persistence.close();
      throw error;
    }
  };

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  };

  return {
    start() {
      return enqueue(startCore);
    },

    suspend() {
      return enqueue(async () => {
        if (state !== "running" || !core) return;
        await core.suspend();
        state = "suspended";
      });
    },

    resume() {
      return enqueue(async () => {
        if (state === "created") {
          await startCore();
          return;
        }
        if (state !== "suspended" || !core) return;
        await core.resume();
        state = "running";
      });
    },

    shutdown() {
      return enqueue(async () => {
        if (state === "stopped" || state === "stopping") return;
        state = "stopping";
        if (core) {
          await core.shutdown();
        } else {
          await persistence.close();
        }
        state = "stopped";
      });
    },

    getState() {
      return state;
    },

    getCore() {
      return core;
    },
  };
}
