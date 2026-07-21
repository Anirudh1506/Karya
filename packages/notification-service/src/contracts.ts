import type {
  EntityId,
  KaryaActivity,
  KaryaNotification,
  NotificationAction,
  NotificationCategory,
  NotificationObjectReference,
  NotificationPriority,
  ReminderSchedule,
} from "@karya/types";

export interface CreateNotificationRequest {
  activityId?: EntityId;
  notificationType?: string;
  icon?: string;
  title: string;
  description?: string;
  category: NotificationCategory;
  source: string;
  workspaceId?: EntityId;
  profileId?: EntityId;
  resourceId?: EntityId;
  priority?: NotificationPriority;
  groupKey?: string;
  actions?: NotificationAction[];
  references?: NotificationObjectReference[];
  scheduledFor?: string;
  occurredAt?: string;
  deliver?: boolean;
}

export interface NotificationQuery {
  profileId?: EntityId;
  workspaceId?: EntityId;
  unreadOnly?: boolean;
  includeDismissed?: boolean;
  limit?: number;
}

export interface ScheduleReminderRequest {
  title: string;
  description?: string;
  category: NotificationCategory;
  source: string;
  workspaceId?: EntityId;
  profileId?: EntityId;
  objectRef?: NotificationObjectReference;
  remindAt: string;
  repeat?: ReminderSchedule["repeat"];
  relativeOffsetMinutes?: number;
}

export interface NotificationService {
  evaluate(activity: KaryaActivity): Promise<KaryaNotification | undefined>;
  create(request: CreateNotificationRequest): Promise<KaryaNotification>;
  list(query?: NotificationQuery): Promise<KaryaNotification[]>;
  unread(profileId?: EntityId): Promise<KaryaNotification[]>;
  recent(limit?: number, profileId?: EntityId): Promise<KaryaNotification[]>;
  byProfile(profileId: EntityId, limit?: number): Promise<KaryaNotification[]>;
  byWorkspace(workspaceId: EntityId, limit?: number): Promise<KaryaNotification[]>;
  count(profileId?: EntityId): Promise<number>;
  latest(profileId?: EntityId): Promise<KaryaNotification | undefined>;
  get(id: EntityId): Promise<KaryaNotification | undefined>;
  markRead(id: EntityId): Promise<KaryaNotification>;
  markAllRead(profileId?: EntityId): Promise<void>;
  dismiss(id: EntityId): Promise<KaryaNotification>;
  archive(id: EntityId): Promise<KaryaNotification>;
  delete(id: EntityId): Promise<KaryaNotification>;
  subscribeToActivities(): () => void;
  scheduleReminder(request: ScheduleReminderRequest): Promise<ReminderSchedule>;
  listReminders(): Promise<ReminderSchedule[]>;
  deliverDueReminders(now?: string): Promise<KaryaNotification[]>;
  startReminderScheduler(intervalMs?: number): () => void;
  applyReplica(notification: KaryaNotification): Promise<KaryaNotification>;
}
