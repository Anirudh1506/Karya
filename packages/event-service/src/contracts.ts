import type { CalendarEvent, EntityId, LifecycleState } from "@karya/types";

export type CreateCalendarEventRequest = Pick<CalendarEvent, "owner" | "profileId" | "metadata"> & {
  id?: EntityId;
  workspaceRefs?: EntityId[];
  primaryWorkspaceId?: EntityId;
  defaultSpace?: CalendarEvent["defaultSpace"];
  tags?: string[];
  relationships?: CalendarEvent["relationships"];
  permissions?: CalendarEvent["permissions"];
  versionInfo?: CalendarEvent["versionInfo"];
};

export interface UpdateCalendarEventRequest {
  id: EntityId;
  owner?: EntityId;
  profileId?: EntityId;
  metadata?: Partial<CalendarEvent["metadata"]>;
  tags?: string[];
  workspaceRefs?: EntityId[];
  primaryWorkspaceId?: EntityId;
  defaultSpace?: CalendarEvent["defaultSpace"];
  relationships?: CalendarEvent["relationships"];
}

export interface CalendarEventService {
  create(request: CreateCalendarEventRequest): Promise<CalendarEvent>;
  update(request: UpdateCalendarEventRequest): Promise<CalendarEvent>;
  archive(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<CalendarEvent>;
  delete(id: EntityId): Promise<void>;
  updateLifecycle(id: EntityId, lifecycleState: LifecycleState): Promise<CalendarEvent>;
  listEvents(): Promise<CalendarEvent[]>;
  getEvent(id: EntityId): Promise<CalendarEvent | undefined>;
}
