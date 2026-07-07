import type { EventBus } from "@karya/event-bus";
import type { CalendarEvent, EntityId, ImportJob, InstalledApplication, KaryaActivity, KaryaNotification, Resource, Workspace } from "@karya/types";
import type { ActivityFilter, ActivityService, RecordActivityRequest } from "./contracts";

export class InMemoryActivityService implements ActivityService {
  private readonly activities = new Map<EntityId, KaryaActivity>();

  constructor(
    private readonly eventBus: EventBus,
    seed: KaryaActivity[] = [],
  ) {
    seed.forEach((activity) => this.activities.set(activity.id, cloneActivity(activity)));
  }

  async record(request: RecordActivityRequest): Promise<KaryaActivity> {
    const now = new Date().toISOString();
    const occurredAt = request.occurredAt ?? now;
    const groupKey = request.groupKey ?? defaultGroupKey(request, occurredAt);
    const existing = this.findGroup(groupKey, occurredAt);
    const activity: KaryaActivity = existing
      ? {
          ...existing,
          title: groupedTitle(request.title, existing.groupCount + 1),
          description: request.description ?? existing.description,
          groupCount: existing.groupCount + 1,
          relatedObjects: mergeReferences(existing.relatedObjects, request.relatedObjects ?? []),
          updatedAt: now,
          occurredAt,
          metadata: { ...existing.metadata, ...request.metadata },
        }
      : {
          id: crypto.randomUUID(),
          category: request.category,
          verb: request.verb,
          title: request.title,
          description: request.description,
          object: { ...request.object },
          relatedObjects: (request.relatedObjects ?? []).map((reference) => ({ ...reference })),
          profileId: request.profileId,
          workspaceId: request.workspaceId,
          applicationId: request.applicationId,
          source: request.source,
          groupKey,
          groupCount: 1,
          createdAt: now,
          updatedAt: now,
          occurredAt,
          metadata: request.metadata ? { ...request.metadata } : undefined,
        };

    this.activities.set(activity.id, cloneActivity(activity));
    await this.publish(existing ? "ActivityUpdated" : "ActivityRecorded", activity);
    return cloneActivity(activity);
  }

  async list(filter: ActivityFilter = {}): Promise<KaryaActivity[]> {
    return [...this.activities.values()]
      .filter((activity) => matchesFilter(activity, filter))
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .slice(0, filter.limit ?? 500)
      .map(cloneActivity);
  }

  async get(id: EntityId): Promise<KaryaActivity | undefined> {
    const activity = this.activities.get(id);
    return activity ? cloneActivity(activity) : undefined;
  }

