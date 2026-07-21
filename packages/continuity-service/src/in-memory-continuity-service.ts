import type { EventBus } from "@karya/event-bus";
import type { SessionRepository } from "@karya/persistence";
import type {
  ContinuitySession,
  EntityId,
  LayoutState,
  ResumeContext,
  ResumeHistoryEntry,
  WorkspaceActivityType,
  ContinuityWorkspaceSession,
  WorkspaceNavigationContext,
} from "@karya/types";
import type { ContinuityService } from "./contracts";
import { InMemorySessionRepository } from "./repositories/in-memory-session-repository";
import { createActivity, createWorkspaceSession, hasRecentEquivalentActivity } from "./utils/workspace-session";

export class InMemoryContinuityService implements ContinuityService {
  private session: ContinuitySession;

  constructor(
    private readonly eventBus: EventBus,
    session: ContinuitySession,
    private readonly repository: SessionRepository = new InMemorySessionRepository(session),
  ) {
    this.session = session;
  }

  subscribeToEvents(): () => void {
    const unsubscribeCreated = this.eventBus.subscribe("ResourceCreated", async ({ resource }) => {
      if (resource.tags.includes("linked") || isFolderImportResource(resource) || isFolderImportChild(resource)) return;
      await this.addRecentResource(resource.id);
      await this.recordWorkspaceResourceActivity({
        workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        profileId: resource.profileId,
        resourceId: resource.id,
        title: resource.metadata.title,
        type: "resource-created",
      });
    });
    const unsubscribeFolderImported = this.eventBus.subscribe("FolderImported", async ({ folder }) => {
      await this.recordWorkspaceResourceActivity({
        workspaceId: folder.primaryWorkspaceId ?? folder.workspaceRefs[0],
        profileId: folder.profileId,
        resourceId: folder.id,
        title: folder.metadata.title,
        type: "folder-imported",
      });
    });
    const unsubscribeImported = this.eventBus.subscribe("ResourceContentImported", async ({ resource }) => {
      if (isFolderImportChild(resource)) return;
      await this.recordWorkspaceResourceActivity({
        workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        profileId: resource.profileId,
        resourceId: resource.id,
        title: resource.metadata.title,
        type: "resource-imported",
      });
    });
    const unsubscribeOpened = this.eventBus.subscribe("ResourceOpened", async ({ resource, workspaceId }) => {
      await this.recordWorkspaceResourceActivity({
        workspaceId: workspaceId ?? resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        profileId: resource.profileId,
        resourceId: resource.id,
        title: resource.metadata.title,
        type: "resource-opened",
      });
    });
    const unsubscribeRenamed = this.eventBus.subscribe("ResourceRenamed", async ({ resource }) => {
      await this.recordWorkspaceResourceActivity({
        workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        profileId: resource.profileId,
        resourceId: resource.id,
        title: resource.metadata.title,
        type: "resource-renamed",
      });
    });
    const unsubscribeUpdated = this.eventBus.subscribe("ResourceUpdated", async ({ resource }) => {
      if (isFolderImportResource(resource) || isFolderImportChild(resource)) return;
      if (resource.metadata.kind !== "note" || resource.metadata.attributes?.noteEditableInKarya === false) return;
      await this.recordWorkspaceResourceActivity({
        workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        profileId: resource.profileId,
        resourceId: resource.id,
        title: resource.metadata.title,
        type: "resource-edited",
        activateContext: false,
      });
    });
    const unsubscribeReferenced = this.eventBus.subscribe("ResourceReferenced", async ({ resource, workspaceId }) => {
      await this.recordWorkspaceResourceActivity({
        workspaceId,
        profileId: resource.profileId,
        resourceId: resource.id,
        title: resource.metadata.title,
        type: "resource-referenced",
      });
    });
    const unsubscribeMoved = this.eventBus.subscribe("ResourceMoved", async ({ resource }) => {
      await this.recordWorkspaceResourceActivity({
        workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        profileId: resource.profileId,
        resourceId: resource.id,
        title: resource.metadata.title,
        type: "resource-moved",
        activateContext: false,
      });
    });
    const unsubscribeArchived = this.eventBus.subscribe("ResourceArchived", async ({ resource }) => {
      await this.recordWorkspaceResourceActivity({
        workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        profileId: resource.profileId,
        resourceId: resource.id,
        title: resource.metadata.title,
        type: "resource-archived",
      });
    });
    const unsubscribeWorkspaceOpened = this.eventBus.subscribe("WorkspaceOpened", async ({ workspace }) => {
      await this.openWorkspaceSession(workspace.id, workspace.profileId);
    });
    const unsubscribeDeleted = this.eventBus.subscribe("ResourceDeleted", async ({ resource }) => {
      await this.removeRecentResource(resource.id);
    });
    const unsubscribeApplicationLaunched = this.eventBus.subscribe(
      "ApplicationLaunched",
      async ({ applicationId, application, workspaceId, profileId }) => {
        await this.addRecentApplication(applicationId);
        await this.recordWorkspaceApplicationLaunch({
          workspaceId: workspaceId ?? this.session.activeWorkspaceId,
          profileId: profileId ?? this.session.activeProfileId,
          applicationId,
          title: application.metadata.name,
        });
      },
    );

    return () => {
      unsubscribeCreated();
      unsubscribeFolderImported();
      unsubscribeImported();
      unsubscribeOpened();
      unsubscribeRenamed();
      unsubscribeUpdated();
      unsubscribeReferenced();
      unsubscribeMoved();
      unsubscribeArchived();
      unsubscribeWorkspaceOpened();
      unsubscribeDeleted();
      unsubscribeApplicationLaunched();
    };
  }

