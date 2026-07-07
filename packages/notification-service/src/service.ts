import type { EventBus } from "@karya/event-bus";
import type { NotificationProvider } from "@karya/platform";
import type { EntityId, ImportJob, KaryaNotification, NotificationAction, NotificationCategory, NotificationObjectReference, NotificationPriority, ReminderSchedule, Resource, Workspace } from "@karya/types";
import type { CreateNotificationRequest, NotificationService, ScheduleReminderRequest } from "./contracts";

export class InMemoryNotificationService implements NotificationService {
  private readonly notifications = new Map<EntityId, KaryaNotification>();
  private readonly reminders = new Map<EntityId, ReminderSchedule>();

  constructor(
    private readonly eventBus: EventBus,
    seed: KaryaNotification[] = [],
    private readonly nativeNotifications?: NotificationProvider,
  ) {
    seed.forEach((notification) => this.notifications.set(notification.id, cloneNotification(notification)));
  }

  async create(request: CreateNotificationRequest): Promise<KaryaNotification> {
    const now = new Date().toISOString();
    const groupKey = request.groupKey ?? defaultGroupKey(request);
    const existing = groupKey ? this.findActiveGroup(groupKey, request.workspaceId, request.profileId) : undefined;
    const notification: KaryaNotification = existing
      ? {
          ...existing,
          title: groupedTitle(existing, request),
          description: request.description ?? existing.description,
          groupCount: existing.groupCount + 1,
          status: "unread",
          updatedAt: now,
          actions: mergeActions(existing.actions, request.actions ?? []),
          references: mergeReferences(existing.references, request.references ?? []),
        }
      : {
          id: crypto.randomUUID(),
          icon: request.icon ?? iconForCategory(request.category),
          title: request.title,
          description: request.description,
          category: request.category,
          source: request.source,
          workspaceId: request.workspaceId,
          profileId: request.profileId,
          status: "unread",
          priority: request.priority ?? "normal",
          groupKey,
          groupCount: 1,
          actions: request.actions ?? [],
          references: request.references ?? [],
          createdAt: now,
          updatedAt: now,
          scheduledFor: request.scheduledFor,
          deliveredAt: request.deliver === false ? undefined : now,
        };

    this.notifications.set(notification.id, cloneNotification(notification));
    await this.publish(existing ? "NotificationUpdated" : "NotificationCreated", notification);
    if (request.deliver !== false) {
      await this.nativeNotifications?.notify({ title: notification.title, body: notification.description });
    }
    return cloneNotification(notification);
  }