  subscribeToEvents(): () => void {
    const unsubscribers = [
      this.eventBus.subscribe("ResourceCreated", ({ resource }) => {
        if (isFolderImportResource(resource) || isFolderImportChild(resource)) return;
        void this.record(resourceActivity(resource, "created"));
      }),
      this.eventBus.subscribe("ResourceUpdated", ({ resource }) => {
        if (isFolderImportResource(resource) || isFolderImportChild(resource)) return;
        void this.record(resourceUpdatedActivity(resource));
      }),
      this.eventBus.subscribe("FolderImported", ({ folder }) => void this.record(folderImportedActivity(folder))),
      this.eventBus.subscribe("ResourceOpened", ({ resource, workspaceId, applicationId }) => void this.record(resourceActivity(resource, "opened", { workspaceId, applicationId }))),
      this.eventBus.subscribe("ResourceRenamed", ({ resource }) => void this.record(resourceActivity(resource, "renamed"))),
      this.eventBus.subscribe("ResourceMoved", ({ resource }) => void this.record(resourceActivity(resource, "moved"))),
      this.eventBus.subscribe("ResourceArchived", ({ resource }) => void this.record(resourceActivity(resource, "archived"))),
      this.eventBus.subscribe("ResourceRestored", ({ resource }) => void this.record(resourceActivity(resource, "restored"))),
      this.eventBus.subscribe("ResourceDeleted", ({ resource }) => void this.record(resourceActivity(resource, "deleted"))),
      this.eventBus.subscribe("ResourceReferenced", ({ resource, workspaceId }) => void this.record(resourceActivity(resource, "referenced", { workspaceId }))),
      this.eventBus.subscribe("ResourceDuplicated", ({ duplicate, source }) => void this.record({
        ...resourceActivity(duplicate, "created"),
        description: `Created from ${source.metadata.title}`,
        relatedObjects: [{ id: source.id, type: "resource", title: source.metadata.title }],
      })),
      this.eventBus.subscribe("CalendarEventCreated", ({ event }) => void this.record(eventActivity(event, "created"))),
      this.eventBus.subscribe("CalendarEventUpdated", ({ event }) => void this.record(eventActivity(event, "edited"))),
      this.eventBus.subscribe("CalendarEventArchived", ({ event }) => void this.record(eventActivity(event, "archived"))),
      this.eventBus.subscribe("CalendarEventDeleted", ({ event }) => void this.record(eventActivity(event, "deleted"))),
      this.eventBus.subscribe("WorkspaceCreated", ({ workspace }) => void this.record(workspaceActivity(workspace, "created"))),
      this.eventBus.subscribe("WorkspaceOpened", ({ workspace }) => void this.record(workspaceActivity(workspace, "opened"))),
      this.eventBus.subscribe("WorkspaceClosed", ({ workspace }) => void this.record(workspaceActivity(workspace, "closed"))),
      this.eventBus.subscribe("WorkspaceArchived", ({ workspace }) => void this.record(workspaceActivity(workspace, "archived"))),
      this.eventBus.subscribe("WorkspaceRestored", ({ workspace }) => void this.record(workspaceActivity(workspace, "restored"))),
      this.eventBus.subscribe("WorkspaceDeleted", ({ workspace }) => void this.record(workspaceActivity(workspace, "deleted"))),
      this.eventBus.subscribe("ImportCompleted", ({ job }) => void this.record(importActivity(job, "imported"))),
      this.eventBus.subscribe("ImportFailed", ({ job }) => void this.record(importActivity(job, "failed"))),
      this.eventBus.subscribe("ApplicationLaunched", ({ application, applicationId, workspaceId, profileId }) => void this.record(applicationActivity(application, applicationId, workspaceId, profileId))),
      this.eventBus.subscribe("NotificationCreated", ({ notification }) => void this.record(notificationActivity(notification))),
      this.eventBus.subscribe("RelationshipCreated", ({ sourceId, sourceType, targetId, targetType, relationshipType }) => void this.record({
        category: "relationship",
        verb: "related",
        title: `Added ${relationshipType} relationship`,
        object: { id: sourceId, type: sourceType },
        relatedObjects: [{ id: targetId, type: targetType }],
        source: "relationships",
        groupKey: `relationship:created:${sourceType}:${sourceId}`,
        metadata: { relationshipType },
      })),
      this.eventBus.subscribe("RelationshipRemoved", ({ sourceId, sourceType, relationshipId }) => void this.record({
        category: "relationship",
        verb: "deleted",
        title: "Removed relationship",
        object: { id: sourceId, type: sourceType },
        source: "relationships",
        groupKey: `relationship:removed:${sourceType}:${sourceId}`,
        metadata: { relationshipId },
      })),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private findGroup(groupKey: string, occurredAt: string): KaryaActivity | undefined {
    const dateKey = occurredAt.slice(0, 10);
    return [...this.activities.values()].find((activity) => activity.groupKey === groupKey && activity.occurredAt.slice(0, 10) === dateKey);
  }

  private async publish(type: "ActivityRecorded" | "ActivityUpdated", activity: KaryaActivity): Promise<void> {
    await this.eventBus.publish(type, { activity });
    await this.eventBus.publish(type === "ActivityRecorded" ? "activity:recorded" : "activity:updated", { activity });
  }
}

function resourceActivity(resource: Resource, verb: RecordActivityRequest["verb"], options: { workspaceId?: EntityId; applicationId?: EntityId } = {}): RecordActivityRequest {
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

function importActivity(job: ImportJob, verb: "imported" | "failed"): RecordActivityRequest {
  const count = job.summary ? job.summary.imported + job.summary.failed : undefined;
  return {
    category: "import",
    verb,
    title: verb === "failed" ? `Import failed: ${job.displayTitle ?? job.path}` : `Imported ${job.displayTitle ?? job.path}`,
    description: job.error ?? job.summary?.failures[0]?.message,
    object: { id: job.id, type: "import", title: job.displayTitle ?? job.path },
    source: "imports",
    groupKey: `import:${verb}:${job.type}`,
    metadata: { path: job.path, jobType: job.type, itemCount: count ?? 0 },
  };
}

function applicationActivity(application: InstalledApplication, applicationId: EntityId, workspaceId?: EntityId, profileId?: EntityId): RecordActivityRequest {
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
    relatedObjects: notification.references.map((reference) => ({ id: reference.id, type: reference.type, title: reference.title })),
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
  return resource.metadata.kind === "folder"
    && (resource.tags.includes("imported") || typeof resource.metadata.attributes?.folderImportStatus === "string");
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

function mergeReferences(left: KaryaActivity["relatedObjects"], right: KaryaActivity["relatedObjects"]): KaryaActivity["relatedObjects"] {
  return [...left, ...right].filter((reference, index, all) => all.findIndex((candidate) => candidate.id === reference.id && candidate.type === reference.type) === index);
}

function matchesFilter(activity: KaryaActivity, filter: ActivityFilter): boolean {
  if (filter.profileId && activity.profileId !== filter.profileId) return false;
  if (filter.workspaceId && activity.workspaceId !== filter.workspaceId) return false;
  if (filter.category && activity.category !== filter.category) return false;
  if (filter.applicationId && activity.applicationId !== filter.applicationId) return false;
  if (filter.objectId && activity.object.id !== filter.objectId && !activity.relatedObjects.some((reference) => reference.id === filter.objectId)) return false;
  if (filter.objectType && activity.object.type !== filter.objectType && !activity.relatedObjects.some((reference) => reference.type === filter.objectType)) return false;
  if (filter.dateFrom && activity.occurredAt.slice(0, 10) < filter.dateFrom) return false;
  if (filter.dateTo && activity.occurredAt.slice(0, 10) > filter.dateTo) return false;
  return true;
}

function cloneActivity(activity: KaryaActivity): KaryaActivity {
  return {
    ...activity,
    object: { ...activity.object },
    relatedObjects: activity.relatedObjects.map((reference) => ({ ...reference })),
    metadata: activity.metadata ? { ...activity.metadata } : undefined,
  };
}
