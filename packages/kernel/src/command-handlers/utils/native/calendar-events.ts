import type { CalendarEvent, Resource } from "@karya/types";
import type { CommandContext } from "../resource-context";
import { resolveImportDestination } from "../resource-context";
import { readTaskBoolean, readTaskList, readTaskString } from "./attributes";

export async function createNativeCalendarEvent(
  input: {
    title?: string;
    description: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    timeZone?: string;
    allDay: boolean;
    color?: string;
    labels: string[];
    category: string;
    reminder?: string;
    recurrence?: string;
    repeatUntil?: string;
    location?: string;
    url?: string;
    relatedResourceIds: string[];
    destination: Awaited<ReturnType<typeof resolveImportDestination>>;
    tags: string[];
  },
  context: Pick<CommandContext, "registry">,
): Promise<CalendarEvent> {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const startDate = input.startDate || today;
  const endDate = input.endDate || startDate;
  const title = input.title?.trim() || "Untitled Event";
  return context.registry.resolve("eventService").create({
    owner: input.destination.profileId,
    profileId: input.destination.profileId,
    workspaceRefs: input.destination.workspaceRefs,
    primaryWorkspaceId: input.destination.primaryWorkspaceId,
    defaultSpace: input.destination.defaultSpace,
    tags: input.tags,
    metadata: {
      title,
      description: input.description.trim() || calendarEventSummary(startDate, input.startTime, input.location),
      kind: "calendar-event",
      createdAt: now,
      updatedAt: now,
      createdBy: input.destination.profileId,
      updatedBy: input.destination.profileId,
      attributes: createCalendarEventAttributes({
        title,
        description: input.description,
        startDate,
        endDate,
        startTime: input.startTime ?? "",
        endTime: input.endTime ?? "",
        timeZone: input.timeZone ?? "local",
        allDay: input.allDay,
        color: input.color ?? "#dbeafe",
        labels: input.labels,
        category: input.category,
        reminder: input.reminder ?? "",
        recurrence: input.recurrence ?? "none",
        repeatUntil: input.repeatUntil ?? "",
        location: input.location ?? "",
        url: input.url ?? "",
        relatedResourceIds: input.relatedResourceIds,
        createdAt: now,
        updatedAt: now,
      }),
    },
  });
}

export async function updateNativeCalendarEvent(
  event: CalendarEvent,
  patch: {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    timeZone?: string;
    allDay?: boolean;
    color?: string;
    labels?: string[];
    category?: string;
    reminder?: string;
    recurrence?: string;
    repeatUntil?: string;
    location?: string;
    url?: string;
    relatedResourceIds?: string[];
    tags?: string[];
  },
  context: CommandContext,
): Promise<CalendarEvent> {
  const now = new Date().toISOString();
  const nextStartDate = patch.startDate ?? readTaskString(event, "calendarStartDate") ?? now.slice(0, 10);
  const nextEndDate = patch.endDate ?? readTaskString(event, "calendarEndDate") ?? nextStartDate;
  const title = patch.title?.trim() || event.metadata.title;
  const description = patch.description ?? readTaskString(event, "calendarDescription") ?? "";
  return context.registry.resolve("eventService").update({
    id: event.id,
    tags: patch.tags ?? event.tags,
    metadata: {
      title,
      description: typeof patch.description === "string"
        ? (patch.description.trim() || calendarEventSummary(nextStartDate, patch.startTime ?? readTaskString(event, "calendarStartTime"), patch.location ?? readTaskString(event, "calendarLocation")))
        : event.metadata.description,
      attributes: {
        ...(event.metadata.attributes ?? {}),
        ...createCalendarEventAttributes({
          title,
          description,
          startDate: nextStartDate,
          endDate: nextEndDate,
          startTime: patch.startTime ?? readTaskString(event, "calendarStartTime") ?? "",
          endTime: patch.endTime ?? readTaskString(event, "calendarEndTime") ?? "",
          timeZone: patch.timeZone ?? readTaskString(event, "calendarTimeZone") ?? "local",
          allDay: patch.allDay ?? readTaskBoolean(event, "calendarAllDay"),
          color: patch.color ?? readTaskString(event, "calendarColor") ?? "#dbeafe",
          labels: patch.labels ?? readTaskList(event, "calendarLabels"),
          category: patch.category ?? readTaskString(event, "calendarCategory") ?? "meeting",
          reminder: patch.reminder ?? readTaskString(event, "calendarReminder") ?? "",
          recurrence: patch.recurrence ?? readTaskString(event, "calendarRecurrence") ?? "none",
          repeatUntil: patch.repeatUntil ?? readTaskString(event, "calendarRepeatUntil") ?? "",
          location: patch.location ?? readTaskString(event, "calendarLocation") ?? "",
          url: patch.url ?? readTaskString(event, "calendarUrl") ?? "",
          relatedResourceIds: patch.relatedResourceIds ?? readTaskList(event, "calendarRelatedResourceIds"),
          createdAt: readTaskString(event, "calendarCreatedAt") ?? event.metadata.createdAt,
          updatedAt: now,
        }),
      },
    },
  });
}

export function isKaryaCalendarEvent(resource: Resource): boolean {
  return resource.metadata.kind === "calendar-event" || resource.type === "application/vnd.karya.calendar-event";
}

export function createCalendarEventAttributes(input: {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  allDay: boolean;
  color: string;
  labels: string[];
  category: string;
  reminder: string;
  recurrence: string;
  repeatUntil: string;
  location: string;
  url: string;
  relatedResourceIds: string[];
  createdAt: string;
  updatedAt: string;
}): NonNullable<Resource["metadata"]["attributes"]> {
  return {
    calendarTitle: input.title,
    calendarDescription: input.description,
    calendarStartDate: input.startDate,
    calendarEndDate: input.endDate,
    calendarStartTime: input.startTime,
    calendarEndTime: input.endTime,
    calendarTimeZone: input.timeZone,
    calendarAllDay: input.allDay,
    calendarColor: input.color,
    calendarLabels: input.labels.join("\n"),
    calendarCategory: input.category,
    calendarReminder: input.reminder,
    calendarRecurrence: input.recurrence,
    calendarRepeatUntil: input.repeatUntil,
    calendarLocation: input.location,
    calendarUrl: input.url,
    calendarRelatedResourceIds: input.relatedResourceIds.join("\n"),
    calendarCreatedAt: input.createdAt,
    calendarUpdatedAt: input.updatedAt,
    calendarSearchText: [
      input.title,
      input.description,
      input.startDate,
      input.startTime,
      input.location,
      input.url,
      input.category,
      ...input.labels,
    ].filter(Boolean).join(" "),
  };
}

export function calendarEventSummary(startDate: string, startTime?: string, location?: string): string {
  return [
    startDate,
    startTime,
    location ? `at ${location}` : "",
  ].filter(Boolean).join(" ");
}
