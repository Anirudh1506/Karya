import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@karya/event-bus";
import type { ProfileRepository, SessionRepository } from "@karya/persistence";
import type { ContinuitySession, Profile } from "@karya/types";
import { createKaryaCore } from "./factory";
import { createSeedData } from "./seed-data";
import { InMemoryWorkspaceRepository } from "@karya/workspace-service";
import { InMemoryResourceRepository } from "@karya/resource-service";

describe("Karya Core lifecycle", () => {
  it("boots, suspends, resumes, and shuts down exactly once", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    const eventBus = core.registry.resolve("eventBus") as InMemoryEventBus;

    await core.boot();
    await core.boot();
    expect(core.getLifecycleState()).toBe("running");
    expect(eventBus.isStarted()).toBe(true);

    await core.suspend();
    await core.suspend();
    expect(core.getLifecycleState()).toBe("suspended");
    expect(eventBus.isStarted()).toBe(false);

    await core.resume();
    await core.resume();
    expect(core.getLifecycleState()).toBe("running");
    expect(eventBus.isStarted()).toBe(true);

    await core.shutdown();
    await core.shutdown();
    expect(core.getLifecycleState()).toBe("stopped");
    expect(eventBus.isStarted()).toBe(false);
  });

  it("restores the persisted active profile before the initial snapshot is hydrated", async () => {
    const seed = createSeedData({ includeDemoContent: false });
    const persistedProfile: Profile = {
      ...seed.profiles[0],
      id: "profile-persisted",
      name: "Persisted profile",
      defaultSpaceId: "space:persisted",
      spaceIds: ["space:persisted"],
    };
    const profiles = memoryRepository([seed.profiles[0], persistedProfile]);
    const currentSession = { ...seed.session, activeProfileId: persistedProfile.id };
    const sessions = sessionRepository(currentSession);
    const core = createKaryaCore({
      seed: { includeDemoContent: false },
      persistence: { profiles, sessions },
    });
    const changed: string[] = [];
    core.registry.resolve("eventBus").subscribe("ActiveProfileChanged", ({ profileId }) => {
      changed.push(profileId);
    });

    await core.boot();

    expect(core.shell.getSnapshotSync().profiles.active?.id).toBe(persistedProfile.id);
    expect(core.shell.getSnapshotSync().user.id).toBe(persistedProfile.id);
    expect(changed).toEqual([persistedProfile.id]);
    await core.shutdown();
  });

  it("creates, switches, archives, and restores profiles through Core with events", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    const eventBus = core.registry.resolve("eventBus");
    const events: string[] = [];
    eventBus.subscribe("ProfileCreated", () => {
      events.push("created");
    });
    eventBus.subscribe("ActiveProfileChanged", () => {
      events.push("active-changed");
    });
    eventBus.subscribe("ProfileArchived", () => {
      events.push("archived");
    });
    eventBus.subscribe("ProfileRestored", () => {
      events.push("restored");
    });
    await core.boot();

    const created = await core.shell.createProfile("Studio", { icon: "S", accentColor: "#2563EB" });
    await core.shell.switchProfile(created.id);
    expect(core.shell.getSnapshotSync().profiles.active?.id).toBe(created.id);

    await core.shell.archiveProfile(created.id);
    expect(core.shell.getSnapshotSync().profiles.archived.map((profile) => profile.id)).toContain(created.id);
    expect(core.shell.getSnapshotSync().profiles.active?.id).not.toBe(created.id);

    await core.shell.restoreProfile(created.id);
    expect(core.shell.getSnapshotSync().profiles.archived.map((profile) => profile.id)).not.toContain(created.id);
    expect(events).toEqual(expect.arrayContaining(["created", "active-changed", "archived", "restored"]));
    await core.shutdown();
  });

  it("owns Workspace activation, archive, restoration, context, and events inside Core", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    const events: string[] = [];
    const eventBus = core.registry.resolve("eventBus");
    eventBus.subscribe("WorkspaceCreated", () => {
      events.push("created");
    });
    eventBus.subscribe("WorkspaceRenamed", () => {
      events.push("renamed");
    });
    eventBus.subscribe("WorkspaceClosed", () => {
      events.push("closed");
    });
    eventBus.subscribe("ActiveWorkspaceChanged", ({ workspaceId }) => {
      events.push(`active:${workspaceId ?? "none"}`);
    });
    eventBus.subscribe("WorkspaceArchived", () => {
      events.push("archived");
    });
    eventBus.subscribe("WorkspaceRestored", () => {
      events.push("restored");
    });
    await core.boot();

    const workspace = await core.shell.createWorkspace("Research", "Papers", undefined, {
      color: "#7C3AED",
      icon: "R",
    });
    let snapshot = core.shell.getSnapshotSync();
    expect(workspace.metadata).toMatchObject({ description: "Papers", color: "#7C3AED", icon: "R" });
    expect(snapshot.workspaces.active?.id).toBe(workspace.id);
    expect(snapshot.continuity.currentSession?.activeWorkspaceId).toBe(workspace.id);
    expect(snapshot.shell.activeSurface).toEqual({ type: "workspace", workspaceId: workspace.id });

    await core.shell.renameWorkspace(workspace.id, "Research Lab");
    expect(core.shell.getSnapshotSync().workspaces.active?.name).toBe("Research Lab");
    await core.shell.closeWorkspace(workspace.id);
    expect(core.shell.getSnapshotSync().continuity.currentSession?.activeWorkspaceId).toBeUndefined();
    await core.shell.openWorkspace(workspace.id);

    await core.shell.archiveWorkspace(workspace.id);
    snapshot = core.shell.getSnapshotSync();
    expect(snapshot.workspaces.archived.map((item) => item.id)).toContain(workspace.id);
    expect(snapshot.continuity.currentSession?.activeWorkspaceId).toBeUndefined();

    await core.shell.restoreWorkspace(workspace.id);
    snapshot = core.shell.getSnapshotSync();
    expect(snapshot.workspaces.active?.id).toBe(workspace.id);
    expect(snapshot.continuity.currentSession?.activeWorkspaceId).toBe(workspace.id);
    expect(events).toEqual(
      expect.arrayContaining([
        "created",
        "renamed",
        "closed",
        `active:${workspace.id}`,
        "archived",
        "active:none",
        "restored",
      ]),
    );
    await core.shutdown();
  });

  it("restores the same Profile and Workspace context after a Core restart", async () => {
    const seed = createSeedData({ includeDemoContent: false });
    const workspaces = new InMemoryWorkspaceRepository(seed.workspaces);
    const sessions = sessionRepository(seed.session);
    const first = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { workspaces, sessions } });
    await first.boot();
    const workspace = await first.shell.createWorkspace("Persistent workspace");
    await first.shutdown();

    const second = createKaryaCore({ seed: { includeDemoContent: false }, persistence: { workspaces, sessions } });
    await second.boot();

    expect(second.shell.getSnapshotSync().profiles.active?.id).toBe(seed.profiles[0].id);
    expect(second.shell.getSnapshotSync().workspaces.active?.id).toBe(workspace.id);
    expect((await second.registry.resolve("workspaceService").getActiveWorkspace())?.id).toBe(workspace.id);
    expect(second.shell.getSnapshotSync().continuity.currentSession?.activeWorkspaceId).toBe(workspace.id);
    await second.shutdown();
  });

  it("rejects activation of a Workspace owned by another Profile", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const secondProfile = await core.shell.createProfile("Second");
    expect(
      core.shell.getSnapshotSync().workspaces.all.some((workspace) => workspace.profileId === secondProfile.id),
    ).toBe(false);
    const foreignWorkspace = await core.shell.createWorkspace("Second workspace");
    await core.shell.switchProfile("profile-primary");

    await expect(core.shell.openWorkspace(foreignWorkspace.id)).rejects.toThrow(
      "does not belong to the active profile",
    );
    expect(core.shell.getSnapshotSync().profiles.active?.id).not.toBe(secondProfile.id);
    await core.shutdown();
  });

  it("opens the platform-owned Desktop Default Space without changing the active Profile", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();

    const workspace = await core.shell.openWorkspace("workspace-desktop-home-default-space");

    expect(workspace.id).toBe("workspace-desktop-home-default-space");
    expect(core.shell.getSnapshotSync().workspaces.active?.id).toBe(workspace.id);
    expect(core.shell.getSnapshotSync().profiles.active?.id).toBe("profile-primary");
    expect(core.shell.getSnapshotSync().shell.activeSurface).toEqual({
      type: "workspace",
      workspaceId: workspace.id,
    });
    await core.shutdown();
  });

  it("restores the most recent Workspace independently for each Profile", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const primaryWorkspace = await core.shell.createWorkspace("Primary context");
    const secondProfile = await core.shell.createProfile("Second");
    const secondWorkspace = await core.shell.createWorkspace("Second context");

    await core.shell.switchProfile("profile-primary");
    expect(core.shell.getSnapshotSync().profiles.active?.id).toBe("profile-primary");
    expect(core.shell.getSnapshotSync().workspaces.active?.id).toBe(primaryWorkspace.id);

    await core.shell.switchProfile(secondProfile.id);
    expect(core.shell.getSnapshotSync().profiles.active?.id).toBe(secondProfile.id);
    expect(core.shell.getSnapshotSync().workspaces.active?.id).toBe(secondWorkspace.id);
    await core.shutdown();
  });

  it("owns the complete Resource lifecycle, identity, metadata, placement, and events", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    const events: string[] = [];
    const eventBus = core.registry.resolve("eventBus");
    eventBus.subscribe("ResourceCreated", () => {
      events.push("created");
    });
    eventBus.subscribe("ResourceOpened", () => {
      events.push("opened");
    });
    eventBus.subscribe("ResourceRenamed", () => {
      events.push("renamed");
    });
    eventBus.subscribe("MetadataUpdated", () => {
      events.push("metadata");
    });
    eventBus.subscribe("ResourceMoved", () => {
      events.push("moved");
    });
    eventBus.subscribe("ResourceArchived", () => {
      events.push("archived");
    });
    eventBus.subscribe("ResourceRestored", () => {
      events.push("restored");
    });
    await core.boot();
    const sourceWorkspace = core.shell.getSnapshotSync().workspaces.active!;

    const resource = await core.shell.createNote(undefined, "Research note", "");
    const stableId = resource.id;
    expect(resource).toMatchObject({
      id: stableId,
      profileId: sourceWorkspace.profileId,
      primaryWorkspaceId: sourceWorkspace.id,
      workspaceRefs: [sourceWorkspace.id],
      lifecycleState: "active",
    });
    expect(stableId).toMatch(/^[0-9a-f-]{36}$/i);
    await core.shell.openResource(stableId);
    await core.shell.renameResource(stableId, "Renamed note");
    await core.shell.updateResourceMetadata(stableId, { description: "Metadata only" });

    const targetWorkspace = await core.shell.createWorkspace("Reference workspace");
    await core.shell.openWorkspace(sourceWorkspace.id);
    expect(core.shell.getSnapshotSync().workspaces.active?.id).toBe(sourceWorkspace.id);
    const moved = await core.shell.moveResource(stableId, { workspaceId: targetWorkspace.id });
    expect(moved).toMatchObject({
      id: stableId,
      profileId: sourceWorkspace.profileId,
      primaryWorkspaceId: targetWorkspace.id,
      workspaceRefs: [targetWorkspace.id],
    });
    expect(core.shell.getSnapshotSync().resources.active?.id).toBeUndefined();
    await core.shell.openWorkspace(targetWorkspace.id);
    await core.shell.archiveResource(stableId);
    expect(core.shell.getSnapshotSync().resources.archivedResources.map((item) => item.id)).toContain(stableId);
    const restored = await core.shell.restoreResource(stableId);
    expect(restored.id).toBe(stableId);
    expect(restored.metadata).toMatchObject({ title: "Renamed note", description: "Metadata only" });
    expect(events).toEqual(
      expect.arrayContaining(["created", "opened", "renamed", "metadata", "moved", "archived", "restored"]),
    );
    await core.shutdown();
  });

  it("rejects Resource operations outside the active Workspace and moves through explicit Profile destinations", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const resource = await core.shell.createNote(undefined, "Owned note", "");
    const sourceWorkspace = core.shell.getSnapshotSync().workspaces.active!;
    const secondProfile = await core.shell.createProfile("Foreign Profile");
    const foreignWorkspace = await core.shell.createWorkspace("Foreign workspace");

    await expect(core.shell.renameResource(resource.id, "Foreign rename")).rejects.toThrow("active Workspace");
    await core.registry.resolve("workspaceService").activateWorkspace(sourceWorkspace.id);
    expect((await core.registry.resolve("profileService").getActiveProfile())?.id).toBe(secondProfile.id);
    expect((await core.registry.resolve("workspaceService").getActiveWorkspace())?.id).toBe(sourceWorkspace.id);
    const movedToForeignProfile = await core.shell.moveResource(resource.id, {
      profileId: secondProfile.id,
      workspaceId: foreignWorkspace.id,
    });
    expect(movedToForeignProfile).toMatchObject({
      profileId: secondProfile.id,
      primaryWorkspaceId: foreignWorkspace.id,
      workspaceRefs: [foreignWorkspace.id],
    });
    expect(core.shell.getSnapshotSync().profiles.active?.id).not.toBe(secondProfile.id);

    await core.shell.switchProfile(secondProfile.id);
    const movedToDesktop = await core.shell.moveResource(resource.id, {
      workspaceId: "workspace-desktop-home-default-space",
      defaultSpace: "user",
    });
    expect(movedToDesktop).toMatchObject({
      profileId: "desktop-user",
      primaryWorkspaceId: "workspace-desktop-home-default-space",
      defaultSpace: "user",
    });

    await core.shell.openWorkspace("workspace-desktop-home-default-space");
    const movedBackToProfile = await core.shell.moveResource(resource.id, {
      profileId: "profile-primary",
      workspaceId: sourceWorkspace.id,
    });
    expect(movedBackToProfile).toMatchObject({
      profileId: "profile-primary",
      primaryWorkspaceId: sourceWorkspace.id,
      defaultSpace: "profile",
    });
    await core.shutdown();
  });

  it("restores Resources with stable identity after a complete Core restart", async () => {
    const seed = createSeedData({ includeDemoContent: false });
    const workspaces = new InMemoryWorkspaceRepository(seed.workspaces);
    const resources = new InMemoryResourceRepository();
    const sessions = sessionRepository(seed.session);
    const first = createKaryaCore({
      seed: { includeDemoContent: false },
      persistence: { workspaces, resources, sessions },
    });
    await first.boot();
    const created = await first.shell.createNote(undefined, "Persistent Resource", "");
    await first.shell.archiveResource(created.id);
    await first.shutdown();

    const second = createKaryaCore({
      seed: { includeDemoContent: false },
      persistence: { workspaces, resources, sessions },
    });
    await second.boot();
    const restored = second.shell.getSnapshotSync().resources.all.find((resource) => resource.id === created.id);
    expect(restored).toMatchObject({
      id: created.id,
      lifecycleState: "archived",
      primaryWorkspaceId: created.primaryWorkspaceId,
    });
    expect(second.shell.getSnapshotSync().profiles.active?.id).toBe(seed.profiles[0].id);
    expect(second.shell.getSnapshotSync().workspaces.active?.id).toBe(created.primaryWorkspaceId);
    await second.shutdown();
  });

  it("updates Continue Working from events and active context without polling", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    let updates = 0;
    core.registry.resolve("eventBus").subscribe("ContinueWorkingUpdated", () => {
      updates += 1;
    });
    await core.boot();
    expect(core.shell.getSnapshotSync().continuity.continueWorking).toEqual([]);

    const first = await core.shell.createNote(undefined, "First", "");
    const second = await core.shell.createNote(undefined, "Second", "");
    await core.shell.openResource(first.id);
    expect(core.shell.getSnapshotSync().continuity.continueWorking.map((item) => item.resourceId)).toEqual([
      first.id,
      second.id,
    ]);

    await core.shell.renameResource(first.id, "First renamed");
    expect(core.shell.getSnapshotSync().continuity.continueWorking[0]?.resourceName).toBe("First renamed");
    await core.shell.archiveResource(first.id);
    expect(core.shell.getSnapshotSync().continuity.continueWorking.map((item) => item.resourceId)).toEqual([second.id]);
    await core.shell.restoreResource(first.id);
    expect(core.shell.getSnapshotSync().continuity.continueWorking.map((item) => item.resourceId)).toContain(first.id);

    const secondProfile = await core.shell.createProfile("Other context");
    expect(core.shell.getSnapshotSync().profiles.active?.id).toBe(secondProfile.id);
    expect(core.shell.getSnapshotSync().continuity.continueWorking).toEqual([]);
    await core.shell.switchProfile("profile-primary");
    expect(core.shell.getSnapshotSync().continuity.continueWorking.map((item) => item.resourceId)).toContain(first.id);

    const originalWorkspaceId = first.primaryWorkspaceId!;
    const targetWorkspace = await core.shell.createWorkspace("Target");
    expect(core.shell.getSnapshotSync().continuity.continueWorking).toEqual([]);
    await core.shell.openWorkspace(originalWorkspaceId);
    await core.shell.moveResource(first.id, { workspaceId: targetWorkspace.id });
    expect(core.shell.getSnapshotSync().continuity.continueWorking.map((item) => item.resourceId)).not.toContain(
      first.id,
    );
    await core.shell.openWorkspace(targetWorkspace.id);
    expect(core.shell.getSnapshotSync().continuity.continueWorking.map((item) => item.resourceId)).toContain(first.id);
    const beforeSuspend = core.shell.getSnapshotSync().continuity.continueWorking;
    await core.suspend();
    await core.resume();
    expect(core.shell.getSnapshotSync().continuity.continueWorking).toEqual(beforeSuspend);
    expect(updates).toBeGreaterThan(0);
    await core.shutdown();
  });

  it("rebuilds Continue Working from SQLite-backed continuity facts after restart", async () => {
    const seed = createSeedData({ includeDemoContent: false });
    const workspaces = new InMemoryWorkspaceRepository(seed.workspaces);
    const resources = new InMemoryResourceRepository();
    const sessions = sessionRepository(seed.session);
    const first = createKaryaCore({
      seed: { includeDemoContent: false },
      persistence: { workspaces, resources, sessions },
    });
    await first.boot();
    const resource = await first.shell.createNote(undefined, "Resume me", "");
    await first.shell.openResource(resource.id);
    const beforeRestart = first.shell.getSnapshotSync().continuity.continueWorking[0];
    await first.shutdown();

    const second = createKaryaCore({
      seed: { includeDemoContent: false },
      persistence: { workspaces, resources, sessions },
    });
    await second.boot();
    expect(second.shell.getSnapshotSync().continuity.continueWorking[0]).toMatchObject({
      resourceId: resource.id,
      workspaceId: resource.primaryWorkspaceId,
      profileId: resource.profileId,
      lastOpened: beforeRestart?.lastOpened,
    });
    await second.shutdown();
  });
});

function memoryRepository(initial: Profile[]): ProfileRepository {
  const values = new Map(initial.map((entity) => [entity.id, entity]));
  return {
    async list() {
      return [...values.values()];
    },
    async get(id) {
      return values.get(id);
    },
    async save(entity) {
      values.set(entity.id, entity);
    },
    async delete(id) {
      values.delete(id);
    },
  };
}

function sessionRepository(initial: ContinuitySession): SessionRepository {
  let current = initial;
  return {
    async list() {
      return [current];
    },
    async get(id) {
      return id === current.id ? current : undefined;
    },
    async save(session) {
      current = session;
    },
    async delete() {},
    async getCurrent() {
      return current;
    },
    async saveCurrent(session) {
      current = session;
    },
  };
}
