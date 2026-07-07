import type { EventBus } from "@karya/event-bus";
import type { SearchDocumentRepository } from "@karya/persistence";
import type { CalendarEvent, KaryaActivity, KaryaNotification, Resource, SearchDocument, SearchResult, Workspace } from "@karya/types";
import type { SearchService } from "./contracts";

export class InMemorySearchService implements SearchService {
  private readonly documents = new Map<string, SearchDocument>();

  constructor(
    private readonly eventBus: EventBus,
    seed: SearchDocument[] = [],
    private readonly repository?: SearchDocumentRepository,
  ) {
    seed.forEach((document) => this.documents.set(document.id, document));
  }

  async loadPersistedIndex(): Promise<void> {
    if (!this.repository) return;

    this.documents.clear();
    const documents = await this.repository.list();
    documents.forEach((document) => this.documents.set(document.id, document));
    await this.publishIndexed();
  }

  subscribeToEvents(): () => void {
    const unsubscribeCreated = this.eventBus.subscribe("ResourceCreated", ({ resource }) =>
      this.indexResource(resource),
    );
    const unsubscribeUpdated = this.eventBus.subscribe("ResourceUpdated", ({ resource }) =>
      this.indexResource(resource),
    );
    const unsubscribeDeleted = this.eventBus.subscribe("ResourceDeleted", ({ resource }) =>
      this.removeResource(resource.id),
    );
    const unsubscribeEventCreated = this.eventBus.subscribe("CalendarEventCreated", ({ event }) =>
      this.indexEvent(event),
    );
    const unsubscribeEventUpdated = this.eventBus.subscribe("CalendarEventUpdated", ({ event }) =>
      this.indexEvent(event),
    );
    const unsubscribeEventArchived = this.eventBus.subscribe("CalendarEventArchived", ({ event }) =>
      this.indexEvent(event),
    );
    const unsubscribeEventDeleted = this.eventBus.subscribe("CalendarEventDeleted", ({ event }) =>
      this.removeEvent(event.id),
    );
    const unsubscribeNotificationCreated = this.eventBus.subscribe("NotificationCreated", ({ notification }) =>
      this.indexNotification(notification),
    );
    const unsubscribeNotificationUpdated = this.eventBus.subscribe("NotificationUpdated", ({ notification }) =>
      this.indexNotification(notification),
    );
    const unsubscribeNotificationDeleted = this.eventBus.subscribe("NotificationDeleted", ({ notification }) =>
      this.removeNotification(notification.id),
    );
    const unsubscribeActivityRecorded = this.eventBus.subscribe("ActivityRecorded", ({ activity }) =>
      this.indexActivity(activity),
    );
    const unsubscribeActivityUpdated = this.eventBus.subscribe("ActivityUpdated", ({ activity }) =>
      this.indexActivity(activity),
    );
    const unsubscribeWorkspaceCreated = this.eventBus.subscribe("WorkspaceCreated", ({ workspace }) =>
      this.indexWorkspace(workspace),
    );
    const unsubscribeWorkspaceUpdated = this.eventBus.subscribe("WorkspaceUpdated", ({ workspace }) =>
      this.indexWorkspace(workspace),
    );
    const unsubscribeWorkspaceDeleted = this.eventBus.subscribe("WorkspaceDeleted", ({ workspace }) =>
      this.removeWorkspace(workspace.id),
    );

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeEventCreated();
      unsubscribeEventUpdated();
      unsubscribeEventArchived();
      unsubscribeEventDeleted();
      unsubscribeNotificationCreated();
      unsubscribeNotificationUpdated();
      unsubscribeNotificationDeleted();
      unsubscribeActivityRecorded();
      unsubscribeActivityUpdated();
      unsubscribeWorkspaceCreated();
      unsubscribeWorkspaceUpdated();
      unsubscribeWorkspaceDeleted();
    };
  }

  async indexResource(resource: Resource): Promise<void> {
    if (resource.lifecycleState === "deleted" || isCalendarEventResource(resource)) {
      await this.removeResource(resource.id);
      return;
    }

    await this.index([createResourceDocument(resource)]);
  }

  async removeResource(resourceId: string): Promise<void> {
    await this.removeDocument(`resource:${resourceId}`);
  }

  async indexEvent(event: CalendarEvent): Promise<void> {
    if (event.lifecycleState === "deleted") {
      await this.removeEvent(event.id);
      return;
    }

    await this.index([createEventDocument(event)]);
  }

  async removeEvent(eventId: string): Promise<void> {
    await this.removeDocument(`event:${eventId}`);
  }

  async indexNotification(notification: KaryaNotification): Promise<void> {
    if (notification.status === "deleted") {
      await this.removeNotification(notification.id);
      return;
    }

    await this.index([createNotificationDocument(notification)]);
  }

  async removeNotification(notificationId: string): Promise<void> {
    await this.removeDocument(`notification:${notificationId}`);
  }

  async indexActivity(activity: KaryaActivity): Promise<void> {
    await this.index([createActivityDocument(activity)]);
  }

  async indexWorkspace(workspace: Workspace): Promise<void> {
    if (workspace.lifecycleState === "deleted") {
      await this.removeWorkspace(workspace.id);
      return;
    }

    await this.index([createWorkspaceDocument(workspace)]);
  }

  async removeWorkspace(workspaceId: string): Promise<void> {
    await this.removeDocument(`workspace:${workspaceId}`);
  }

  async remove(documentId: string): Promise<void> {
    await this.removeDocument(documentId);
  }

  async index(documents: SearchDocument[]): Promise<void> {
    documents.forEach((document) => this.documents.set(document.id, document));
    if (this.repository) {
      await Promise.all(documents.map((document) => this.repository?.save(document)));
    }
    await this.publishIndexed();
  }

  async listDocuments(): Promise<SearchDocument[]> {
    return [...this.documents.values()];
  }

  async query(term: string): Promise<SearchResult[]> {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    if (!normalizedTerm) {
      return [];
    }

    return [...this.documents.values()]
      .map((document) => ({ document, score: this.scoreDocument(document, normalizedTerm) }))
      .filter((result) => result.score > 0)
      .sort((left, right) => right.score - left.score);
  }

  private scoreDocument(document: SearchDocument, term: string): number {
    const title = document.title.toLocaleLowerCase();
    const subtitle = document.subtitle?.toLocaleLowerCase() ?? "";
    const keywords = document.keywords.join(" ").toLocaleLowerCase();
    let score = 0;

    if (title === term) score += 100;
    if (title.includes(term)) score += 50;
    if (subtitle.includes(term)) score += 20;
    if (keywords.includes(term)) score += 10;

    return score;
  }

  private async removeDocument(documentId: string): Promise<void> {
    this.documents.delete(documentId);
    await this.repository?.delete(documentId);
    await this.publishIndexed();
  }

  private async publishIndexed(): Promise<void> {
    await this.eventBus.publish("SearchIndexed", { documentCount: this.documents.size });
    await this.eventBus.publish("search:index-updated", { documentCount: this.documents.size });
  }
}