  async getCurrentSession(): Promise<ContinuitySession> {
    this.session = (await this.repository.getCurrent()) ?? this.session;
    return this.session;
  }

  async resumeContext(context: Omit<ResumeContext, "capturedAt">): Promise<ContinuitySession> {
    return this.captureResumeContext(context);
  }

  async setActiveProfile(profileId: EntityId): Promise<ContinuitySession> {
    return this.updateSession({
      activeProfileId: profileId,
      activeWorkspaceId: undefined,
    });
  }

  async setActiveWorkspace(workspaceId: EntityId): Promise<ContinuitySession> {
    return this.updateSession({ activeWorkspaceId: workspaceId });
  }

  async preserveWorkspaceSession(workspaceId: EntityId): Promise<ContinuitySession> {
    const workspaceSession = this.session.workspaceSessions?.[workspaceId];
    const now = new Date().toISOString();
    return this.updateSession({
      activeWorkspaceId: this.session.activeWorkspaceId === workspaceId ? undefined : this.session.activeWorkspaceId,
      interruptedSession: workspaceSession
        ? {
            workspaceId,
            profileId: workspaceSession.profileId,
            capturedAt: now,
          }
        : this.session.interruptedSession,
      workspaceSessions: workspaceSession
        ? {
            ...(this.session.workspaceSessions ?? {}),
            [workspaceId]: {
              ...workspaceSession,
              state: "preserved",
              lastActiveAt: now,
            },
          }
        : this.session.workspaceSessions,
      resumeContext: {
        profileId: this.session.activeProfileId,
        workspaceId,
        resourceIds: workspaceSession?.recentResourceIds ?? this.session.recentResourceIds,
        applicationIds: workspaceSession?.launchedApplicationIds,
        capturedAt: now,
      },
    });
  }

  async openWorkspaceSession(workspaceId: EntityId, profileId: EntityId): Promise<ContinuitySession> {
    const now = new Date().toISOString();
    const existing = this.session.workspaceSessions?.[workspaceId];
    const workspaceSession = existing
      ? {
          ...existing,
          profileId,
          state: "active" as const,
          lastActiveAt: now,
          lastNavigationContext: {
            surface: "workspace" as const,
            workspaceId,
            capturedAt: now,
          },
          activityTimeline: [
            createActivity({
              workspaceId,
              profileId,
              type: "workspace-opened",
              title: "Opened Workspace",
              occurredAt: now,
            }),
            ...existing.activityTimeline,
          ].slice(0, 80),
        }
      : {
          ...createWorkspaceSession(workspaceId, profileId, now),
          lastNavigationContext: {
            surface: "workspace" as const,
            workspaceId,
            capturedAt: now,
          },
        };

    return this.updateSession({
      activeProfileId: profileId,
      activeWorkspaceId: workspaceId,
      interruptedSession: undefined,
      workspaceSessions: {
        ...(this.session.workspaceSessions ?? {}),
        [workspaceId]: workspaceSession,
      },
      resumeContext: {
        profileId,
        workspaceId,
        resourceIds: workspaceSession.recentResourceIds,
        applicationIds: workspaceSession.launchedApplicationIds,
        capturedAt: now,
      },
    });
  }

