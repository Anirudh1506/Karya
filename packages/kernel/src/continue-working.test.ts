import { describe, expect, it } from "vitest";
import { rankContinueWorking } from "@karya/continuity-service";
import { deriveResources } from "@karya/state-engine";
import type { ContinuitySession, Profile, Resource, Workspace } from "@karya/types";

const profile: Profile = {
  id: "profile-one",
  name: "Work",
  defaultSpaceId: "workspace-one",
  spaceIds: ["workspace-one"],
  createdAt: "2026-01-01T00:00:00.000Z",
};
const workspace: Workspace = {
  id: "workspace-one",
  name: "Studio",
  metadata: { name: "Studio", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  profileId: profile.id,
  owner: profile.id,
  resourceRefs: [],
  pinnedApplicationIds: [],
  lifecycleState: "open",
  pinned: false,
  favorite: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Continue Working ranking", () => {
  it("ranks active, opened, modified, created, then alphabetically with stable ties", () => {
    const resources = [
      resource("alpha", "Alpha", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
      resource("active", "Current", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
      resource("opened", "Opened", "2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"),
      resource("modified", "Modified", "2026-01-01T00:00:00.000Z", "2026-01-05T00:00:00.000Z"),
      resource("new", "New", "2026-01-04T00:00:00.000Z", "2026-01-04T00:00:00.000Z"),
      resource("beta", "Beta", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
    ];
    const items = rankContinueWorking({
      session: session("active", [{ resourceId: "opened", occurredAt: "2026-01-06T00:00:00.000Z" }]),
      profiles: [profile],
      workspaces: [workspace],
      resources,
    });
    expect(items.map((item) => item.resourceId)).toEqual(["active", "opened", "modified", "new", "alpha", "beta"]);
    expect(items[1]).toMatchObject({
      workspaceName: "Studio",
      profileName: "Work",
      lastOpened: "2026-01-06T00:00:00.000Z",
      resumeTimestamp: "2026-01-06T00:00:00.000Z",
    });
  });

  it("is empty without valid context and excludes archived or moved Resources", () => {
    const archived = {
      ...resource("archived", "Archived", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
      lifecycleState: "archived" as const,
      status: "archived" as const,
    };
    const moved = {
      ...resource("moved", "Moved", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"),
      workspaceRefs: ["workspace-two"],
      primaryWorkspaceId: "workspace-two",
    };
    expect(
      rankContinueWorking({
        session: session(undefined, []),
        profiles: [profile],
        workspaces: [workspace],
        resources: [archived, moved],
      }),
    ).toEqual([]);
    expect(
      rankContinueWorking({
        session: { ...session(undefined, []), activeWorkspaceId: undefined },
        profiles: [profile],
        workspaces: [workspace],
        resources: [resource("one", "One", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")],
      }),
    ).toEqual([]);
  });
});

describe("Home Resource projection", () => {
  it("orders active Resources by modification inside Core with a stable fallback", () => {
    const old = resource("old", "Old", "2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
    const newer = resource("newer", "Newer", "2026-01-01T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
    const archived = {
      ...resource("archived-home", "Archived", "2026-01-01T00:00:00.000Z", "2026-01-04T00:00:00.000Z"),
      lifecycleState: "archived" as const,
      status: "archived" as const,
    };
    const state = deriveResources([old, archived, newer], undefined, []);
    expect(state.recentModifiedByWorkspace[workspace.id]?.map((item) => item.id)).toEqual([newer.id, old.id]);
  });
});

function resource(id: string, name: string, createdAt: string, updatedAt: string): Resource {
  return {
    id,
    type: "text/markdown",
    metadata: { title: name, kind: "note", createdAt, updatedAt, attributes: {} },
    owner: profile.id,
    profileId: profile.id,
    workspaceRefs: [workspace.id],
    primaryWorkspaceId: workspace.id,
    defaultSpace: "profile",
    tags: [],
    relationships: [],
    status: "active",
    lifecycleState: "active",
    createdAt,
    updatedAt,
  };
}

function session(
  activeResourceId: string | undefined,
  opened: Array<{ resourceId: string; occurredAt: string }>,
): ContinuitySession {
  return {
    id: "session",
    activeProfileId: profile.id,
    activeWorkspaceId: workspace.id,
    recentResourceIds: [],
    startedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    layout: { sidebarCollapsed: false, inspectorOpen: false, activeSurface: "workspace" },
    workspaceSessions: {
      [workspace.id]: {
        id: "workspace-session",
        workspaceId: workspace.id,
        profileId: profile.id,
        startedAt: "2026-01-01T00:00:00.000Z",
        lastActiveAt: "2026-01-01T00:00:00.000Z",
        activeResourceIds: [],
        recentResourceIds: [],
        launchedApplicationIds: [],
        state: "active",
        resumeCount: 0,
        lastSelectedResourceId: activeResourceId,
        activityTimeline: opened.map((item, index) => ({
          id: `activity-${index}`,
          workspaceId: workspace.id,
          profileId: profile.id,
          resourceId: item.resourceId,
          title: "Opened",
          type: "resource-opened",
          occurredAt: item.occurredAt,
        })),
      },
    },
  };
}
