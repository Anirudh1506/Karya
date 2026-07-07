import type { CalendarEvent, ContinuitySession, InstalledApplication, KaryaActivity, KaryaNotification, Profile, Resource, SettingDefinition, Workspace } from "@karya/types";

export interface SeedDataOptions {
  includeDemoContent?: boolean;
  profileName?: string;
}

export function createSeedData(options: SeedDataOptions = {}): {
  applications: InstalledApplication[];
  activities: KaryaActivity[];
  events: CalendarEvent[];
  notifications: KaryaNotification[];
  profiles: Profile[];
  resources: Resource[];
  session: ContinuitySession;
  settings: SettingDefinition[];
  workspaces: Workspace[];
} {
  const now = new Date().toISOString();
  const includeDemoContent = options.includeDemoContent ?? true;
  const profileId = "profile-primary";
  const workspaceId = "workspace-default-space";
  const desktopDefaultSpaceId = "workspace-desktop-home-default-space";
  const demoResourceIds = includeDemoContent ? ["resource-karya-brief", "resource-system-map"] : [];

  return {
    activities: [],
    profiles: [
      {
        id: profileId,
        name: options.profileName?.trim() || "New Profile",
        defaultSpaceId: workspaceId,
        spaceIds: [workspaceId],
        createdAt: now,
      },
    ],
    workspaces: [
      {
        id: desktopDefaultSpaceId,
        name: "Default Space",
        metadata: {
          name: "Default Space",
          description: "Desktop-level inbox for imports that do not belong to a Profile yet",
          createdAt: now,
          updatedAt: now,
          createdBy: "desktop-user",
          updatedBy: "desktop-user",
          icon: "Inbox",
        },
        profileId: "desktop-user",
        owner: "desktop-user",
        resourceRefs: [],
        pinnedApplicationIds: [],
        lifecycleState: "closed",
        pinned: false,
        favorite: false,
        permissions: {
          ownerCanEdit: true,
          sharedWith: [],
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: workspaceId,
        name: "Default Space",
        metadata: {
          name: "Default Space",
          description: "Profile-level inbox for temporary resources, captures, imports, and unorganized work",
          createdAt: now,
          updatedAt: now,
          createdBy: profileId,
          updatedBy: profileId,
        },
        profileId,
        owner: profileId,
        resourceRefs: demoResourceIds,
        pinnedApplicationIds: [],
        activeSession: includeDemoContent
          ? {
              id: "workspace-session-default-space",
              workspaceId,
              openedAt: now,
              lastActiveAt: now,
              activeResourceIds: ["resource-system-map"],
              layout: {
                sidebarCollapsed: false,
                inspectorOpen: true,
                activeSurface: "workspace",
                panelVisibility: {
                  sidebar: true,
                  inspector: true,
                },
              },
            }
          : undefined,
        lifecycleState: "open",
        pinned: true,
        favorite: true,
        permissions: {
          ownerCanEdit: true,
          sharedWith: [],
        },
        lastOpenedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ],
    resources: includeDemoContent
      ? [
          {
            id: "resource-karya-brief",
            type: "brief",
            metadata: {
              title: "Karya OS Foundation",
              description: "Milestone 1 architecture brief",
              kind: "brief",
              createdAt: now,
              updatedAt: now,
            },
            owner: profileId,
            profileId,
            workspaceRefs: [workspaceId],
            primaryWorkspaceId: workspaceId,
            defaultSpace: "profile",
            tags: ["architecture", "foundation"],
            relationships: [],
            permissions: {
              ownerCanEdit: true,
              sharedWith: [],
            },
            versionInfo: {
              version: 1,
            },
            status: "active",
            lifecycleState: "active",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "resource-system-map",
            type: "system-object",
            metadata: {
              title: "Service Topology",
              description: "Registered services and event flow",
              kind: "system-object",
              createdAt: now,
              updatedAt: now,
            },
            owner: profileId,
            profileId,
            workspaceRefs: [workspaceId],
            primaryWorkspaceId: workspaceId,
            defaultSpace: "profile",
            tags: ["core", "events"],
            relationships: [
              {
                id: "relationship-system-brief",
                targetResourceId: "resource-karya-brief",
                type: "references",
              },
            ],
            permissions: {
              ownerCanEdit: true,
              sharedWith: [],
            },
            versionInfo: {
              version: 1,
            },
            status: "active",
            lifecycleState: "active",
            createdAt: now,
            updatedAt: now,
          },
        ]
      : [],
    events: [],
    notifications: [],
    applications: [],
    settings: [
      {
        id: "setting-theme",
        label: "Theme",
        category: "Appearance",
        value: "system",
        searchable: true,
      },
      {
        id: "setting-layout-persistence",
        label: "Layout Persistence",
        category: "Continuity",
        value: true,
        searchable: true,
      },
      {
        id: "setting-clipboard",
        label: "Clipboard History",
        category: "System",
        value: "enabled",
        searchable: true,
      },
    ],
    session: {
      id: "session-current",
      activeProfileId: profileId,
      activeWorkspaceId: workspaceId,
      recentResourceIds: includeDemoContent ? ["resource-system-map", "resource-karya-brief"] : [],
      layout: {
        sidebarCollapsed: false,
        inspectorOpen: true,
        activeSurface: "home",
      },
      startedAt: now,
      updatedAt: now,
    },
  };
}