  async list(): Promise<KaryaNotification[]> {
    return [...this.notifications.values()]
      .map(cloneNotification)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async get(id: EntityId): Promise<KaryaNotification | undefined> {
    const notification = this.notifications.get(id);
    return notification ? cloneNotification(notification) : undefined;
  }

  async markRead(id: EntityId): Promise<KaryaNotification> {
    return this.updateStatus(id, "read", "readAt");
  }

  async archive(id: EntityId): Promise<KaryaNotification> {
    return this.updateStatus(id, "archived", "archivedAt");
  }

  async delete(id: EntityId): Promise<KaryaNotification> {
    const notification = await this.updateStatus(id, "deleted", "deletedAt");
    await this.eventBus.publish("NotificationDeleted", { notification });
    await this.eventBus.publish("notification:deleted", { notificationId: id });
    return notification;
  }

  async scheduleReminder(request: ScheduleReminderRequest): Promise<ReminderSchedule> {
    const now = new Date().toISOString();
    const reminder: ReminderSchedule = {
      id: crypto.randomUUID(),
      title: request.title,
      description: request.description,
      category: request.category,
      source: request.source,
      workspaceId: request.workspaceId,
      profileId: request.profileId,
      objectRef: request.objectRef,
      remindAt: request.remindAt,
      repeat: request.repeat ?? "none",
      relativeOffsetMinutes: request.relativeOffsetMinutes,
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    };
    this.reminders.set(reminder.id, { ...reminder });
    await this.eventBus.publish("ReminderScheduled", { reminder });
    return { ...reminder };
  }

  async listReminders(): Promise<ReminderSchedule[]> {
    return [...this.reminders.values()].map((reminder) => ({ ...reminder }));
  }

  async deliverDueReminders(now = new Date().toISOString()): Promise<KaryaNotification[]> {
    const delivered: KaryaNotification[] = [];
    for (const reminder of [...this.reminders.values()]) {
      if (reminder.status !== "scheduled" || reminder.remindAt > now) continue;
      const notification = await this.create({
        title: reminder.title,
        description: reminder.description,
        category: reminder.category,
        source: reminder.source,
        workspaceId: reminder.workspaceId,
        profileId: reminder.profileId,
        groupKey: `${reminder.category}:reminder:${reminder.objectRef?.id ?? reminder.title}`,
        references: reminder.objectRef ? [reminder.objectRef] : [],
        actions: reminderActions(reminder),
      });
      const next = nextReminder(reminder);
      this.reminders.set(reminder.id, next);
      await this.eventBus.publish("ReminderDelivered", { reminder: next, notification });
      delivered.push(notification);
    }
    return delivered;
  }

  subscribeToEvents(): () => void {
    const unsubscribers = [
      this.eventBus.subscribe("ImportCompleted", ({ job }) => void this.create(importNotification(job, "completed"))),
      this.eventBus.subscribe("ImportFailed", ({ job }) => void this.create(importNotification(job, "failed"))),
      this.eventBus.subscribe("WorkspaceRestored", ({ workspace }) => void this.create(workspaceNotification(workspace, "restored"))),
      this.eventBus.subscribe("WorkspaceArchived", ({ workspace }) => void this.create(workspaceNotification(workspace, "archived"))),
      this.eventBus.subscribe("ResourceUpdated", ({ resource }) => void this.maybeCreateTaskNotification(resource)),
      this.eventBus.subscribe("CalendarEventCreated", ({ event }) => {
        const reminder = event.metadata.attributes?.calendarReminder;
        const startDate = event.metadata.attributes?.calendarStartDate;
        const startTime = event.metadata.attributes?.calendarStartTime;
        if (typeof reminder !== "string" || !reminder || typeof startDate !== "string") return;
        const remindAt = calendarReminderTime(startDate, typeof startTime === "string" ? startTime : "", reminder);
        void this.scheduleReminder({
          title: event.metadata.title,
          description: event.metadata.description,
          category: "calendar",
          source: "calendar",
          workspaceId: event.primaryWorkspaceId ?? event.workspaceRefs[0],
          profileId: event.profileId,
          objectRef: { id: event.id, type: "event", title: event.metadata.title },
          remindAt,
        });
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  startReminderScheduler(intervalMs = 60_000): () => void {
    const timer = setInterval(() => void this.deliverDueReminders(), intervalMs);
    void this.deliverDueReminders();
    return () => clearInterval(timer);
  }

  private async maybeCreateTaskNotification(resource: Resource): Promise<void> {
    if (resource.metadata.kind !== "task" && resource.type !== "application/vnd.karya.task") return;
    const status = resource.metadata.attributes?.taskStatus;
    if (status === "completed") {
      await this.create({
        title: `${resource.metadata.title} completed`,
        category: "task",
        source: "tasks",
        workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        profileId: resource.profileId,
        groupKey: "task:completed",
        references: [{ id: resource.id, type: "resource", title: resource.metadata.title }],
        actions: [{ id: "open-task", label: "Open Task", command: "openResource", targetId: resource.id, targetType: "resource" }],
      });
      return;
    }

    const dueDate = resource.metadata.attributes?.taskDueDate;
    if (typeof dueDate !== "string" || !dueDate) return;
    const today = new Date().toISOString().slice(0, 10);
    if (dueDate > today) return;
    await this.create({
      title: dueDate < today ? `${resource.metadata.title} is overdue` : `${resource.metadata.title} is due today`,
      description: resource.metadata.description,
      category: "task",
      source: "tasks",
      priority: dueDate < today ? "high" : "normal",
      workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
      profileId: resource.profileId,
      groupKey: dueDate < today ? "task:overdue" : "task:due-today",
      references: [{ id: resource.id, type: "resource", title: resource.metadata.title }],
      actions: [
        { id: "complete-task", label: "Complete", command: "completeTask", targetId: resource.id, targetType: "resource" },
        { id: "open-task", label: "Open Task", command: "openResource", targetId: resource.id, targetType: "resource" },
      ],
    });
  }

  private findActiveGroup(groupKey: string, workspaceId?: EntityId, profileId?: EntityId): KaryaNotification | undefined {
    return [...this.notifications.values()].find((notification) =>
      notification.groupKey === groupKey &&
      notification.workspaceId === workspaceId &&
      notification.profileId === profileId &&
      notification.status !== "archived" &&
      notification.status !== "deleted",
    );
  }

  private async updateStatus(id: EntityId, status: KaryaNotification["status"], timestampKey: "readAt" | "archivedAt" | "deletedAt"): Promise<KaryaNotification> {
    const current = this.notifications.get(id);
    if (!current) throw new Error(`Notification not found: ${id}`);
    const now = new Date().toISOString();
    const notification = { ...current, status, updatedAt: now, [timestampKey]: now };
    this.notifications.set(id, cloneNotification(notification));
    await this.publish("NotificationUpdated", notification);
    return cloneNotification(notification);
  }

  private async publish(type: "NotificationCreated" | "NotificationUpdated", notification: KaryaNotification): Promise<void> {
    await this.eventBus.publish(type, { notification });
    await this.eventBus.publish(type === "NotificationCreated" ? "notification:created" : "notification:updated", { notification });
  }
}

function importNotification(job: ImportJob, status: "completed" | "failed"): CreateNotificationRequest {
  return {
    title: status === "completed" ? "Import completed" : "Import failed",
    description: job.displayTitle ?? job.path,
    category: "import",
    source: "imports",
    priority: status === "failed" ? "high" : "normal",
    groupKey: `import:${status}`,
    actions: [{ id: "view-imports", label: "View Imports", command: "openSearch", payload: { query: "imports" } }],
  };
}

function workspaceNotification(workspace: Workspace, status: "restored" | "archived"): CreateNotificationRequest {
  return {
    title: `Workspace ${status}`,
    description: workspace.name,
    category: "workspace",
    source: "workspace",
    workspaceId: workspace.id,
    profileId: workspace.profileId,
    groupKey: `workspace:${status}`,
    actions: [{ id: "open-workspace", label: "Open Workspace", command: "openWorkspace", targetId: workspace.id, targetType: "workspace" }],
  };
}

function reminderActions(reminder: ReminderSchedule): NotificationAction[] {
  if (!reminder.objectRef) return [{ id: "dismiss", label: "Dismiss", command: "dismiss" }];
  if (reminder.objectRef.type !== "resource" && reminder.objectRef.type !== "event") {
    return [{ id: "dismiss", label: "Dismiss", command: "dismiss" }];
  }
  return [
    {
      id: "open",
      label: reminder.objectRef.type === "event" ? "Open Calendar" : "Open Task",
      command: reminder.objectRef.type === "event" ? "openEvent" : "openResource",
      targetId: reminder.objectRef.id,
      targetType: reminder.objectRef.type,
    },
    { id: "snooze", label: "Snooze", command: "snooze", targetId: reminder.id, targetType: "notification" },
  ];
}

function defaultGroupKey(request: CreateNotificationRequest): string {
  return `${request.category}:${request.source}:${request.title.toLocaleLowerCase()}`;
}

function groupedTitle(existing: KaryaNotification, request: CreateNotificationRequest): string {
  const count = existing.groupCount + 1;
  if (request.category === "task" && existing.groupKey?.includes("overdue")) return `${count} Tasks are overdue`;
  if (request.category === "task" && existing.groupKey?.includes("due-today")) return `${count} Tasks are due today`;
  if (request.category === "import" && existing.groupKey?.includes("completed")) return `${count} imports completed`;
  if (request.category === "import" && existing.groupKey?.includes("failed")) return `${count} imports failed`;
  return `${count} ${request.category} notifications`;
}

function iconForCategory(category: NotificationCategory): string {
  const icons: Record<NotificationCategory, string> = {
    calendar: "CalendarDays",
    task: "CheckSquare",
    import: "FolderInput",
    workspace: "Briefcase",
    system: "Bell",
    collaboration: "UserCircle",
    ai: "Sparkles",
    automation: "Settings",
  };
  return icons[category];
}

function mergeActions(left: NotificationAction[], right: NotificationAction[]): NotificationAction[] {
  return [...left, ...right].filter((action, index, all) => all.findIndex((candidate) => candidate.id === action.id) === index);
}

function mergeReferences(left: NotificationObjectReference[], right: NotificationObjectReference[]): NotificationObjectReference[] {
  return [...left, ...right].filter((ref, index, all) => all.findIndex((candidate) => candidate.id === ref.id && candidate.type === ref.type) === index);
}

function nextReminder(reminder: ReminderSchedule): ReminderSchedule {
  const now = new Date().toISOString();
  if (!reminder.repeat || reminder.repeat === "none") return { ...reminder, status: "delivered", updatedAt: now };
  const next = new Date(reminder.remindAt);
  if (reminder.repeat === "daily") next.setDate(next.getDate() + 1);
  if (reminder.repeat === "weekly") next.setDate(next.getDate() + 7);
  if (reminder.repeat === "monthly") next.setMonth(next.getMonth() + 1);
  return { ...reminder, remindAt: next.toISOString(), updatedAt: now };
}

function calendarReminderTime(startDate: string, startTime: string, reminder: string): string {
  const base = new Date(`${startDate}T${startTime || "09:00"}:00`);
  const minutes = reminder.includes("day") ? 24 * 60 : Number.parseInt(reminder, 10);
  if (Number.isFinite(minutes)) base.setMinutes(base.getMinutes() - minutes);
  return base.toISOString();
}

function cloneNotification(notification: KaryaNotification): KaryaNotification {
  return {
    ...notification,
    actions: notification.actions.map((action) => ({ ...action, payload: action.payload ? { ...action.payload } : undefined })),
    references: notification.references.map((reference) => ({ ...reference })),
  };
}
