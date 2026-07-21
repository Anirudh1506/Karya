import type { KernelSnapshot } from "@karya/core";
import type { ImportDestination } from "@karya/types";
import { DESKTOP_HOME_DEFAULT_SPACE_ID } from "../types";
import type {
  ApplicationSnapshot,
  BookmarkReadingStatus,
  CalendarEventCategory,
  CalendarView,
  EventSnapshot,
  ResourceContextAction,
  ResourceSnapshot,
  TaskFilter,
  TaskPriority,
  TaskStatus,
} from "../types";

export function profileNameForWorkspace(snapshot: KernelSnapshot, profileId: string): string {
  return snapshot.profiles.all.find((profile) => profile.id === profileId)?.name ?? profileId;
}

export function resourceLocationLabel(
  snapshot: KernelSnapshot,
  resource: KernelSnapshot["resources"]["all"][number],
  workspaceId?: string,
): string {
  if (resource.defaultSpace === "user" || workspaceId === DESKTOP_HOME_DEFAULT_SPACE_ID) {
    return `Desktop${workspaceId ? ` / ${workspaceNameForResource(snapshot, workspaceId)}` : ""}`;
  }

  const profileName =
    snapshot.profiles.all.find((profile) => profile.id === resource.profileId)?.name ?? resource.profileId;
  return `${profileName}${workspaceId ? ` / ${workspaceNameForResource(snapshot, workspaceId)}` : ""}`;
}

export function workspaceNameForResource(snapshot: KernelSnapshot, workspaceId: string): string {
  if (workspaceId === DESKTOP_HOME_DEFAULT_SPACE_ID) return "Default Space";
  return snapshot.workspaces.all.find((workspace) => workspace.id === workspaceId)?.name ?? workspaceId;
}

export function displayWorkspaceName(workspace: KernelSnapshot["workspaces"]["all"][number]): string {
  return workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID ? "Default Space" : workspace.name;
}

export function currentSurfaceName(
  snapshot: KernelSnapshot | undefined,
  activeSurface: KernelSnapshot["shell"]["activeSurface"],
  activeWorkspace: KernelSnapshot["workspaces"]["active"],
): string | undefined {
  if (activeSurface.type === "home") return "Desktop Home";
  if (activeSurface.type === "profile") {
    return snapshot?.profiles.all.find((profile) => profile.id === activeSurface.profileId)?.name;
  }
  if (activeSurface.type === "folder") {
    return snapshot?.resources.all.find((resource) => resource.id === activeSurface.resourceId)?.metadata.title;
  }
  const workspace =
    snapshot?.workspaces.all.find((candidate) => candidate.id === activeSurface.workspaceId) ?? activeWorkspace;
  return workspace ? displayWorkspaceName(workspace) : undefined;
}

export function currentSurfaceWorkspaceId(
  snapshot: KernelSnapshot | undefined,
  activeSurface: KernelSnapshot["shell"]["activeSurface"],
): string | undefined {
  if (activeSurface.type === "workspace") return activeSurface.workspaceId;
  if (activeSurface.type === "folder") {
    const folder = snapshot?.resources.all.find((resource) => resource.id === activeSurface.resourceId);
    return folder?.primaryWorkspaceId ?? folder?.workspaceRefs[0];
  }
  return undefined;
}

export function currentSurfaceProfileId(
  snapshot: KernelSnapshot | undefined,
  activeSurface: KernelSnapshot["shell"]["activeSurface"],
  fallbackProfileId?: string,
): string | undefined {
  if (activeSurface.type === "home") return undefined;
  if (activeSurface.type === "profile") return activeSurface.profileId;
  if (activeSurface.type === "folder") {
    const folder = snapshot?.resources.all.find((resource) => resource.id === activeSurface.resourceId);
    if (folder?.defaultSpace === "user") return undefined;
    return folder?.profileId ?? fallbackProfileId;
  }
  const workspace = snapshot?.workspaces.all.find((candidate) => candidate.id === activeSurface.workspaceId);
  if (workspace?.id === DESKTOP_HOME_DEFAULT_SPACE_ID) return undefined;
  return workspace?.profileId ?? fallbackProfileId;
}

