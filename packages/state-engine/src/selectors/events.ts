import type { CalendarEvent, EntityId } from "@karya/types";
import type { EventState } from "../types";

export function deriveEvents(events: CalendarEvent[]): EventState {
  const activeEvents = events.filter((event) => event.lifecycleState === "active");
  const archivedEvents = events.filter((event) => event.lifecycleState === "archived");
  const deletedEvents = events.filter((event) => event.lifecycleState === "deleted");

  return {
    all: events,
    activeEvents,
    archivedEvents,
    deletedEvents,
    metadataById: Object.fromEntries(events.map((event) => [event.id, event.metadata])) as Record<EntityId, CalendarEvent["metadata"]>,
    activeCount: activeEvents.length,
    archivedCount: archivedEvents.length,
    deletedCount: deletedEvents.length,
    totalCount: events.length,
  };
}