function createResourceDocument(resource: Resource): SearchDocument {
  return {
    id: `resource:${resource.id}`,
    type: "resource",
    title: resource.metadata.title,
    subtitle: resource.type,
    keywords: [
      ...resource.tags,
      ...resource.relationships.map((relationship) => relationship.type),
      ...resource.workspaceRefs,
      readStringAttribute(resource, "noteOrigin") ?? "",
      readStringAttribute(resource, "noteHeadings") ?? "",
      readStringAttribute(resource, "noteContent") ?? "",
      readStringAttribute(resource, "noteIndexedContent") ?? "",
      readStringAttribute(resource, "taskDescription") ?? "",
      readStringAttribute(resource, "taskDescriptionText") ?? "",
      readStringAttribute(resource, "taskChecklistItems") ?? "",
      readStringAttribute(resource, "taskLabels") ?? "",
      readStringAttribute(resource, "taskStatus") ?? "",
      readStringAttribute(resource, "taskPriority") ?? "",
      readStringAttribute(resource, "taskDueDate") ?? "",
      readStringAttribute(resource, "taskReminderDate") ?? "",
      readStringAttribute(resource, "taskReminderTime") ?? "",
      resource.lifecycleState,
    ].filter(Boolean),
    sourceId: resource.id,
  };
}

