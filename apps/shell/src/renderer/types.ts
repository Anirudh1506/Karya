import type { KernelSnapshot } from "@karya/core";

export const DESKTOP_HOME_DEFAULT_SPACE_ID = "workspace-desktop-home-default-space";
export type ImportMode = "file" | "directory";
export type PlacementOperation = "import" | "link";
export interface PendingPlacement {
  operation: PlacementOperation;
  mode: ImportMode;
}
export type ResourceSnapshot = KernelSnapshot["resources"]["all"][number];
export type EventSnapshot = KernelSnapshot["events"]["all"][number];
export type ApplicationSnapshot = KernelSnapshot["applications"]["installed"][number];
export type ResourceContextAction = "open" | "open-with" | "reveal" | "rename" | "duplicate" | "move" | "add-to-workspace" | "archive" | "restore" | "delete" | "properties";
export type TaskStatus = "todo" | "in-progress" | "blocked" | "completed" | "archived";
export type TaskPriority = "none" | "low" | "medium" | "high" | "critical";
export type TaskView = "list" | "kanban" | "calendar";
export type TaskFilter = "all" | "pinned" | "today" | "upcoming" | "completed" | "archived";
export type TaskPatch = {
  title?: string;
  description?: string;
  checklistItems?: string[];
  checklistCompleted?: boolean[];
  labels?: string[];
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  reminderAt?: string;
  reminderDate?: string;
  reminderTime?: string;
  reminderRepeat?: string;
  pinned?: boolean;
  parentTaskId?: string;
};
export type BookmarkReadingStatus = "unread" | "reading" | "completed" | "archived";
export type BookmarkPatch = {
  title?: string;
  url?: string;
  description?: string;
  websiteName?: string;
  favicon?: string;
  previewImage?: string;
  notes?: string;
  labels?: string[];
  readingStatus?: BookmarkReadingStatus;
  favorite?: boolean;
  pinned?: boolean;
};
export type CalendarView = "month" | "week" | "day" | "agenda";
export type CalendarEventCategory = "meeting" | "focus" | "deadline" | "reminder" | "personal" | "other";
export type CalendarEventPatch = {
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
  category?: CalendarEventCategory;
  reminder?: string;
  recurrence?: string;
  repeatUntil?: string;
  location?: string;
  url?: string;
  relatedResourceIds?: string[];
  tags?: string[];
};
