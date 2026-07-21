import type { ActivityService } from "@karya/activity-service";
import type { EventBus } from "@karya/event-bus";
import type { NotificationRepository } from "@karya/persistence";
import type { EntityId, KaryaActivity, KaryaNotification, ReminderSchedule } from "@karya/types";
import type {
  CreateNotificationRequest,
  NotificationQuery,
  NotificationService,
  ScheduleReminderRequest,
} from "./contracts";

export class InMemoryNotificationService implements NotificationService {
  private readonly reminders = new Map<EntityId, ReminderSchedule>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly activities: ActivityService,
    seed: KaryaNotification[] = [],
    private readonly repository: NotificationRepository = new InMemoryNotificationRepository(seed),
    private readonly activeProfileId: () => Promise<EntityId | undefined> = async () => undefined,
    private readonly activeWorkspaceId: () => Promise<EntityId | undefined> = async () => undefined,
  ) {}

  async evaluate(activity: KaryaActivity): Promise<KaryaNotification | undefined> {
    const request = await notificationForActivity(activity, await this.activeWorkspaceId());
    return request ? this.create({ ...request, activityId: activity.id, occurredAt: activity.occurredAt }) : undefined;
  }

  async create(request: CreateNotificationRequest): Promise<KaryaNotification> {
    const occurredAt = request.occurredAt ?? new Date().toISOString();
    const id = deterministicNotificationId(request.activityId ?? `${request.source}:${request.title}`);
    const existing = await this.repository.get(id);
    if (existing) return clone(existing);
    const notification: KaryaNotification = {
      id,
      activityId: request.activityId,
      notificationType: request.notificationType ?? request.category,
      icon: request.icon ?? "Bell",
      title: request.title,
      description: request.description,
      category: request.category,
      source: request.source,
      workspaceId: request.workspaceId,
      profileId: request.profileId,
      resourceId: request.resourceId,
      status: "unread",
      priority: request.priority ?? "normal",
      groupKey: request.groupKey,
      groupCount: 1,
      actions: request.actions ?? [],
      references: request.references ?? [],
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deliveredAt: occurredAt,
    };
    const created = await this.repository.create(notification);
    if (!created) return clone((await this.repository.get(id)) ?? notification);
    await this.publish("NotificationCreated", notification);
    return clone(notification);
  }

  async list(query: NotificationQuery = {}): Promise<KaryaNotification[]> {
    const profileId = query.profileId ?? (await this.activeProfileId());
    return this.repository.list({ ...query, profileId });
  }
  unread(profileId?: EntityId) {
    return this.list({ profileId, unreadOnly: true });
  }
  recent(limit = 50, profileId?: EntityId) {
    return this.list({ profileId, limit });
  }
  byProfile(profileId: EntityId, limit?: number) {
    return this.list({ profileId, limit });
  }
  byWorkspace(workspaceId: EntityId, limit?: number) {
    return this.list({ workspaceId, limit });
  }
  async count(profileId?: EntityId) {
    return this.repository.countUnread(profileId ?? (await this.activeProfileId()));
  }
  async latest(profileId?: EntityId) {
    return (await this.recent(1, profileId))[0];
  }
  get(id: EntityId) {
    return this.repository.get(id);
  }
  markRead(id: EntityId) {
    return this.updateStatus(id, "read", "readAt");
  }
  async applyReplica(notification: KaryaNotification): Promise<KaryaNotification> {
    await this.repository.save(notification);
    await this.eventBus.publish("NotificationUpdated", { notification });
    return notification;
  }
  async markAllRead(profileId?: EntityId): Promise<void> {
    await Promise.all((await this.unread(profileId)).map(({ id }) => this.markRead(id)));
  }
  dismiss(id: EntityId) {
    return this.updateStatus(id, "dismissed", "dismissedAt");
  }
  archive(id: EntityId) {
    return this.dismiss(id);
  }
  delete(id: EntityId) {
    return this.dismiss(id);
  }

  subscribeToActivities(): () => void {
    return this.activities.subscribe((activity) => this.evaluate(activity).then(() => undefined));
  }

  // Reminder APIs remain compatible but are intentionally inert in this slice.
  async scheduleReminder(request: ScheduleReminderRequest): Promise<ReminderSchedule> {
    const now = new Date().toISOString();
    const reminder: ReminderSchedule = {
      ...request,
      id: deterministicNotificationId(`${request.title}:${request.remindAt}`),
      status: "scheduled",
      createdAt: now,
      updatedAt: now,
    };
    this.reminders.set(reminder.id, reminder);
    return { ...reminder };
  }
  async listReminders() {
    return [...this.reminders.values()].map((value) => ({ ...value }));
  }
  async deliverDueReminders() {
    return [];
  }
  startReminderScheduler() {
    return () => undefined;
  }

  private async updateStatus(
    id: EntityId,
    status: KaryaNotification["status"],
    timestampKey: "readAt" | "dismissedAt",
  ): Promise<KaryaNotification> {
    const current = await this.repository.get(id);
    if (!current) throw new Error(`Notification not found: ${id}`);
    const now = new Date().toISOString();
    const notification = { ...current, status, updatedAt: now, [timestampKey]: now };
    await this.repository.save(notification);
    await this.publish("NotificationUpdated", notification);
    return clone(notification);
  }

  private async publish(type: "NotificationCreated" | "NotificationUpdated", notification: KaryaNotification) {
    await this.eventBus.publish(type, { notification });
    await this.eventBus.publish(type === "NotificationCreated" ? "notification:created" : "notification:updated", {
      notification,
    });
  }
}

