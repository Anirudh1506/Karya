import type { EventBus } from "@karya/event-bus";
import type { ActivityRepository } from "@karya/persistence";
import type {
  CalendarEvent,
  EntityId,
  ImportJob,
  InstalledApplication,
  KaryaActivity,
  KaryaNotification,
  Profile,
  Resource,
  Workspace,
} from "@karya/types";
import type { ActivityFilter, ActivityRetentionPolicy, ActivityService, RecordActivityRequest } from "./contracts";

export class InMemoryActivityService implements ActivityService {
  private readonly retentionPolicy: ActivityRetentionPolicy;
  private readonly listeners = new Set<(activity: KaryaActivity) => void | Promise<void>>();
  private activeWorkspaceId?: EntityId;

  constructor(
    private readonly eventBus: EventBus,
    seed: KaryaActivity[] = [],
    private readonly repository: ActivityRepository = new InMemoryActivityRepository(seed),
    retentionPolicy: Partial<ActivityRetentionPolicy> = {},
  ) {
    this.retentionPolicy = { mode: "retain-all", queryLimit: retentionPolicy.queryLimit ?? 500 };
  }

  async record(request: RecordActivityRequest): Promise<KaryaActivity> {
    const now = new Date().toISOString();
    const occurredAt = request.occurredAt ?? now;
    const eventType = request.eventType ?? `${request.object.type}.${request.verb}`;
    const activity: KaryaActivity = {
      id: deterministicActivityId(eventType, request.object.id, occurredAt, request.workspaceId),
      eventType,
      category: request.category,
      verb: request.verb,
      title: request.title,
      description: request.description,
      object: { ...request.object },
      relatedObjects: (request.relatedObjects ?? []).map((reference) => ({ ...reference })),
      profileId: request.profileId,
      workspaceId: request.workspaceId,
      applicationId: request.applicationId,
      actor: { id: request.profileId ?? "local-user", type: "local-user" },
      source: request.source,
      groupKey: request.groupKey ?? defaultGroupKey(request, occurredAt),
      groupCount: 1,
      createdAt: now,
      updatedAt: now,
      occurredAt,
      metadata: request.metadata ? { ...request.metadata } : undefined,
    };

    await this.repository.append(activity);
    await Promise.all([...this.listeners].map((listener) => listener(cloneActivity(activity))));
    await this.publish("ActivityRecorded", activity);
    return cloneActivity(activity);
  }

  async list(filter: ActivityFilter = {}): Promise<KaryaActivity[]> {
    return (
      await this.repository.list({
        profileId: filter.profileId,
        workspaceId: filter.workspaceId,
        resourceId: filter.objectType === "resource" ? filter.objectId : undefined,
        eventType: filter.eventType,
        limit: filter.limit ?? this.retentionPolicy.queryLimit,
      })
    )
      .filter((activity) => matchesFilter(activity, filter))
      .sort(compareActivities)
      .slice(0, Math.min(filter.limit ?? this.retentionPolicy.queryLimit, this.retentionPolicy.queryLimit))
      .map(cloneActivity);
  }

  async get(id: EntityId): Promise<KaryaActivity | undefined> {
    const activity = await this.repository.get(id);
    return activity ? cloneActivity(activity) : undefined;
  }

  recent(limit = 50): Promise<KaryaActivity[]> {
    return this.list({ limit });
  }
  byProfile(profileId: EntityId, limit?: number): Promise<KaryaActivity[]> {
    return this.list({ profileId, limit });
  }
  byWorkspace(workspaceId: EntityId, limit?: number): Promise<KaryaActivity[]> {
    return this.list({ workspaceId, limit });
  }
  byResource(resourceId: EntityId, limit?: number): Promise<KaryaActivity[]> {
    return this.list({ objectId: resourceId, objectType: "resource", limit });
  }
  byEventType(eventType: string, limit?: number): Promise<KaryaActivity[]> {
    return this.list({ eventType, limit });
  }
  async latest(filter: ActivityFilter = {}): Promise<KaryaActivity | undefined> {
    return (await this.list({ ...filter, limit: 1 }))[0];
  }
  getRetentionPolicy(): ActivityRetentionPolicy {
    return { ...this.retentionPolicy };
  }

