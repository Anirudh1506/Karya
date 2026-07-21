import { describe, expect, it, vi } from "vitest";
import * as SQLite from "expo-sqlite";
import { ExpoSqliteStore, type ExpoSqliteDatabase } from "./expo-sqlite-store";
import { createSeedData } from "@karya/core";

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: vi.fn(),
}));

function createDatabase(): ExpoSqliteDatabase {
  return {
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn().mockResolvedValue(undefined),
    getFirstAsync: vi.fn().mockResolvedValue(null),
    getAllAsync: vi.fn().mockResolvedValue([]),
    withTransactionAsync: vi.fn(async (operation: () => Promise<void>) => operation()),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ExpoSqliteStore lifecycle", () => {
  it("opens an isolated native connection so Fast Refresh cannot reuse a released handle", async () => {
    const database = createDatabase();
    vi.mocked(SQLite.openDatabaseAsync).mockResolvedValue(database as never);
    const store = new ExpoSqliteStore("isolated.db");

    await Promise.all([store.initialize(), store.initialize()]);

    expect(SQLite.openDatabaseAsync).toHaveBeenCalledOnce();
    expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith("isolated.db", { useNewConnection: true });
    await store.close();
  });

  it("opens, migrates, transacts, and closes idempotently", async () => {
    const database = createDatabase();
    const opener = vi.fn().mockResolvedValue(database);
    const store = new ExpoSqliteStore("smoke.db", opener);

    await store.initialize();
    await store.initialize();
    const value = await store.unitOfWork.transaction(async () => "committed");
    await store.close();
    await store.close();

    expect(value).toBe("committed");
    expect(opener).toHaveBeenCalledOnce();
    expect(opener).toHaveBeenCalledWith("smoke.db");
    expect(database.execAsync).toHaveBeenCalledTimes(2);
    expect(database.withTransactionAsync).toHaveBeenCalledOnce();
    expect(database.closeAsync).toHaveBeenCalledOnce();
  });

  it("serializes concurrent native statements on Android", async () => {
    let activeStatements = 0;
    let maximumActiveStatements = 0;
    const database = createDatabase();
    database.runAsync = vi.fn(async () => {
      activeStatements += 1;
      maximumActiveStatements = Math.max(maximumActiveStatements, activeStatements);
      if (activeStatements > 1) throw new Error("Native statement overlap");
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeStatements -= 1;
    });
    const store = new ExpoSqliteStore("serialized.db", vi.fn().mockResolvedValue(database));
    await store.initialize();

    await Promise.all([
      store.save("profiles", "profile-1", { id: "profile-1" }),
      store.save("workspaces", "workspace-1", { id: "workspace-1" }),
      store.save("sessions", "session-1", { id: "session-1" }),
    ]);

    expect(maximumActiveStatements).toBe(1);
    expect(database.runAsync).toHaveBeenCalledTimes(3);
    await store.close();
  });

  it("persists profiles and the active session across a database restart", async () => {
    const rows = new Map<string, { id: string; payload: string }>();
    const opener = vi.fn(async () => createPersistentDatabase(rows));
    const first = new ExpoSqliteStore("profiles.db", opener);
    const seed = createSeedData({ includeDemoContent: false });
    await first.initialize();
    await first.seedIfEmpty(seed);
    const profile = { ...seed.profiles[0], id: "profile-mobile", name: "Mobile" };
    await first.profiles.save(profile);
    await first.sessions.saveCurrent({ ...seed.session, activeProfileId: profile.id });
    await first.close();

    const second = new ExpoSqliteStore("profiles.db", opener);
    await second.initialize();

    expect((await second.profiles.get(profile.id))?.name).toBe("Mobile");
    expect((await second.sessions.getCurrent())?.activeProfileId).toBe(profile.id);
    await second.close();
  });

  it("repairs missing constitutional defaults without replacing user records", async () => {
    const rows = new Map<string, { id: string; payload: string }>();
    const opener = vi.fn(async () => createPersistentDatabase(rows));
    const seed = createSeedData({ includeDemoContent: false });
    const store = new ExpoSqliteStore("constitutional-defaults.db", opener);
    await store.initialize();
    await store.profiles.save({
      id: "profile-user-created",
      name: "Research",
      spaceIds: [],
      createdAt: "2026-07-17T00:00:00.000Z",
    });
    await store.sessions.saveCurrent({
      ...seed.session,
      activeProfileId: "profile:none",
      activeWorkspaceId: undefined,
    });

    await store.seedIfEmpty(seed);

    expect((await store.profiles.list()).map((profile) => profile.id).sort()).toEqual([
      "profile-primary",
      "profile-user-created",
    ]);
    expect((await store.workspaces.list()).map((workspace) => workspace.id).sort()).toEqual([
      "workspace-default-space",
      "workspace-desktop-home-default-space",
    ]);
    expect(await store.resources.list()).toEqual([]);
    expect(await store.sessions.getCurrent()).toEqual(seed.session);
    await store.close();
  });

  it("persists append-only Activity history across a database restart", async () => {
    const rows = new Map<string, { id: string; payload: string }>();
    const opener = vi.fn(async () => createPersistentDatabase(rows));
    const first = new ExpoSqliteStore("activities.db", opener);
    const occurredAt = "2026-07-12T10:00:00.000Z";
    const activity = {
      id: "activity:mobile",
      eventType: "ResourceCreated",
      category: "resource" as const,
      verb: "created" as const,
      title: "Created Mobile note",
      object: { id: "resource-mobile", type: "resource" as const, title: "Mobile note" },
      relatedObjects: [],
      profileId: "profile-mobile",
      workspaceId: "workspace-mobile",
      actor: { id: "profile-mobile", type: "local-user" as const },
      source: "resources",
      groupKey: "resource:created:resource-mobile",
      groupCount: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      occurredAt,
    };
    await first.initialize();
    await first.activities.append(activity);
    await first.close();

    const second = new ExpoSqliteStore("activities.db", opener);
    await second.initialize();
    expect(await second.activities.list()).toEqual([activity]);
    await second.close();
  });

  it("persists Workspace ownership, appearance, archive state, and ordering", async () => {
    const rows = new Map<string, { id: string; payload: string }>();
    const opener = vi.fn(async () => createPersistentDatabase(rows));
    const first = new ExpoSqliteStore("workspaces.db", opener);
    const seed = createSeedData({ includeDemoContent: false });
    await first.initialize();
    await first.seedIfEmpty(seed);
    const workspace = {
      ...seed.workspaces[0],
      id: "workspace-mobile",
      profileId: seed.profiles[0].id,
      lifecycleState: "archived" as const,
      metadata: { ...seed.workspaces[0].metadata, name: "Research", color: "#7C3AED", icon: "R" },
    };
    await first.workspaces.save(workspace);
    await first.sessions.saveCurrent({ ...seed.session, activeWorkspaceId: workspace.id });
    await first.close();

    const second = new ExpoSqliteStore("workspaces.db", opener);
    await second.initialize();
    const restored = await second.workspaces.get(workspace.id);
    expect(restored).toMatchObject({ id: workspace.id, profileId: seed.profiles[0].id, lifecycleState: "archived" });
    expect(restored?.metadata).toMatchObject({ color: "#7C3AED", icon: "R" });
    expect((await second.workspaces.list()).map((item) => item.id)).toContain(workspace.id);
    expect((await second.sessions.getCurrent())?.activeWorkspaceId).toBe(workspace.id);
    await second.close();
  });

  it("persists Resource identity, metadata, placement, and archive state", async () => {
    const rows = new Map<string, { id: string; payload: string }>();
    const opener = vi.fn(async () => createPersistentDatabase(rows));
    const first = new ExpoSqliteStore("resources.db", opener);
    const seed = createSeedData({ includeDemoContent: false });
    await first.initialize();
    await first.seedIfEmpty(seed);
    const now = "2026-07-11T12:00:00.000Z";
    const resource = {
      id: "7a21edb9-b74c-4a73-994d-bb450a0a9f69",
      type: "text/markdown",
      owner: seed.profiles[0].id,
      profileId: seed.profiles[0].id,
      workspaceRefs: [seed.workspaces[1].id],
      primaryWorkspaceId: seed.workspaces[1].id,
      defaultSpace: "profile" as const,
      tags: ["note"],
      relationships: [],
      metadata: {
        title: "Persistent note",
        description: "Metadata",
        kind: "note",
        createdAt: now,
        updatedAt: now,
        attributes: {},
      },
      status: "archived" as const,
      lifecycleState: "archived" as const,
      createdAt: now,
      updatedAt: now,
    };
    await first.resources.save(resource);
    await first.close();
    const second = new ExpoSqliteStore("resources.db", opener);
    await second.initialize();
    expect(await second.resources.get(resource.id)).toMatchObject({
      id: resource.id,
      primaryWorkspaceId: seed.workspaces[1].id,
      lifecycleState: "archived",
      metadata: { title: "Persistent note", description: "Metadata" },
    });
    await second.close();
  });
});

