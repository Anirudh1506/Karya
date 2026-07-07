import type { EventBus } from "@karya/event-bus";
import type { CalendarEvent, EntityId, LifecycleState } from "@karya/types";
import type { CalendarEventService, CreateCalendarEventRequest, UpdateCalendarEventRequest } from "./contracts";

export class InMemoryCalendarEventService implements CalendarEventService {
  private readonly events = new Map<EntityId, CalendarEvent>();

  constructor(
    private readonly eventBus: EventBus,
    seed: CalendarEvent[] = [],
  ) {
    seed.forEach((event) => this.events.set(event.id, cloneEvent(event)));
  }

  async listEvents(): Promise<CalendarEvent[]> {
    return [...this.events.values()].map(cloneEvent);
  }

  async getEvent(id: EntityId): Promise<CalendarEvent | undefined> {
    const event = this.events.get(id);
    return event ? cloneEvent(event) : undefined;
  }

  async create(request: CreateCalendarEventRequest): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      id: request.id ?? crypto.randomUUID(),
      objectType: "event",
      eventType: "calendar-event",
      type: "application/vnd.karya.calendar-event",
      metadata: {
        title: request.metadata.title,
        description: request.metadata.description,
        kind: "calendar-event",
        createdAt: request.metadata.createdAt ?? now,
        updatedAt: request.metadata.updatedAt ?? now,
        createdBy: request.metadata.createdBy ?? request.owner,
        updatedBy: request.metadata.updatedBy ?? request.owner,
        importance: request.metadata.importance,
        color: request.metadata.color,
        attributes: request.metadata.attributes ?? {},
      },
      owner: request.owner,
      profileId: request.profileId,
      workspaceRefs: request.workspaceRefs ?? [],
      primaryWorkspaceId: request.primaryWorkspaceId,
      defaultSpace: request.defaultSpace ?? "none",
      tags: request.tags ?? [],
      relationships: request.relationships ?? [],
      permissions: request.permissions,
      versionInfo: request.versionInfo ?? { version: 1 },
      status: "active",
      lifecycleState: "active",
      createdAt: now,
      updatedAt: now,
    };

    this.events.set(event.id, cloneEvent(event));
    await this.eventBus.publish("CalendarEventCreated", { event });
    await this.eventBus.publish("event:created", { event });
    return cloneEvent(event);
  }

  async update(request: UpdateCalendarEventRequest): Promise<CalendarEvent> {
    const current = await this.requireEvent(request.id);
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      ...current,
      owner: request.owner ?? current.owner,
      profileId: request.profileId ?? current.profileId,
      workspaceRefs: request.workspaceRefs ?? current.workspaceRefs,
      primaryWorkspaceId: request.primaryWorkspaceId ?? current.primaryWorkspaceId,
      defaultSpace: request.defaultSpace ?? current.defaultSpace,
      tags: request.tags ?? current.tags,
      relationships: request.relationships ?? current.relationships,
      metadata: request.metadata
        ? {
            ...current.metadata,
            ...request.metadata,
            attributes: request.metadata.attributes ?? current.metadata.attributes,
            updatedAt: now,
          }
        : current.metadata,
      updatedAt: now,
    };

    this.events.set(event.id, cloneEvent(event));
    await this.eventBus.publish("CalendarEventUpdated", { event });
    await this.eventBus.publish("event:updated", { event });
    return cloneEvent(event);
  }

  async archive(id: EntityId): Promise<void> {
    await this.updateLifecycle(id, "archived");
  }

  async restore(id: EntityId): Promise<CalendarEvent> {
    return this.updateLifecycle(id, "active");
  }

  async delete(id: EntityId): Promise<void> {
    await this.updateLifecycle(id, "deleted");
  }

  async updateLifecycle(id: EntityId, lifecycleState: LifecycleState): Promise<CalendarEvent> {
    const current = await this.requireEvent(id);
    const now = new Date().toISOString();
    const event: CalendarEvent = {
      ...current,
      status: lifecycleState,
      lifecycleState,
      metadata: {
        ...current.metadata,
        updatedAt: now,
      },
      updatedAt: now,
    };

    this.events.set(event.id, cloneEvent(event));
    if (lifecycleState === "deleted") {
      await this.eventBus.publish("CalendarEventDeleted", { event });
      await this.eventBus.publish("event:deleted", { eventId: id });
    } else if (lifecycleState === "archived") {
      await this.eventBus.publish("CalendarEventArchived", { event });
      await this.eventBus.publish("event:updated", { event });
    } else {
      await this.eventBus.publish("CalendarEventUpdated", { event });
      await this.eventBus.publish("event:updated", { event });
    }
    return cloneEvent(event);
  }

  private async requireEvent(id: EntityId): Promise<CalendarEvent> {
    const event = this.events.get(id);
    if (!event) {
      throw new Error(`Calendar event not found: ${id}`);
    }
    return cloneEvent(event);
  }
}

function cloneEvent(event: CalendarEvent): CalendarEvent {
  return {
    ...event,
    workspaceRefs: [...event.workspaceRefs],
    tags: [...event.tags],
    relationships: event.relationships.map((relationship) => ({
      ...relationship,
      metadata: relationship.metadata ? { ...relationship.metadata } : undefined,
    })),
    metadata: {
      ...event.metadata,
      attributes: event.metadata.attributes ? { ...event.metadata.attributes } : undefined,
    },
    permissions: event.permissions
      ? {
          ownerCanEdit: event.permissions.ownerCanEdit,
          sharedWith: [...event.permissions.sharedWith],
        }
      : undefined,
    versionInfo: event.versionInfo ? { ...event.versionInfo } : undefined,
  };
}