export function getDesktopHomeDefaultSpace(
  snapshot: KernelSnapshot,
): KernelSnapshot["workspaces"]["all"][number] | undefined {
  return snapshot.workspaces.all.find((workspace) => workspace.id === DESKTOP_HOME_DEFAULT_SPACE_ID);
}

export function getImportWorkspaceOptions(
  snapshot: KernelSnapshot,
  profileId: string,
): KernelSnapshot["workspaces"]["all"] {
  return (snapshot.profiles.workspaceIdsByProfile[profileId] ?? [])
    .map((workspaceId) => snapshot.workspaces.all.find((workspace) => workspace.id === workspaceId))
    .filter((workspace): workspace is KernelSnapshot["workspaces"]["all"][number] => Boolean(workspace))
    .filter(
      (workspace) =>
        workspace.id !== DESKTOP_HOME_DEFAULT_SPACE_ID &&
        workspace.lifecycleState !== "deleted" &&
        workspace.lifecycleState !== "archived",
    );
}

export function getMoveWorkspaceOptions(
  snapshot: KernelSnapshot,
  resource: ResourceSnapshot,
): KernelSnapshot["workspaces"]["all"] {
  const desktopDefaultSpace = getDesktopHomeDefaultSpace(snapshot);
  const isDesktopResource = resource.defaultSpace === "user" || resource.profileId === "desktop-user";
  const profileWorkspaces = isDesktopResource
    ? snapshot.profiles.all.flatMap((profile) => getImportWorkspaceOptions(snapshot, profile.id))
    : getImportWorkspaceOptions(snapshot, resource.profileId);

  return [...(desktopDefaultSpace ? [desktopDefaultSpace] : []), ...profileWorkspaces].filter(
    (workspace, index, all) => all.findIndex((candidate) => candidate.id === workspace.id) === index,
  );
}

export function destinationFromWorkspace(snapshot: KernelSnapshot, workspaceId: string): ImportDestination {
  const workspace = snapshot.workspaces.all.find((candidate) => candidate.id === workspaceId);
  const profile = workspace
    ? snapshot.profiles.all.find((candidate) => candidate.id === workspace.profileId)
    : undefined;
  return {
    profileId: workspaceId === DESKTOP_HOME_DEFAULT_SPACE_ID ? undefined : workspace?.profileId,
    workspaceId,
    defaultSpace:
      workspaceId === DESKTOP_HOME_DEFAULT_SPACE_ID
        ? "user"
        : profile?.defaultSpaceId === workspaceId
          ? "profile"
          : "none",
  };
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs)) return value;
  if (diffMs < 60_000) return "Just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} days ago`;
  return formatShortDate(value);
}

