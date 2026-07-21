import { describe, expect, it } from "vitest";
import { createKaryaCore } from "./factory";

describe("User-intent product improvements", () => {
  it("boots with constitutional defaults and no invented user content", async () => {
    const core = createKaryaCore({
      seed: { includeDemoContent: false },
    });

    await core.boot();

    const snapshot = core.shell.getSnapshotSync();
    expect(snapshot.profiles.all).toHaveLength(1);
    expect(snapshot.profiles.all[0]?.name).toBe("Default Profile");
    expect(snapshot.workspaces.all).toHaveLength(2);
    expect(snapshot.workspaces.all.every((workspace) => workspace.name === "Default Space")).toBe(true);
    expect(snapshot.workspaces.all.every((workspace) => workspace.resourceRefs.length === 0)).toBe(true);
    expect(snapshot.resources.all).toEqual([]);
    expect(snapshot.profiles.active?.id).toBe("profile-primary");
    expect(snapshot.workspaces.active?.id).toBe("workspace-default-space");
    await core.shutdown();
  });

  it("requires explicit names and never creates a default Workspace for a Profile", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();

    await expect(core.shell.createProfile("   ")).rejects.toThrow("Profile name is required");
    await expect(core.shell.createWorkspace("   ")).rejects.toThrow("Workspace name is required");

    const profile = await core.shell.createProfile("Research");
    expect(profile.name).toBe("Research");
    expect(profile.defaultSpaceId).toBeUndefined();
    expect(core.shell.getSnapshotSync().workspaces.all.some((workspace) => workspace.profileId === profile.id)).toBe(
      false,
    );
    await core.shutdown();
  });

  it("opens a Profile Overview without choosing a Workspace for the user", async () => {
    const core = createKaryaCore({ seed: { includeDemoContent: false } });
    await core.boot();
    const profile = await core.shell.createProfile("Studio");
    const workspace = await core.shell.createWorkspace("Client work");
    await core.shell.switchProfile("profile-primary");

    await core.shell.openProfile(profile.id);

    const snapshot = core.shell.getSnapshotSync();
    expect(snapshot.shell.activeSurface).toEqual({ type: "profile", profileId: profile.id });
    expect(snapshot.continuity.currentSession?.activeWorkspaceId).toBeUndefined();

    await core.shell.openWorkspace(workspace.id);
    expect(core.shell.getSnapshotSync().shell.activeSurface).toEqual({ type: "workspace", workspaceId: workspace.id });
    await core.shutdown();
  });
});