function isCalendarEventResource(resource: Resource): boolean {
  return resource.metadata.kind === "calendar-event" || resource.type === "application/vnd.karya.calendar-event";
}

function createEventDocument(event: CalendarEvent): SearchDocument {
  return {
    id: `event:${event.id}`,
    type: "event",
    title: event.metadata.title,
    subtitle: "Calendar Event",
    keywords: [
      ...event.tags,
      ...event.relationships.map((relationship) => relationship.type),
      ...event.workspaceRefs,
      readStringAttribute(event, "calendarDescription") ?? "",
      readStringAttribute(event, "calendarStartDate") ?? "",
      readStringAttribute(event, "calendarStartTime") ?? "",
      readStringAttribute(event, "calendarEndDate") ?? "",
      readStringAttribute(event, "calendarEndTime") ?? "",
      readStringAttribute(event, "calendarLocation") ?? "",
      readStringAttribute(event, "calendarUrl") ?? "",
      readStringAttribute(event, "calendarCategory") ?? "",
      readStringAttribute(event, "calendarLabels") ?? "",
      readStringAttribute(event, "calendarSearchText") ?? "",
      event.lifecycleState,
    ].filter(Boolean),
    sourceId: event.id,
  };
}

function createNotificationDocument(notification: KaryaNotification): SearchDocument {
  return {
    id: `notification:${notification.id}`,
    type: "notification",
    title: notification.title,
    subtitle: notification.description ?? "Notification",
    keywords: [
      notification.category,
      notification.source,
      notification.status,
      notification.priority,
      notification.workspaceId ?? "",
      notification.profileId ?? "",
      ...notification.references.map((reference) => reference.title ?? reference.id),
      ...notification.actions.map((action) => action.label),
    ].filter(Boolean),
    sourceId: notification.id,
  };
}

function createActivityDocument(activity: KaryaActivity): SearchDocument {
  return {
    id: `activity:${activity.id}`,
    type: "activity",
    title: activity.title,
    subtitle: `${activity.category} ${activity.verb}`,
    keywords: [
      "activity",
      "timeline",
      "recent",
      "changes",
      "changed",
      activity.category,
      activity.verb,
      activity.source,
      activity.workspaceId ?? "",
      activity.profileId ?? "",
      activity.applicationId ?? "",
      activity.object.title ?? activity.object.id,
      activity.object.type,
      activity.occurredAt.slice(0, 10),
      ...activity.relatedObjects.map((reference) => reference.title ?? reference.id),
      ...Object.values(activity.metadata ?? {}).map(String),
    ].filter(Boolean),
    sourceId: activity.id,
  };
}

function readStringAttribute(item: Pick<Resource, "metadata">, key: string): string | undefined {
  const value = item.metadata.attributes?.[key];
  return typeof value === "string" ? value : undefined;
}

function createWorkspaceDocument(workspace: Workspace): SearchDocument {
  return {
    id: `workspace:${workspace.id}`,
    type: "workspace",
    title: workspace.name,
    subtitle: workspace.metadata.description ?? "Workspace",
    keywords: [
      workspace.lifecycleState,
      workspace.pinned ? "pinned" : "",
      workspace.favorite ? "favorite" : "",
      ...(workspace.metadata.templateId ? [workspace.metadata.templateId] : []),
      ...workspace.resourceRefs,
    ].filter(Boolean),
    sourceId: workspace.id,
  };
}