  async resumeWorkspaceSession(workspaceId: EntityId, profileId: EntityId): Promise<ContinuitySession> {
    const now = new Date().toISOString();
    const existing = this.getOrCreateWorkspaceSession(workspaceId, profileId, now);
    const workspaceSession: ContinuityWorkspaceSession = {
      ...existing,
      profileId,
      state: "active",
      lastActiveAt: now,
      lastResumeAt: now,
      resumeCount: existing.resumeCount + 1,
      activityTimeline: [
        createActivity({
          workspaceId,
          profileId,
          type: "workspace-resumed",
          title: "Resumed Workspace",
          occurredAt: now,
        }),
        ...existing.activityTimeline,
      ].slice(0, 80),
    };

    return this.updateSession({
      activeProfileId: profileId,
      activeWorkspaceId: workspaceId,
      interruptedSession: undefined,
      workspaceSessions: {
        ...(this.session.workspaceSessions ?? {}),
        [workspaceId]: workspaceSession,
      },
      resumeContext: {
        profileId,
        workspaceId,
        resourceIds: workspaceSession.recentResourceIds,
        applicationIds: workspaceSession.launchedApplicationIds,
        capturedAt: now,
      },
      resumeHistory: buildResumeHistory(this.session.resumeHistory, {
        profileId,
        workspaceId,
        resourceIds: workspaceSession.recentResourceIds,
        applicationIds: workspaceSession.launchedApplicationIds,
        capturedAt: now,
      }),
    });
  }

  async updateWorkspaceNavigation(
    context: WorkspaceNavigationContext & { profileId: EntityId },
  ): Promise<ContinuitySession> {
    const workspaceSession = this.getOrCreateWorkspaceSession(
      context.workspaceId,
      context.profileId,
      context.capturedAt,
    );
    const nextWorkspaceSession: ContinuityWorkspaceSession = {
      ...workspaceSession,
      profileId: context.profileId,
      lastActiveAt: context.capturedAt,
      lastNavigationContext: {
        surface: context.surface,
        workspaceId: context.workspaceId,
        folderId: context.folderId,
        selectedResourceId: context.selectedResourceId,
        breadcrumbs: context.breadcrumbs,
        scrollTop: context.scrollTop,
        capturedAt: context.capturedAt,
      },
      lastSelectedResourceId: context.selectedResourceId ?? workspaceSession.lastSelectedResourceId,
      activeResourceIds: context.selectedResourceId
        ? [
            context.selectedResourceId,
            ...workspaceSession.activeResourceIds.filter((id) => id !== context.selectedResourceId),
          ].slice(0, 8)
        : workspaceSession.activeResourceIds,
    };

    return this.updateSession({
      activeProfileId: context.profileId,
      activeWorkspaceId: context.workspaceId,
      workspaceSessions: {
        ...(this.session.workspaceSessions ?? {}),
        [context.workspaceId]: nextWorkspaceSession,
      },
    });
  }

