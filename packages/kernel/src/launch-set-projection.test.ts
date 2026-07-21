import { describe, expect, it } from "vitest";
import type { WorkspaceLaunchSet, WorkspaceSettings } from "@karya/types";
import { InMemoryWorkspaceRepository } from "@karya/workspace-service";
import { createKaryaCore } from "./factory";
import { createSeedData } from "./seed-data";

describe("Workspace Launch Set projection", () => {
  it("projects every mutation immediately and restores the persisted result", async () => {
    const seed = createSeedData({ includeDemoContent: false });
    const workspaces = new InMemoryWorkspaceRepository(seed.workspaces);
    const first = createKaryaCore({
      seed: { includeDemoContent: false },
      persistence: { workspaces },
    });
    const projectedWorkspaceIds: string[] = [];
    first.registry.resolve("eventBus").subscribe("WorkspaceLaunchSetUpdated", ({ workspace }) => {
      projectedWorkspaceIds.push(workspace.id);
    });
    await first.boot();

    const workspaceId = seed.session.activeWorkspaceId!;
    const initial: WorkspaceLaunchSet = {
      enabled: true,
      items: [
        {
          id: "launch-application-editor",
          enabled: true,
          kind: "application",
          applicationId: "application-editor",
          behavior: "launch",
        },
      ],
      restoreInspector: true,
      executionMode: "parallel",
      failureHandling: "notify",
      restoreBehavior: "continuity-then-launch",
      notifyWhenReady: true,
      updatedAt: "2026-07-17T00:00:00.000Z",
    };

    await first.shell.updateWorkspaceLaunchSet(workspaceId, initial);
    expect(findLaunchSet(first, workspaceId)).toEqual(initial);

    const disabled = { ...initial, enabled: false, updatedAt: "2026-07-17T00:00:01.000Z" };
    await first.shell.updateWorkspaceLaunchSet(workspaceId, disabled);
    expect(findLaunchSet(first, workspaceId)?.enabled).toBe(false);

    const withSecondApplication: WorkspaceLaunchSet = {
      ...disabled,
      enabled: true,
      items: [
        ...disabled.items,
        {
          id: "launch-application-terminal",
          kind: "application",
          applicationId: "application-terminal",
          behavior: "reuse-existing",
        },
        {
          id: "launch-resource-notes",
          kind: "resource",
          resourceId: "resource-notes",
          applicationId: "application-editor",
          behavior: "open",
        },
      ],
      updatedAt: "2026-07-17T00:00:02.000Z",
    };
    await first.shell.updateWorkspaceLaunchSet(workspaceId, withSecondApplication);
    expect(findLaunchSet(first, workspaceId)?.items.map((item) => item.id)).toEqual([
      "launch-application-editor",
      "launch-application-terminal",
      "launch-resource-notes",
    ]);

    const afterRemoval: WorkspaceLaunchSet = {
      ...withSecondApplication,
      items: withSecondApplication.items.slice(1).map((item) => ({ ...item, enabled: false })),
      updatedAt: "2026-07-17T00:00:03.000Z",
    };
    await first.shell.updateWorkspaceLaunchSet(workspaceId, afterRemoval);
    expect(findLaunchSet(first, workspaceId)).toEqual(afterRemoval);
    const settings: WorkspaceSettings = {
      appearance: {
        theme: "focus",
        accentColor: "#0f766e",
        banner: "solid",
        wallpaper: "ambient",
        iconPack: "minimal",
        backgroundBlur: "strong",
      },
      experience: {
        defaultLanding: "resources",
        resourceDisplay: "list",
        resourceSort: "title",
        notificationPreference: "important",
        searchPreference: "workspace",
        openBehavior: "restore-context",
      },
      continuity: {
        enabled: true,
        restorePreference: "last-resource",
        rankingPreference: "recency",
        resourcePriority: "pinned",
        restoreLayout: true,
      },
      preferences: {
        capturePreference: "profile-inbox",
        relationshipPreference: "manual",
        activityPreference: "meaningful",
        searchContextBoost: "workspace",
        synchronizationPreference: "local-only",
        offlinePreference: "local-first",
      },
    };
    await first.shell.updateWorkspaceSettings(workspaceId, {
      description: "A configured working environment",
      icon: "WL",
      color: "#0f766e",
      settings,
    });
    expect(findWorkspace(first, workspaceId)).toMatchObject({
      metadata: { description: "A configured working environment", icon: "WL", color: "#0f766e" },
      settings,
    });
    expect(projectedWorkspaceIds).toEqual([workspaceId, workspaceId, workspaceId, workspaceId]);
    await first.shutdown();

    const restarted = createKaryaCore({
      seed: { includeDemoContent: false },
      persistence: { workspaces },
    });
    await restarted.boot();
    expect(findLaunchSet(restarted, workspaceId)).toEqual(afterRemoval);
    expect(findWorkspace(restarted, workspaceId)?.settings).toEqual(settings);

    await restarted.shell.updateWorkspaceLaunchSet(workspaceId, undefined);
    expect(findLaunchSet(restarted, workspaceId)).toBeUndefined();
    await restarted.shutdown();
  });
});

function findLaunchSet(core: ReturnType<typeof createKaryaCore>, workspaceId: string): WorkspaceLaunchSet | undefined {
  return core.shell.getSnapshotSync().workspaces.all.find((workspace) => workspace.id === workspaceId)?.launchSet;
}

function findWorkspace(core: ReturnType<typeof createKaryaCore>, workspaceId: string) {
  return core.shell.getSnapshotSync().workspaces.all.find((workspace) => workspace.id === workspaceId);
}