function createPersistentDatabase(rows: Map<string, { id: string; payload: string }>): ExpoSqliteDatabase {
  return {
    execAsync: vi.fn().mockResolvedValue(undefined),
    runAsync: vi.fn(async (source: string, ...params: unknown[]) => {
      if (source.includes("INSERT OR IGNORE INTO karya_activities")) {
        const [id, , , , , , payload] = params as string[];
        if (!rows.has(`activity:${id}`)) rows.set(`activity:${id}`, { id, payload });
      } else if (source.startsWith("INSERT INTO karya_entities")) {
        const [kind, id, payload] = params as string[];
        rows.set(`${kind}:${id}`, { id, payload });
      } else if (source.includes("WHERE kind = ? AND id = ?")) {
        rows.delete(`${params[0]}:${params[1]}`);
      } else if (source.includes("WHERE kind = ?")) {
        const prefix = `${params[0]}:`;
        for (const key of rows.keys()) if (key.startsWith(prefix)) rows.delete(key);
      }
    }),
    async getFirstAsync<TResult>(_source: string, ...params: unknown[]): Promise<TResult | null> {
      if (_source.includes("karya_activities")) {
        return (rows.get(`activity:${params[0]}`) as TResult | undefined) ?? null;
      }
      return (rows.get(`${params[0]}:${params[1]}`) as TResult | undefined) ?? null;
    },
    async getAllAsync<TResult>(_source: string, ...params: unknown[]): Promise<TResult[]> {
      if (_source.includes("karya_activities")) {
        return [...rows.entries()]
          .filter(([key]) => key.startsWith("activity:"))
          .map(([, row]) => ({ payload: row.payload }) as TResult);
      }
      const prefix = `${params[0]}:`;
      return [...rows.entries()].filter(([key]) => key.startsWith(prefix)).map(([, row]) => row as TResult);
    },
    withTransactionAsync: vi.fn(async (operation: () => Promise<void>) => operation()),
    closeAsync: vi.fn().mockResolvedValue(undefined),
  };
}
