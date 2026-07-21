import type { EventBus } from "@karya/event-bus";
import type { SearchDocumentRepository } from "@karya/persistence";
import type {
  CalendarEvent,
  KaryaActivity,
  KaryaNotification,
  Profile,
  Resource,
  SearchDocument,
  SearchMatch,
  SearchResult,
  Workspace,
} from "@karya/types";
import type { SearchContext, SearchService } from "./contracts";

export class InMemorySearchService implements SearchService {
  private readonly documents = new Map<string, SearchDocument>();
  private readonly terms = new Map<string, Set<string>>();
  private readonly termsByDocument = new Map<string, string[]>();

  constructor(
    private readonly eventBus: EventBus,
    seed: SearchDocument[] = [],
    private readonly repository?: SearchDocumentRepository,
  ) {
    seed.forEach((document) => this.setDocument(document));
  }

  async loadPersistedIndex(): Promise<void> {
    if (!this.repository) return;

    this.clearMemoryIndex();
    const documents = await this.repository.list();
    documents.forEach((document) => this.setDocument(document));
    await this.publishIndexed();
  }

  subscribeToEvents(): () => void {
    const unsubscribeCreated = this.eventBus.subscribe("ResourceCreated", ({ resource }) =>
      this.indexResource(resource),
    );
    const unsubscribeUpdated = this.eventBus.subscribe("ResourceUpdated", ({ resource }) =>
      this.indexResource(resource),
    );
    const unsubscribeRenamed = this.eventBus.subscribe("ResourceRenamed", ({ resource }) =>
      this.indexResource(resource),
    );
    const unsubscribeMoved = this.eventBus.subscribe("ResourceMoved", ({ resource }) => this.indexResource(resource));
    const unsubscribeArchived = this.eventBus.subscribe("ResourceArchived", ({ resource }) =>
      this.removeResource(resource.id),
    );
    const unsubscribeRestored = this.eventBus.subscribe("ResourceRestored", ({ resource }) =>
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
    const unsubscribeWorkspaceRenamed = this.eventBus.subscribe("WorkspaceRenamed", ({ workspace }) =>
      this.indexWorkspace(workspace),
    );
    const unsubscribeWorkspaceArchived = this.eventBus.subscribe("WorkspaceArchived", ({ workspace }) =>
      this.removeWorkspace(workspace.id),
    );
    const unsubscribeWorkspaceRestored = this.eventBus.subscribe("WorkspaceRestored", ({ workspace }) =>
      this.indexWorkspace(workspace),
    );
    const unsubscribeWorkspaceDeleted = this.eventBus.subscribe("WorkspaceDeleted", ({ workspace }) =>
      this.removeWorkspace(workspace.id),
    );
    const unsubscribeProfileCreated = this.eventBus.subscribe("ProfileCreated", ({ profile }) =>
      this.indexProfile(profile),
    );
    const unsubscribeProfileUpdated = this.eventBus.subscribe("ProfileUpdated", ({ profile }) =>
      this.indexProfile(profile),
    );
    const unsubscribeProfileArchived = this.eventBus.subscribe("ProfileArchived", ({ profile }) =>
      this.removeProfile(profile.id),
    );
    const unsubscribeProfileRestored = this.eventBus.subscribe("ProfileRestored", ({ profile }) =>
      this.indexProfile(profile),
    );
    const unsubscribeProfileDeleted = this.eventBus.subscribe("ProfileDeleted", ({ profile }) =>
      this.removeProfile(profile.id),
    );

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeRenamed();
      unsubscribeMoved();
      unsubscribeArchived();
      unsubscribeRestored();
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
      unsubscribeWorkspaceRenamed();
      unsubscribeWorkspaceArchived();
      unsubscribeWorkspaceRestored();
      unsubscribeWorkspaceDeleted();
      unsubscribeProfileCreated();
      unsubscribeProfileUpdated();
      unsubscribeProfileArchived();
      unsubscribeProfileRestored();
      unsubscribeProfileDeleted();
    };
  }