export function formatDurationSince(value: string): string {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "New";
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

export function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

export function formatActivityType(type: string): string {
  return type
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatInsightActivity(type: string, title: string): string {
  if (type === "application-launched") return `Launched ${title}`;
  if (type === "resource-opened") return `Opened ${title}`;
  if (type === "resource-resumed") return `Resumed ${title}`;
  if (type === "resource-imported") return `Imported ${title}`;
  if (type === "folder-imported") return `Imported ${title}`;
  if (type === "resource-renamed") return `Renamed ${title}`;
  if (type === "resource-moved") return `Moved ${title}`;
  if (type === "resource-archived") return `Archived ${title}`;
  if (type === "resource-created") return `Created ${title}`;
  if (type === "resource-referenced") return `Referenced ${title}`;
  if (type === "resource-viewed") return `Viewed ${title}`;
  if (type === "workspace-resumed") return "Resumed workspace";
  if (type === "workspace-opened") return "Opened workspace";
  return title;
}

export function getResourceActivities(snapshot: KernelSnapshot | undefined, resourceId: string) {
  return Object.values(snapshot?.continuity.activityByWorkspace ?? {})
    .flat()
    .filter((activity) => activity.resourceId === resourceId)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export function isFolderResource(resource: { type: string; metadata: { kind: string } }): boolean {
  return resource.type === "inode/directory" || resource.metadata.kind === "folder";
}

export function isReferencedResource(resource: ResourceSnapshot): boolean {
  return resource.tags.includes("linked") || resource.metadata.attributes?.resourceLocationKind === "local-linked";
}

export function isVisibleResource(resource: ResourceSnapshot | undefined): resource is ResourceSnapshot {
  return Boolean(resource && resource.lifecycleState !== "deleted");
}

export function isTaskResource(resource: ResourceSnapshot | undefined): resource is ResourceSnapshot {
  return Boolean(resource && (resource.metadata.kind === "task" || resource.type === "application/vnd.karya.task"));
}

export function isBookmarkResource(resource: ResourceSnapshot | undefined): resource is ResourceSnapshot {
  return Boolean(
    resource && (resource.metadata.kind === "bookmark" || resource.type === "application/vnd.karya.bookmark"),
  );
}

export function isCalendarEvent(event: EventSnapshot | undefined): event is EventSnapshot {
  return Boolean(event && event.eventType === "calendar-event");
}

export function isEditableNativeNote(resource: ResourceSnapshot | undefined): resource is ResourceSnapshot {
  if (!resource) return false;
  return (
    resource.metadata.kind === "note" &&
    resource.metadata.attributes?.noteOrigin !== "linked" &&
    resource.metadata.attributes?.noteEditableInKarya !== false
  );
}

export function readTaskStatus(resource: ResourceSnapshot): TaskStatus {
  const value = readStringAttribute(resource, "taskStatus");
  return value === "in-progress" || value === "blocked" || value === "completed" || value === "archived"
    ? value
    : "todo";
}

export function readTaskPriority(resource: ResourceSnapshot): TaskPriority {
  const value = readStringAttribute(resource, "taskPriority");
  return value === "low" || value === "medium" || value === "high" || value === "critical" ? value : "none";
}

type MetadataCarrier = ResourceSnapshot | EventSnapshot;

export function readTaskList(resource: MetadataCarrier, key: string): string[] {
  return (readStringAttribute(resource, key) ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readTaskCompletedList(resource: ResourceSnapshot): boolean[] {
  return (readStringAttribute(resource, "taskChecklistCompleted") ?? "")
    .split("\n")
    .map((item) => item === "1" || item === "true");
}

export function readTaskLabels(resource: ResourceSnapshot): string[] {
  return readTaskList(resource, "taskLabels");
}

export function isTaskPinned(resource: ResourceSnapshot): boolean {
  return resource.metadata.attributes?.taskPinned === true;
}

export function readBookmarkStatus(resource: ResourceSnapshot): BookmarkReadingStatus {
  const value = readStringAttribute(resource, "bookmarkReadingStatus");
  return value === "reading" || value === "completed" || value === "archived" ? value : "unread";
}

export function readBookmarkLabels(resource: ResourceSnapshot): string[] {
  return readTaskList(resource, "bookmarkLabels");
}

export function readBookmarkDomain(resource: ResourceSnapshot): string {
  return (
    readStringAttribute(resource, "bookmarkDomain") ??
    readStringAttribute(resource, "bookmarkWebsiteName") ??
    readStringAttribute(resource, "bookmarkUrl") ??
    "Web"
  );
}

export function isBookmarkPinned(resource: ResourceSnapshot): boolean {
  return resource.metadata.attributes?.bookmarkPinned === true;
}

export function compareBookmarks(left: ResourceSnapshot, right: ResourceSnapshot): number {
  const pinnedDiff = Number(isBookmarkPinned(right)) - Number(isBookmarkPinned(left));
  if (pinnedDiff !== 0) return pinnedDiff;
  return right.metadata.updatedAt.localeCompare(left.metadata.updatedAt);
}

export function collectBookmarkLabels(bookmarks: ResourceSnapshot[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  bookmarks.flatMap(readBookmarkLabels).forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

export function formatBookmarkStatus(status: BookmarkReadingStatus): string {
  const labels: Record<BookmarkReadingStatus, string> = {
    unread: "Unread",
    reading: "Reading",
    completed: "Completed",
    archived: "Archived",
  };
  return labels[status];
}

export function formatBookmarkFilter(filter: BookmarkReadingStatus | "all" | "pinned" | "favorite"): string {
  if (filter === "all") return "All Bookmarks";
  if (filter === "pinned") return "Pinned";
  if (filter === "favorite") return "Favorites";
  return formatBookmarkStatus(filter);
}

export function countBookmarks(
  bookmarks: ResourceSnapshot[],
  filter: BookmarkReadingStatus | "all" | "pinned" | "favorite",
): number {
  if (filter === "pinned") return bookmarks.filter(isBookmarkPinned).length;
  if (filter === "favorite")
    return bookmarks.filter((bookmark) => readBooleanAttribute(bookmark, "bookmarkFavorite")).length;
  if (filter === "all") return bookmarks.filter((bookmark) => readBookmarkStatus(bookmark) !== "archived").length;
  return bookmarks.filter((bookmark) => readBookmarkStatus(bookmark) === filter).length;
}

export function readCalendarStartDate(resource: EventSnapshot): string {
  return readStringAttribute(resource, "calendarStartDate") ?? resource.metadata.createdAt.slice(0, 10);
}

export function readCalendarEndDate(resource: EventSnapshot): string {
  return readStringAttribute(resource, "calendarEndDate") ?? readCalendarStartDate(resource);
}

export function readCalendarLabels(resource: EventSnapshot): string[] {
  return readTaskList(resource, "calendarLabels");
}

export function readCalendarRelatedIds(resource: EventSnapshot): string[] {
  return readTaskList(resource, "calendarRelatedResourceIds");
}

export function readCalendarCategory(resource: EventSnapshot): CalendarEventCategory {
  const value = readStringAttribute(resource, "calendarCategory");
  return value === "focus" || value === "deadline" || value === "reminder" || value === "personal" || value === "other"
    ? value
    : "meeting";
}

export function readCalendarColor(resource: EventSnapshot): string {
  return readStringAttribute(resource, "calendarColor") ?? calendarColorForTitle(resource.metadata.title);
}

export function readCalendarTimeLabel(resource: EventSnapshot): string {
  if (readBooleanAttribute(resource, "calendarAllDay")) return "All day";
  const start = readStringAttribute(resource, "calendarStartTime");
  const end = readStringAttribute(resource, "calendarEndTime");
  if (start && end) return `${start}-${end}`;
  return start ?? "";
}

export function compareCalendarEvents(left: EventSnapshot, right: EventSnapshot): number {
  const dateDiff = readCalendarStartDate(left).localeCompare(readCalendarStartDate(right));
  if (dateDiff !== 0) return dateDiff;
  const timeDiff = (readStringAttribute(left, "calendarStartTime") ?? "").localeCompare(
    readStringAttribute(right, "calendarStartTime") ?? "",
  );
  if (timeDiff !== 0) return timeDiff;
  return left.metadata.title.localeCompare(right.metadata.title);
}

export function collectCalendarLabels(events: EventSnapshot[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  events.flatMap(readCalendarLabels).forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

export function formatCalendarCategory(category: CalendarEventCategory): string {
  const labels: Record<CalendarEventCategory, string> = {
    meeting: "Meeting",
    focus: "Focus",
    deadline: "Deadline",
    reminder: "Reminder",
    personal: "Personal",
    other: "Other",
  };
  return labels[category];
}

export function formatCalendarDateRange(resource: EventSnapshot): string {
  const start = readCalendarStartDate(resource);
  const end = readCalendarEndDate(resource);
  const time = readCalendarTimeLabel(resource);
  const dateLabel =
    start === end ? formatTaskDateLabel(start) : `${formatTaskDateLabel(start)} - ${formatTaskDateLabel(end)}`;
  return time ? `${dateLabel} · ${time}` : dateLabel;
}

export function calendarEventOccursOn(resource: EventSnapshot, dateKey: string): boolean {
  return readCalendarStartDate(resource) <= dateKey && readCalendarEndDate(resource) >= dateKey;
}

export function countCalendarEvents(events: EventSnapshot[], view: CalendarView): number {
  const today = todayDateKey();
  if (view === "agenda") return events.filter((event) => readCalendarEndDate(event) >= today).length;
  return events.length;
}

export function todayDateKey(): string {
  return formatTaskDateKey(new Date());
}

export function startOfWeek(date: Date): Date {
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

export function addCalendarView(date: Date, view: CalendarView, direction: number): Date {
  if (view === "month") return addMonths(date, direction);
  if (view === "week") return addDays(date, direction * 7);
  return addDays(date, direction);
}

export function calendarColorForTitle(title: string): string {
  const colors = ["#fee2e2", "#fef3c7", "#dcfce7", "#dbeafe", "#ede9fe", "#ffedd5"];
  const index = [...(title || "event")].reduce((total, char) => total + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
}

export function filterTasks(tasks: ResourceSnapshot[], filter: TaskFilter): ResourceSnapshot[] {
  return tasks.filter((task) => {
    if (filter === "pinned") return isTaskPinned(task);
    if (filter === "today") return isTaskDueToday(task);
    if (filter === "upcoming")
      return Boolean(readStringAttribute(task, "taskDueDate")) && !isTaskDueToday(task) && !isTaskOverdue(task);
    if (filter === "completed") return readTaskStatus(task) === "completed";
    if (filter === "archived") return task.lifecycleState === "archived" || readTaskStatus(task) === "archived";
    return task.lifecycleState !== "deleted" && readTaskStatus(task) !== "archived";
  });
}

export function formatTaskFilter(filter: TaskFilter): string {
  const labels: Record<TaskFilter, string> = {
    all: "All Tasks",
    pinned: "Pinned",
    today: "Today",
    upcoming: "Upcoming",
    completed: "Completed",
    archived: "Archived",
  };
  return labels[filter];
}

export function collectTaskLabels(tasks: ResourceSnapshot[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  tasks.flatMap(readTaskLabels).forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

export function labelColor(label: string): { background: string; dot: string } {
  const palette = [
    { background: "#fecaca", dot: "#ef4444" },
    { background: "#fde68a", dot: "#f59e0b" },
    { background: "#bbf7d0", dot: "#22c55e" },
    { background: "#bfdbfe", dot: "#3b82f6" },
    { background: "#ddd6fe", dot: "#8b5cf6" },
    { background: "#fed7aa", dot: "#f97316" },
  ];
  const index = [...label].reduce((total, char) => total + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

export function taskTone(task: ResourceSnapshot, _index: number): { background: string; border: string } {
  const labels = readTaskLabels(task);
  const priority = readTaskPriority(task);
  const basis = labels[0] ?? (priority === "none" ? undefined : priority) ?? task.id ?? task.metadata.title;
  const tones = [
    { background: "var(--karya-task-teal-bg)", border: "var(--karya-task-teal-border)" },
    { background: "var(--karya-task-green-bg)", border: "var(--karya-task-green-border)" },
    { background: "var(--karya-task-amber-bg)", border: "var(--karya-task-amber-border)" },
    { background: "var(--karya-task-violet-bg)", border: "var(--karya-task-violet-border)" },
    { background: "var(--karya-task-blue-bg)", border: "var(--karya-task-blue-border)" },
    { background: "var(--karya-task-rose-bg)", border: "var(--karya-task-rose-border)" },
  ];
  const toneIndex = [...basis].reduce((total, char) => total + char.charCodeAt(0), 0) % tones.length;
  return tones[toneIndex];
}

export function parseTaskDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function buildCalendarDays(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function formatTaskDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTaskDateLabel(value: string): string {
  const date = parseTaskDate(value);
  return date ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : value;
}

export function formatTaskStatus(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    todo: "To Do",
    "in-progress": "In Progress",
    blocked: "Blocked",
    completed: "Completed",
    archived: "Archived",
  };
  return labels[status];
}

export function formatTaskPriority(priority: TaskPriority): string {
  const labels: Record<TaskPriority, string> = {
    none: "No Priority",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
  };
  return labels[priority];
}

export function compareTasks(left: ResourceSnapshot, right: ResourceSnapshot): number {
  const statusWeight: Record<TaskStatus, number> = {
    blocked: 0,
    "in-progress": 1,
    todo: 2,
    completed: 3,
    archived: 4,
  };
  const priorityWeight: Record<TaskPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    none: 4,
  };
  const statusDiff = statusWeight[readTaskStatus(left)] - statusWeight[readTaskStatus(right)];
  if (statusDiff !== 0) return statusDiff;
  const priorityDiff = priorityWeight[readTaskPriority(left)] - priorityWeight[readTaskPriority(right)];
  if (priorityDiff !== 0) return priorityDiff;
  return right.metadata.updatedAt.localeCompare(left.metadata.updatedAt);
}

export function isTaskDueToday(resource: ResourceSnapshot): boolean {
  const dueDate = readStringAttribute(resource, "taskDueDate");
  if (!dueDate) return false;
  return dueDate === new Date().toISOString().slice(0, 10);
}

export function isTaskOverdue(resource: ResourceSnapshot): boolean {
  const dueDate = readStringAttribute(resource, "taskDueDate");
  if (!dueDate || readTaskStatus(resource) === "completed") return false;
  return dueDate < new Date().toISOString().slice(0, 10);
}

export function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function applicationSupportsResource(application: ApplicationSnapshot, resource: ResourceSnapshot): boolean {
  const supportedTypes = application.metadata.supportedFileTypes ?? [];
  if (!supportedTypes.length || application.hidden || application.lifecycleState === "removed") return false;
  const extension = readResourceExtension(resource);
  const mimeType = readStringAttribute(resource, "contentMimeType") ?? resource.type;
  const kind = resource.metadata.kind;
  return supportedTypes.some((supportedType) => {
    const normalized = supportedType.toLocaleLowerCase();
    return (
      normalized === mimeType.toLocaleLowerCase() ||
      normalized === kind.toLocaleLowerCase() ||
      Boolean(extension && normalized === extension.toLocaleLowerCase()) ||
      Boolean(extension && normalized === `.${extension.toLocaleLowerCase()}`)
    );
  });
}

export function readResourceExtension(resource: ResourceSnapshot): string | undefined {
  const explicit = readStringAttribute(resource, "contentExtension");
  if (explicit) return explicit.replace(/^\./, "");
  const title = resource.metadata.title;
  const index = title.lastIndexOf(".");
  return index > 0 && index < title.length - 1 ? title.slice(index + 1) : undefined;
}

export async function runResourceAction(
  action: ResourceContextAction,
  resource: ResourceSnapshot,
  handlers: {
    addToWorkspace(resource: ResourceSnapshot): void;
    archive(resourceId: string): Promise<void> | void;
    delete(resourceId: string): Promise<void> | void;
    duplicate(resourceId: string): Promise<void> | void;
    move(resource: ResourceSnapshot): void;
    open(resourceId: string): Promise<unknown> | void;
    properties(resource: ResourceSnapshot): void;
    rename(resource: ResourceSnapshot): void;
    restore(resourceId: string): Promise<unknown> | void;
    reveal(resourceId: string): Promise<unknown> | void;
  },
): Promise<void> {
  switch (action) {
    case "open":
      await handlers.open(resource.id);
      return;
    case "reveal":
      await handlers.reveal(resource.id);
      return;
    case "open-in-code":
    case "copy-path":
    case "remove-reference":
    case "show-metadata":
      return;
    case "rename":
      handlers.rename(resource);
      return;
    case "duplicate":
      await handlers.duplicate(resource.id);
      return;
    case "move":
      handlers.move(resource);
      return;
    case "add-to-workspace":
      handlers.addToWorkspace(resource);
      return;
    case "archive":
      await handlers.archive(resource.id);
      return;
    case "restore":
      await handlers.restore(resource.id);
      return;
    case "delete":
      await handlers.delete(resource.id);
      return;
    case "properties":
      handlers.properties(resource);
      return;
  }
}

export function readStringAttribute(resource: MetadataCarrier | undefined, key: string): string | undefined {
  const value = resource?.metadata.attributes?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readBooleanAttribute(resource: MetadataCarrier | undefined, key: string): boolean {
  return resource?.metadata.attributes?.[key] === true;
}

export function readNumberAttribute(resource: ResourceSnapshot | undefined, key: string): number | undefined {
  const value = resource?.metadata.attributes?.[key];
  return typeof value === "number" ? value : undefined;
}
