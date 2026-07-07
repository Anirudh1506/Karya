import type { KaryaNotification, NotificationAction, NotificationCategory, NotificationObjectReference, NotificationPriority, ReminderSchedule, EntityId } from "@karya/types";

export interface CreateNotificationRequest {
  icon?: string;
  title: string;
  description?: string;
  category: NotificationCategory;
  source: string;
  workspaceId?: EntityId;
  profileId?: EntityId;
  priority?: NotificationPriority;
  groupKey?: string;
  actions?: NotificationAction[];
  references?: NotificationObjectReference[];
  scheduledFor?: string;
  deliver?: boolean;
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
  create(request: CreateNotificationRequest): Promise<KaryaNotification>;
  list(): Promise<KaryaNotification[]>;
  get(id: EntityId): Promise<KaryaNotification | undefined>;
  markRead(id: EntityId): Promise<KaryaNotification>;
  archive(id: EntityId): Promise<KaryaNotification>;
  delete(id: EntityId): Promise<KaryaNotification>;
  scheduleReminder(request: ScheduleReminderRequest): Promise<ReminderSchedule>;
  listReminders(): Promise<ReminderSchedule[]>;
  deliverDueReminders(now?: string): Promise<KaryaNotification[]>;
  subscribeToEvents(): () => void;
  startReminderScheduler(intervalMs?: number): () => void;
}