  async recordWorkspaceResourceActivity(input: {
    workspaceId?: EntityId;
    profileId: EntityId;
    resourceId: EntityId;
    title: string;
    type: WorkspaceActivityType;
    activateContext?: boolean;
  }): Promise<ContinuitySession> {
    if (!input.workspaceId) return this.addRecentResource(input.resourceId);
    const now = new Date().toISOString();
    const workspaceSession = this.getOrCreateWorkspaceSession(input.workspaceId, input.profileId, now);
    const activity = createActivity({
      workspaceId: input.workspaceId,
      profileId: input.profileId,
      type: input.type,
      resourceId: input.resourceId,
      title: input.title,
      occurredAt: now,
    });
    const activityTimeline = hasRecentEquivalentActivity(workspaceSession.activityTimeline, activity)
      ? workspaceSession.activityTimeline
      : [activity, ...workspaceSession.activityTimeline].slice(0, 80);
    const nextWorkspaceSession: ContinuityWorkspaceSession = {
      ...workspaceSession,
      profileId: input.profileId,
      state: "active",
      lastActiveAt: now,
      lastSelectedResourceId: input.resourceId,
      activeResourceIds: [
        input.resourceId,
        ...workspaceSession.activeResourceIds.filter((id) => id !== input.resourceId),
      ].slice(0, 8),
      recentResourceIds: [
        input.resourceId,
        ...workspaceSession.recentResourceIds.filter((id) => id !== input.resourceId),
      ].slice(0, 16),
      activityTimeline,
    };

    return this.updateSession({
      activeProfileId: input.activateContext === false ? this.session.activeProfileId : input.profileId,
      activeWorkspaceId: input.activateContext === false ? this.session.activeWorkspaceId : input.workspaceId,
      recentResourceIds: [
        input.resourceId,
        ...this.session.recentResourceIds.filter((id) => id !== input.resourceId),
      ].slice(0, 16),
      workspaceSessions: {
        ...(this.session.workspaceSessions ?? {}),
        [input.workspaceId]: nextWorkspaceSession,
      },
      resumeContext:
        input.activateContext === false
          ? this.session.resumeContext
          : {
              profileId: input.profileId,
              workspaceId: input.workspaceId,
              resourceIds: nextWorkspaceSession.recentResourceIds,
              applicationIds: nextWorkspaceSession.launchedApplicationIds,
              capturedAt: now,
            },
    });
  }

  async recordWorkspaceApplicationLaunch(input: {
    workspaceId?: EntityId;
    profileId: EntityId;
    applicationId: EntityId;
    title: string;
  }): Promise<ContinuitySession> {
    if (!input.workspaceId) return this.addRecentApplication(input.applicationId);
    const now = new Date().toISOString();
    const workspaceSession = this.getOrCreateWorkspaceSession(input.workspaceId, input.profileId, now);
    const activity = createActivity({
      workspaceId: input.workspaceId,
      profileId: input.profileId,
      type: "application-launched",
      applicationId: input.applicationId,
      title: input.title,
      occurredAt: now,
    });
    const activityTimeline = hasRecentEquivalentActivity(workspaceSession.activityTimeline, activity)
      ? workspaceSession.activityTimeline
      : [activity, ...workspaceSession.activityTimeline].slice(0, 80);
    const nextWorkspaceSession: ContinuityWorkspaceSession = {
      ...workspaceSession,
      profileId: input.profileId,
      state: "active",
      lastActiveAt: now,
      launchedApplicationIds: [
        input.applicationId,
        ...workspaceSession.launchedApplicationIds.filter((id) => id !== input.applicationId),
      ].slice(0, 12),
      activityTimeline,
    };

    return this.updateSession({
      activeProfileId: input.profileId,
      activeWorkspaceId: input.workspaceId,
      recentApplicationIds: [
        input.applicationId,
        ...(this.session.recentApplicationIds ?? []).filter((id) => id !== input.applicationId),
      ].slice(0, 12),
      workspaceSessions: {
        ...(this.session.workspaceSessions ?? {}),
        [input.workspaceId]: nextWorkspaceSession,
      },
      resumeContext: {
        profileId: input.profileId,
        workspaceId: input.workspaceId,
        resourceIds: nextWorkspaceSession.recentResourceIds,
        applicationIds: nextWorkspaceSession.launchedApplicationIds,
        capturedAt: now,
      },
    });
  }

  async addRecentResource(resourceId: EntityId): Promise<ContinuitySession> {
    return this.updateSession({
      recentResourceIds: [resourceId, ...this.session.recentResourceIds.filter((id) => id !== resourceId)].slice(0, 8),
    });
  }

  async removeRecentResource(resourceId: EntityId): Promise<ContinuitySession> {
    const workspaceSessions = Object.fromEntries(
      Object.entries(this.session.workspaceSessions ?? {}).map(([workspaceId, workspaceSession]) => [
        workspaceId,
        {
          ...workspaceSession,
          activeResourceIds: workspaceSession.activeResourceIds.filter((id) => id !== resourceId),
          recentResourceIds: workspaceSession.recentResourceIds.filter((id) => id !== resourceId),
          lastSelectedResourceId:
            workspaceSession.lastSelectedResourceId === resourceId
              ? undefined
              : workspaceSession.lastSelectedResourceId,
          lastNavigationContext:
            workspaceSession.lastNavigationContext?.selectedResourceId === resourceId
              ? { ...workspaceSession.lastNavigationContext, selectedResourceId: undefined }
              : workspaceSession.lastNavigationContext,
        },
      ]),
    );

    return this.updateSession({
      recentResourceIds: this.session.recentResourceIds.filter((id) => id !== resourceId),
      workspaceSessions,
      resumeContext: this.session.resumeContext
        ? {
            ...this.session.resumeContext,
            resourceIds: this.session.resumeContext.resourceIds.filter((id) => id !== resourceId),
          }
        : undefined,
    });
  }