async function notificationForActivity(
  activity: KaryaActivity,
  activeWorkspaceId?: EntityId,
): Promise<CreateNotificationRequest | undefined> {
  const common = {
    source: "activity-timeline",
    profileId: activity.profileId,
    workspaceId: activity.workspaceId,
  };
  if (activity.eventType === "WorkspaceArchived" && activity.metadata?.wasActive === true) {
    return {
      ...common,
      notificationType: "active-workspace-archived",
      category: "workspace",
      priority: "high",
      title: "Active Workspace archived",
      description: activity.object.title ?? activity.title,
      references: [{ id: activity.object.id, type: "workspace", title: activity.object.title }],
    };
  }
  if (activity.eventType === "ResourceMoved") {
    const from = parseIds(activity.metadata?.fromWorkspaceIds);
    if (activeWorkspaceId && from.includes(activeWorkspaceId)) {
      return {
        ...common,
        workspaceId: activeWorkspaceId,
        resourceId: activity.object.id,
        notificationType: "resource-moved-from-active-workspace",
        category: "workspace",
        priority: "normal",
        title: "Resource moved",
        description: `${activity.object.title ?? "A Resource"} moved from the active Workspace`,
        references: [{ id: activity.object.id, type: "resource", title: activity.object.title }],
      };
    }
  }
  if (activity.eventType === "CaptureFailed") {
    return {
      ...common,
      notificationType: "capture-missing-context",
      category: "system",
      priority: "high",
      title: "Quick Capture needs a Workspace",
      description: activity.description ?? "Choose an active Workspace and try again.",
    };
  }
  if (
    activity.eventType === "SynchronizationAttentionRequired" ||
    activity.eventType === "PermissionAttentionRequired"
  ) {
    return {
      ...common,
      notificationType: activity.eventType,
      category: "system",
      priority: "high",
      title: activity.title,
      description: activity.description,
    };
  }
  return undefined;
}

function parseIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function deterministicNotificationId(activityId: EntityId): EntityId {
  let hash = 2166136261;
  for (const character of `notification:${activityId}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `notification-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function clone(notification: KaryaNotification): KaryaNotification {
  return {
    ...notification,
    actions: notification.actions.map((action) => ({ ...action })),
    references: notification.references.map((reference) => ({ ...reference })),
  };
}

class InMemoryNotificationRepository implements NotificationRepository {
  private readonly items = new Map<EntityId, KaryaNotification>();
  constructor(seed: KaryaNotification[]) {
    seed.forEach((item) => this.items.set(item.id, clone(item)));
  }
  async create(item: KaryaNotification) {
    if (this.items.has(item.id)) return false;
    this.items.set(item.id, clone(item));
    return true;
  }
  async save(item: KaryaNotification) {
    this.items.set(item.id, clone(item));
  }
  async get(id: EntityId) {
    const item = this.items.get(id);
    return item ? clone(item) : undefined;
  }
  async list(query: NotificationQuery = {}) {
    return [...this.items.values()]
      .filter(
        (item) =>
          (!query.profileId || item.profileId === query.profileId) &&
          (!query.workspaceId || item.workspaceId === query.workspaceId) &&
          (!query.unreadOnly || item.status === "unread") &&
          (query.includeDismissed ||
            (item.status !== "dismissed" && item.status !== "archived" && item.status !== "deleted")),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
      .slice(0, query.limit ?? 500)
      .map(clone);
  }
  async countUnread(profileId?: EntityId) {
    return (await this.list({ profileId, unreadOnly: true })).length;
  }
}