  async indexResource(resource: Resource): Promise<void> {
    if (resource.lifecycleState !== "active" || isCalendarEventResource(resource)) {
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
    if (workspace.lifecycleState === "deleted" || workspace.lifecycleState === "archived") {
      await this.removeWorkspace(workspace.id);
      return;
    }

    await this.index([createWorkspaceDocument(workspace)]);
  }

  async removeWorkspace(workspaceId: string): Promise<void> {
    await this.removeDocument(`workspace:${workspaceId}`);
  }

  async indexProfile(profile: Profile): Promise<void> {
    if (profile.lifecycleState === "deleted" || profile.lifecycleState === "archived") {
      await this.removeProfile(profile.id);
      return;
    }
    await this.index([createProfileDocument(profile)]);
  }

  async removeProfile(profileId: string): Promise<void> {
    await this.removeDocument(`profile:${profileId}`);
  }

  async rebuild(documents: SearchDocument[]): Promise<void> {
    this.clearMemoryIndex();
    await this.repository?.clear();
    await this.index(documents);
  }

  async remove(documentId: string): Promise<void> {
    await this.removeDocument(documentId);
  }

  async index(documents: SearchDocument[]): Promise<void> {
    documents.forEach((document) => this.setDocument(document));
    if (this.repository) {
      await Promise.all(documents.map((document) => this.repository?.save(document)));
    }
    await this.publishIndexed();
  }

  async listDocuments(): Promise<SearchDocument[]> {
    return [...this.documents.values()];
  }

  async query(term: string, context: SearchContext = {}): Promise<SearchResult[]> {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    if (!normalizedTerm) {
      return [];
    }

    const candidateIds = new Set<string>();
    for (const [indexedTerm, ids] of this.terms) {
      if (!indexedTerm.includes(normalizedTerm)) continue;
      ids.forEach((id) => candidateIds.add(id));
    }
    const recentRanks = new Map((context.recentResourceIds ?? []).map((id, index) => [id, index]));
    return [...candidateIds]
      .map((id) => this.documents.get(id))
      .filter((document): document is SearchDocument => Boolean(document))
      .filter(
        (document) => !context.types || context.types.includes(document.type as "profile" | "workspace" | "resource"),
      )
      .map((document) => createResult(document, normalizedTerm, context, recentRanks))
      .filter((result): result is SearchResult & { matches: SearchMatch[] } => Boolean(result))
      .sort((left, right) => compareResults(left, right, context, recentRanks));
  }

  private async removeDocument(documentId: string): Promise<void> {
    this.removeTerms(documentId);
    this.documents.delete(documentId);
    await this.repository?.delete(documentId);
    await this.publishIndexed();
  }

  private setDocument(document: SearchDocument): void {
    this.removeTerms(document.id);
    this.documents.set(document.id, document);
    const terms = searchableFields(document).flatMap(({ value }) => tokenize(value));
    this.termsByDocument.set(document.id, terms);
    terms.forEach((term) => {
      const ids = this.terms.get(term) ?? new Set<string>();
      ids.add(document.id);
      this.terms.set(term, ids);
    });
  }

  private removeTerms(documentId: string): void {
    for (const term of this.termsByDocument.get(documentId) ?? []) {
      const ids = this.terms.get(term);
      ids?.delete(documentId);
      if (!ids?.size) this.terms.delete(term);
    }
    this.termsByDocument.delete(documentId);
  }

  private clearMemoryIndex(): void {
    this.documents.clear();
    this.terms.clear();
    this.termsByDocument.clear();
  }

  private async publishIndexed(): Promise<void> {
    await this.eventBus.publish("SearchIndexed", { documentCount: this.documents.size });
    await this.eventBus.publish("search:index-updated", { documentCount: this.documents.size });
  }
}

export function createResourceDocument(resource: Resource): SearchDocument {
  return {
    id: `resource:${resource.id}`,
    type: "resource",
    title: resource.metadata.title,
    subtitle: resource.metadata.description ?? resource.metadata.kind ?? resource.type,
    keywords: [
      ...resource.tags,
      ...resource.relationships.map((relationship) => relationship.type),
      resource.metadata.kind,
      resource.type,
      ...Object.entries(resource.metadata.attributes ?? {})
        .filter(([key, value]) => !key.toLocaleLowerCase().includes("content") && typeof value !== "object")
        .flatMap(([key, value]) => [key, String(value ?? "")]),
    ].filter(Boolean),
    sourceId: resource.id,
    profileId: resource.profileId,
    workspaceIds: resource.primaryWorkspaceId
      ? [resource.primaryWorkspaceId, ...resource.workspaceRefs.filter((id) => id !== resource.primaryWorkspaceId)]
      : resource.workspaceRefs,
    createdAt: resource.createdAt,
    updatedAt: resource.metadata.updatedAt ?? resource.updatedAt,
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

export function createWorkspaceDocument(workspace: Workspace): SearchDocument {
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
    profileId: workspace.profileId,
    workspaceIds: [workspace.id],
    createdAt: workspace.createdAt,
    updatedAt: workspace.metadata.updatedAt ?? workspace.updatedAt,
    lastOpenedAt: workspace.lastOpenedAt,
  };
}

export function createProfileDocument(profile: Profile): SearchDocument {
  return {
    id: `profile:${profile.id}`,
    type: "profile",
    title: profile.name,
    subtitle: profile.description ?? "Profile",
    keywords: [profile.template ?? "custom"],
    sourceId: profile.id,
    profileId: profile.id,
    createdAt: profile.createdAt,
  };
}

function searchableFields(document: SearchDocument): Array<{ field: SearchMatch["field"]; value: string }> {
  return [
    { field: "title", value: document.title },
    ...(document.subtitle ? [{ field: "subtitle" as const, value: document.subtitle }] : []),
    ...document.keywords.map((value) => ({ field: "keyword" as const, value })),
  ];
}

function tokenize(value: string): string[] {
  const normalized = value.toLocaleLowerCase();
  return [...new Set([normalized, ...normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean)])];
}

function createResult(
  document: SearchDocument,
  term: string,
  context: SearchContext,
  recentRanks: Map<string, number>,
): SearchResult | undefined {
  const matches = searchableFields(document)
    .map(({ field, value }) => matchField(field, value, term))
    .filter((match): match is SearchMatch => Boolean(match));
  if (!matches.length) return undefined;
  const best = Math.max(...matches.map((match) => matchPriority(match.kind)));
  const contextBoost =
    document.type === "resource" &&
    context.activeWorkspaceId &&
    document.workspaceIds?.includes(context.activeWorkspaceId)
      ? 40
      : 0;
  const recentBoost =
    document.type === "resource" && recentRanks.has(document.sourceId)
      ? Math.max(1, 20 - (recentRanks.get(document.sourceId) ?? 0))
      : 0;
  return { document, matches, score: best * 100 + contextBoost + recentBoost };
}

function matchField(field: SearchMatch["field"], value: string, term: string): SearchMatch | undefined {
  const normalized = value.toLocaleLowerCase();
  const start = normalized.indexOf(term);
  if (start < 0) return undefined;
  const kind =
    normalized === term
      ? "exact"
      : start === 0
        ? "prefix"
        : /[^\p{L}\p{N}]/u.test(normalized[start - 1] ?? "")
          ? "word-boundary"
          : "contains";
  return { field, kind, start, length: term.length };
}

function matchPriority(kind: SearchMatch["kind"]): number {
  return kind === "exact" ? 4 : kind === "prefix" ? 3 : kind === "word-boundary" ? 2 : 1;
}

function compareResults(
  left: SearchResult,
  right: SearchResult,
  context: SearchContext,
  recentRanks: Map<string, number>,
): number {
  if (left.score !== right.score) return right.score - left.score;
  const leftOpened = left.document.lastOpenedAt ?? "";
  const rightOpened = right.document.lastOpenedAt ?? "";
  if (leftOpened !== rightOpened) return rightOpened.localeCompare(leftOpened);
  const leftRecent = recentRanks.get(left.document.sourceId) ?? Number.MAX_SAFE_INTEGER;
  const rightRecent = recentRanks.get(right.document.sourceId) ?? Number.MAX_SAFE_INTEGER;
  if (leftRecent !== rightRecent) return leftRecent - rightRecent;
  const leftModified = left.document.updatedAt ?? left.document.createdAt ?? "";
  const rightModified = right.document.updatedAt ?? right.document.createdAt ?? "";
  if (leftModified !== rightModified) return rightModified.localeCompare(leftModified);
  const byName = left.document.title.localeCompare(right.document.title, undefined, { sensitivity: "base" });
  return byName || left.document.id.localeCompare(right.document.id);
}