  subscribe(listener: (activity: KaryaActivity) => void | Promise<void>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeToEvents(): () => void {
    const unsubscribers = [
      this.eventBus.subscribe("AccountCreated", ({ account }) =>
        this.record({
          category: "system",
          verb: "created",
          eventType: "AccountCreated",
          title: `Created Account ${account.displayName}`,
          object: { id: account.id, type: "system", title: account.displayName },
          source: "account",
          occurredAt: account.createdAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("AccountUpdated", ({ account }) =>
        this.record({
          category: "system",
          verb: "edited",
          eventType: "AccountUpdated",
          title: `Updated Account ${account.displayName}`,
          object: { id: account.id, type: "system", title: account.displayName },
          source: "account",
          occurredAt: account.updatedAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("DeviceRegistered", ({ account, device }) =>
        this.record({
          category: "system",
          verb: "created",
          eventType: "DeviceRegistered",
          title: `Registered ${device.name}`,
          object: { id: device.id, type: "system", title: device.name },
          relatedObjects: [{ id: account.id, type: "system", title: account.displayName }],
          source: "account",
          occurredAt: device.registeredAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("DeviceRenamed", ({ device }) =>
        this.record({
          category: "system",
          verb: "edited",
          eventType: "DeviceRenamed",
          title: `Renamed Device ${device.name}`,
          object: { id: device.id, type: "system", title: device.name },
          source: "account",
          occurredAt: device.lastSeenAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("DeviceRemoved", ({ device }) =>
        this.record({
          category: "system",
          verb: "deleted",
          eventType: "DeviceRemoved",
          title: `Removed Device ${device.name}`,
          object: { id: device.id, type: "system", title: device.name },
          source: "account",
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("DeviceTrustChanged", ({ device }) =>
        this.record({
          category: "system",
          verb: "edited",
          eventType: "DeviceTrustChanged",
          title: `Changed trust for ${device.name}`,
          object: { id: device.id, type: "system", title: device.name },
          source: "account",
          metadata: { trustState: device.trustState },
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("ResourceCreated", async ({ resource }) => {
        if (resource.tags.includes("linked") || isFolderImportResource(resource) || isFolderImportChild(resource))
          return;
        await this.record({
          ...resourceActivity(resource, "created"),
          eventType: "ResourceCreated",
          occurredAt: resource.createdAt,
        });
      }),
      this.eventBus.subscribe("ResourceOpened", ({ resource, workspaceId, applicationId }) =>
        this.record({
          ...resourceActivity(resource, "opened", { workspaceId, applicationId }),
          eventType: "ResourceOpened",
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("ResourceRenamed", ({ resource }) =>
        this.record({
          ...resourceActivity(resource, "renamed"),
          eventType: "ResourceRenamed",
          occurredAt: resource.updatedAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("ResourceMoved", ({ resource, fromWorkspaceIds, toWorkspaceIds }) =>
        this.record({
          ...resourceActivity(resource, "moved"),
          eventType: "ResourceMoved",
          occurredAt: resource.updatedAt,
          metadata: {
            fromWorkspaceIds: JSON.stringify(fromWorkspaceIds),
            toWorkspaceIds: JSON.stringify(toWorkspaceIds),
          },
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("ResourceArchived", ({ resource }) =>
        this.record({
          ...resourceActivity(resource, "archived"),
          eventType: "ResourceArchived",
          occurredAt: resource.updatedAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("ResourceRestored", ({ resource }) =>
        this.record({
          ...resourceActivity(resource, "restored"),
          eventType: "ResourceRestored",
          occurredAt: resource.updatedAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("AutosaveCompleted", ({ resource, content }) =>
        this.record({
          ...resourceActivity(resource, "edited"),
          eventType: "ResourceContentChanged",
          occurredAt: content.updatedAt,
          description: `Edited ${resource.metadata.title}`,
          metadata: { revision: content.revision },
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("ResourceDeleted", ({ resource }) =>
        this.record({
          ...resourceActivity(resource, "deleted"),
          eventType: "ResourceDeleted",
          occurredAt: resource.updatedAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("CaptureCompleted", ({ capture, resource }) =>
        this.record({
          ...resourceActivity(resource, "created"),
          eventType: "CaptureCompleted",
          title: `Captured ${resource.metadata.title}`,
          occurredAt: resource.createdAt,
          metadata: { captureId: capture.id, kind: capture.kind },
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("CaptureFailed", ({ attemptedAt, reason, profileId }) =>
        this.record({
          category: "system",
          verb: "failed",
          eventType: "CaptureFailed",
          title: "Quick Capture failed",
          description: reason,
          object: { id: `capture-failed:${attemptedAt}`, type: "system" },
          profileId,
          source: "quick-capture",
          occurredAt: attemptedAt,
        }).then(() => undefined),
      ),
      this.eventBus.subscribe("ProfileCreated", ({ profile }) =>
        this.record(profileActivity(profile, "created", "ProfileCreated")).then(() => undefined),
      ),
      this.eventBus.subscribe("ProfileUpdated", ({ profile }) =>
        this.record(profileActivity(profile, "edited", "ProfileUpdated")).then(() => undefined),
      ),
      this.eventBus.subscribe("ActiveProfileChanged", ({ profile }) =>
        this.record(profileActivity(profile, "opened", "ActiveProfileChanged")).then(() => undefined),
      ),
      this.eventBus.subscribe(
        "ResourceReferenced",
        ({ resource, workspaceId }) => void this.record(resourceActivity(resource, "referenced", { workspaceId })),
      ),
      this.eventBus.subscribe(
        "ResourceDuplicated",
        ({ duplicate, source }) =>
          void this.record({
            ...resourceActivity(duplicate, "created"),
            description: `Created from ${source.metadata.title}`,
            relatedObjects: [{ id: source.id, type: "resource", title: source.metadata.title }],
          }),
      ),
      this.eventBus.subscribe("CalendarEventCreated", ({ event }) => void this.record(eventActivity(event, "created"))),
      this.eventBus.subscribe("CalendarEventUpdated", ({ event }) => void this.record(eventActivity(event, "edited"))),
      this.eventBus.subscribe(
        "CalendarEventArchived",
        ({ event }) => void this.record(eventActivity(event, "archived")),
      ),
      this.eventBus.subscribe("CalendarEventDeleted", ({ event }) => void this.record(eventActivity(event, "deleted"))),
      this.eventBus.subscribe("WorkspaceCreated", ({ workspace }) =>
        this.record({ ...workspaceActivity(workspace, "created"), eventType: "WorkspaceCreated" }).then(
          () => undefined,
        ),
      ),
      this.eventBus.subscribe("WorkspaceUpdated", ({ workspace }) =>
        this.record({ ...workspaceActivity(workspace, "edited"), eventType: "WorkspaceUpdated" }).then(() => undefined),
      ),
      this.eventBus.subscribe("ActiveWorkspaceChanged", ({ workspaceId }) => {
        this.activeWorkspaceId = workspaceId;
        return workspaceId
          ? this.record({
              category: "workspace",
              verb: "opened",
              eventType: "ActiveWorkspaceChanged",
              title: "Activated Workspace",
              object: { id: workspaceId, type: "workspace" },
              workspaceId,
              source: "workspace",
            }).then(() => undefined)
          : undefined;
      }),
      this.eventBus.subscribe(
        "WorkspaceOpened",
        ({ workspace }) => void this.record(workspaceActivity(workspace, "opened")),
      ),
      this.eventBus.subscribe(
        "WorkspaceClosed",
        ({ workspace }) => void this.record(workspaceActivity(workspace, "closed")),
      ),
      this.eventBus.subscribe("WorkspaceArchived", ({ workspace }) => {
        const wasActive = this.activeWorkspaceId === workspace.id;
        return void this.record({
          ...workspaceActivity(workspace, "archived"),
          eventType: "WorkspaceArchived",
          metadata: { wasActive },
        });
      }),
      this.eventBus.subscribe(
        "WorkspaceRestored",
        ({ workspace }) => void this.record(workspaceActivity(workspace, "restored")),
      ),
      this.eventBus.subscribe(
        "WorkspaceDeleted",
        ({ workspace }) => void this.record(workspaceActivity(workspace, "deleted")),
      ),
      this.eventBus.subscribe("ImportCompleted", ({ job }) => void this.record(importActivity(job, "imported"))),
      this.eventBus.subscribe("ImportFailed", ({ job }) => void this.record(importActivity(job, "failed"))),
      this.eventBus.subscribe(
        "ApplicationLaunched",
        ({ application, applicationId, workspaceId, profileId }) =>
          void this.record(applicationActivity(application, applicationId, workspaceId, profileId)),
      ),
      this.eventBus.subscribe(
        "NotificationCreated",
        ({ notification }) => void this.record(notificationActivity(notification)),
      ),
      this.eventBus.subscribe(
        "RelationshipCreated",
        ({ sourceId, sourceType, targetId, targetType, relationshipType }) =>
          void this.record({
            category: "relationship",
            verb: "related",
            title: `Added ${relationshipType} relationship`,
            object: { id: sourceId, type: sourceType },
            relatedObjects: [{ id: targetId, type: targetType }],
            source: "relationships",
            groupKey: `relationship:created:${sourceType}:${sourceId}`,
            metadata: { relationshipType },
          }),
      ),
      this.eventBus.subscribe(
        "RelationshipRemoved",
        ({ sourceId, sourceType, relationshipId }) =>
          void this.record({
            category: "relationship",
            verb: "deleted",
            title: "Removed relationship",
            object: { id: sourceId, type: sourceType },
            source: "relationships",
            groupKey: `relationship:removed:${sourceType}:${sourceId}`,
            metadata: { relationshipId },
          }),
      ),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private async publish(type: "ActivityRecorded" | "ActivityUpdated", activity: KaryaActivity): Promise<void> {
    await this.eventBus.publish(type, { activity });
    await this.eventBus.publish(type === "ActivityRecorded" ? "activity:recorded" : "activity:updated", { activity });
  }
}

function resourceActivity(
  resource: Resource,
  verb: RecordActivityRequest["verb"],
  options: { workspaceId?: EntityId; applicationId?: EntityId } = {},
): RecordActivityRequest {
  const category = resourceCategory(resource);
  const workspaceId = options.workspaceId ?? resource.primaryWorkspaceId ?? resource.workspaceRefs[0];
  return {
    category,
    verb,
    title: `${verbLabel(verb)} ${resource.metadata.title}`,
    description: resource.metadata.description,
    object: { id: resource.id, type: "resource", title: resource.metadata.title },
    profileId: resource.profileId,
    workspaceId,
    applicationId: options.applicationId,
    source: category === "task" ? "tasks" : category === "bookmark" ? "bookmarks" : "resources",
    groupKey: `${category}:${verb}:${resource.id}`,
    metadata: { kind: resource.metadata.kind, lifecycleState: resource.lifecycleState },
  };
}

function resourceUpdatedActivity(resource: Resource): RecordActivityRequest {
  const status = resource.metadata.attributes?.taskStatus;
  if (resourceCategory(resource) === "task" && status === "completed") return resourceActivity(resource, "completed");
  if (resourceCategory(resource) === "task" && status === "todo") return resourceActivity(resource, "reopened");
  return resourceActivity(resource, "edited");
}

function folderImportedActivity(folder: Resource): RecordActivityRequest {
  return {
    category: "resource",
    verb: "imported",
    title: `Imported ${folder.metadata.title}`,
    description: folder.metadata.description,
    object: { id: folder.id, type: "resource", title: folder.metadata.title },
    profileId: folder.profileId,
    workspaceId: folder.primaryWorkspaceId ?? folder.workspaceRefs[0],
    source: "imports",
    groupKey: `resource:imported:${folder.id}`,
    metadata: {
      kind: folder.metadata.kind,
      folderPath: readStringAttribute(folder, "folderPath") ?? readStringAttribute(folder, "contentSourcePath") ?? null,
    },
  };
}

function eventActivity(event: CalendarEvent, verb: RecordActivityRequest["verb"]): RecordActivityRequest {
  return {
    category: "calendar",
    verb,
    title: `${verbLabel(verb)} ${event.metadata.title}`,
    description: event.metadata.description,
    object: { id: event.id, type: "event", title: event.metadata.title },
    profileId: event.profileId,
    workspaceId: event.primaryWorkspaceId ?? event.workspaceRefs[0],
    source: "calendar",
    groupKey: `calendar:${verb}:${event.id}`,
    metadata: { lifecycleState: event.lifecycleState },
  };
}

function workspaceActivity(workspace: Workspace, verb: RecordActivityRequest["verb"]): RecordActivityRequest {
  return {
    category: "workspace",
    verb,
    title: `${verbLabel(verb)} ${workspace.name}`,
    description: workspace.metadata.description,
    object: { id: workspace.id, type: "workspace", title: workspace.name },
    profileId: workspace.profileId,
    workspaceId: workspace.id,
    source: "workspace",
    groupKey: `workspace:${verb}:${workspace.id}`,
    metadata: { lifecycleState: workspace.lifecycleState },
  };
}

function profileActivity(
  profile: Profile,
  verb: RecordActivityRequest["verb"],
  eventType: string,
): RecordActivityRequest {
  return {
    category: "profile",
    verb,
    eventType,
    title: `${verbLabel(verb)} ${profile.name}`,
    object: { id: profile.id, type: "profile", title: profile.name },
    profileId: profile.id,
    source: "profile",
    occurredAt: profile.updatedAt,
    metadata: { lifecycleState: profile.lifecycleState ?? "active" },
  };
}

function importActivity(job: ImportJob, verb: "imported" | "failed"): RecordActivityRequest {
  const count = job.summary ? job.summary.imported + job.summary.failed : undefined;
  return {
    category: "import",
    verb,
    title:
      verb === "failed" ? `Import failed: ${job.displayTitle ?? job.path}` : `Imported ${job.displayTitle ?? job.path}`,
    description: job.error ?? job.summary?.failures[0]?.message,
    object: { id: job.id, type: "import", title: job.displayTitle ?? job.path },
    source: "imports",
    groupKey: `import:${verb}:${job.type}`,
    metadata: { path: job.path, jobType: job.type, itemCount: count ?? 0 },
  };
}

function applicationActivity(
  application: InstalledApplication,
  applicationId: EntityId,
  workspaceId?: EntityId,
  profileId?: EntityId,
): RecordActivityRequest {
  return {
    category: "application",
    verb: "launched",
    title: `Launched ${application.metadata.name}`,
    description: application.metadata.description,
    object: { id: applicationId, type: "application", title: application.metadata.name },
    applicationId,
    workspaceId,
    profileId,
    source: "applications",
    groupKey: `application:launched:${applicationId}`,
    metadata: { platform: application.metadata.platform ?? null, category: application.metadata.category ?? null },
  };
}

function notificationActivity(notification: KaryaNotification): RecordActivityRequest {
  return {
    category: "notification",
    verb: "notified",
    title: notification.title,
    description: notification.description,
    object: { id: notification.id, type: "notification", title: notification.title },
    relatedObjects: notification.references.map((reference) => ({
      id: reference.id,
      type: reference.type,
      title: reference.title,
    })),
    workspaceId: notification.workspaceId,
    profileId: notification.profileId,
    source: notification.source,
    groupKey: `notification:${notification.category}:${notification.groupKey ?? notification.title}`,
    metadata: { status: notification.status, priority: notification.priority },
  };
}

function resourceCategory(resource: Resource): RecordActivityRequest["category"] {
  if (resource.metadata.kind === "task" || resource.type === "application/vnd.karya.task") return "task";
  if (resource.metadata.kind === "bookmark" || resource.type === "application/vnd.karya.bookmark") return "bookmark";
  return "resource";
}

function isFolderImportResource(resource: Resource): boolean {
  return (
    resource.metadata.kind === "folder" &&
    (resource.tags.includes("imported") || typeof resource.metadata.attributes?.folderImportStatus === "string")
  );
}

function isFolderImportChild(resource: Resource): boolean {
  return typeof resource.metadata.attributes?.folderParentId === "string";
}

function readStringAttribute(resource: Resource, key: string): string | undefined {
  const value = resource.metadata.attributes?.[key];
  return typeof value === "string" ? value : undefined;
}

function defaultGroupKey(request: RecordActivityRequest, occurredAt: string): string {
  return `${request.category}:${request.verb}:${request.object.type}:${request.object.id}:${occurredAt.slice(0, 10)}`;
}

function groupedTitle(title: string, count: number): string {
  return `${title} ${count} times today`;
}

function verbLabel(verb: RecordActivityRequest["verb"]): string {
  const labels: Record<RecordActivityRequest["verb"], string> = {
    created: "Created",
    edited: "Edited",
    opened: "Opened",
    closed: "Closed",
    completed: "Completed",
    reopened: "Reopened",
    due: "Due",
    overdue: "Overdue",
    archived: "Archived",
    restored: "Restored",
    deleted: "Deleted",
    imported: "Imported",
    failed: "Failed",
    linked: "Linked",
    launched: "Launched",
    referenced: "Referenced",
    related: "Related",
    moved: "Moved",
    renamed: "Renamed",
    notified: "Notification",
  };
  return labels[verb];
}

function mergeReferences(
  left: KaryaActivity["relatedObjects"],
  right: KaryaActivity["relatedObjects"],
): KaryaActivity["relatedObjects"] {
  return [...left, ...right].filter(
    (reference, index, all) =>
      all.findIndex((candidate) => candidate.id === reference.id && candidate.type === reference.type) === index,
  );
}

function matchesFilter(activity: KaryaActivity, filter: ActivityFilter): boolean {
  if (filter.eventType && activity.eventType !== filter.eventType) return false;
  if (filter.profileId && activity.profileId !== filter.profileId) return false;
  if (filter.workspaceId && activity.workspaceId !== filter.workspaceId) return false;
  if (filter.category && activity.category !== filter.category) return false;
  if (filter.applicationId && activity.applicationId !== filter.applicationId) return false;
  if (
    filter.objectId &&
    activity.object.id !== filter.objectId &&
    !activity.relatedObjects.some((reference) => reference.id === filter.objectId)
  )
    return false;
  if (
    filter.objectType &&
    activity.object.type !== filter.objectType &&
    !activity.relatedObjects.some((reference) => reference.type === filter.objectType)
  )
    return false;
  if (filter.dateFrom && activity.occurredAt.slice(0, 10) < filter.dateFrom) return false;
  if (filter.dateTo && activity.occurredAt.slice(0, 10) > filter.dateTo) return false;
  return true;
}

function compareActivities(left: KaryaActivity, right: KaryaActivity): number {
  return right.occurredAt.localeCompare(left.occurredAt) || right.id.localeCompare(left.id);
}

function deterministicActivityId(
  eventType: string,
  objectId: EntityId,
  occurredAt: string,
  workspaceId?: EntityId,
): EntityId {
  const value = `${eventType}|${objectId}|${workspaceId ?? ""}|${occurredAt}`;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `activity:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

class InMemoryActivityRepository implements ActivityRepository {
  private readonly activities = new Map<EntityId, KaryaActivity>();

  constructor(seed: KaryaActivity[]) {
    seed.forEach((activity) => this.activities.set(activity.id, cloneActivity(activity)));
  }

  async append(activity: KaryaActivity): Promise<void> {
    if (this.activities.has(activity.id)) return;
    this.activities.set(activity.id, cloneActivity(activity));
  }

  async list(): Promise<KaryaActivity[]> {
    return [...this.activities.values()].map(cloneActivity);
  }

  async get(id: EntityId): Promise<KaryaActivity | undefined> {
    const activity = this.activities.get(id);
    return activity ? cloneActivity(activity) : undefined;
  }
}

function cloneActivity(activity: KaryaActivity): KaryaActivity {
  return {
    ...activity,
    object: { ...activity.object },
    relatedObjects: activity.relatedObjects.map((reference) => ({ ...reference })),
    metadata: activity.metadata ? { ...activity.metadata } : undefined,
  };
}