  async addRecentApplication(applicationId: EntityId): Promise<ContinuitySession> {
    return this.updateSession({
      recentApplicationIds: [
        applicationId,
        ...(this.session.recentApplicationIds ?? []).filter((id) => id !== applicationId),
      ].slice(0, 8),
    });
  }

  async captureResumeContext(context: Omit<ResumeContext, "capturedAt">): Promise<ContinuitySession> {
    const workspaceSession = context.workspaceId ? this.session.workspaceSessions?.[context.workspaceId] : undefined;
    const now = new Date().toISOString();
    return this.updateSession({
      activeProfileId: context.profileId,
      activeWorkspaceId: context.workspaceId,
      workspaceSessions:
        workspaceSession && context.workspaceId
          ? {
              ...(this.session.workspaceSessions ?? {}),
              [context.workspaceId]: {
                ...workspaceSession,
                lastResumeAt: new Date().toISOString(),
                resumeCount: workspaceSession.resumeCount + 1,
              },
            }
          : this.session.workspaceSessions,
      resumeContext: {
        ...context,
        capturedAt: now,
      },
      resumeHistory: buildResumeHistory(this.session.resumeHistory, {
        ...context,
        capturedAt: now,
      }),
    });
  }

  async persistLayout(layout: Partial<LayoutState>): Promise<ContinuitySession> {
    return this.updateSession({
      layout: {
        ...this.session.layout,
        ...layout,
      },
    });
  }

  async recordSearch(query: string): Promise<ContinuitySession> {
    const normalized = query.trim();
    if (!normalized) return this.getCurrentSession();
    const recentSearches = [
      { query: normalized, searchedAt: new Date().toISOString() },
      ...(this.session.recentSearches ?? []).filter(
        (entry) => entry.query.toLocaleLowerCase() !== normalized.toLocaleLowerCase(),
      ),
    ].slice(0, 10);
    return this.updateSession({ recentSearches });
  }

  async clearRecentSearches(): Promise<ContinuitySession> {
    return this.updateSession({ recentSearches: [] });
  }

  private async updateSession(patch: Partial<ContinuitySession>): Promise<ContinuitySession> {
    this.session = {
      ...this.session,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.repository.saveCurrent(this.session);
    await this.eventBus.publish("continuity:session-updated", { session: this.session });
    return this.session;
  }

  private getOrCreateWorkspaceSession(
    workspaceId: EntityId,
    profileId: EntityId,
    now: string,
  ): ContinuityWorkspaceSession {
    return this.session.workspaceSessions?.[workspaceId] ?? createWorkspaceSession(workspaceId, profileId, now);
  }
}

function isFolderImportResource(resource: {
  metadata: { kind: string; attributes?: Record<string, string | number | boolean | null> };
  tags: string[];
}): boolean {
  return (
    resource.metadata.kind === "folder" &&
    (resource.tags.includes("imported") || typeof resource.metadata.attributes?.folderImportStatus === "string")
  );
}

function isFolderImportChild(resource: {
  metadata: { attributes?: Record<string, string | number | boolean | null> };
}): boolean {
  return typeof resource.metadata.attributes?.folderParentId === "string";
}

function buildResumeHistory(existing: ResumeHistoryEntry[] | undefined, context: ResumeContext): ResumeHistoryEntry[] {
  const id = `resume-${context.workspaceId ?? "global"}-${context.capturedAt}`;
  const key = resumeHistoryKey(context);
  return [{ id, ...context }, ...(existing ?? []).filter((entry) => resumeHistoryKey(entry) !== key)].slice(0, 12);
}

function resumeHistoryKey(context: ResumeContext): string {
  return [
    context.workspaceId ?? "global",
    context.resourceIds.join(","),
    context.applicationIds?.join(",") ?? "",
    context.workingDirectory ?? "",
  ].join(":");
}
