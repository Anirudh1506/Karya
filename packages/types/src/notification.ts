import type { EntityId, ISODateString } from "./common";
import type { RelationshipObjectType } from "./resource";

export type NotificationCategory =
  | "calendar"
  | "task"
  | "import"
  | "workspace"
  | "system"
  | "collaboration"
  | "ai"
  | "automation";

export type NotificationStatus = "unread" | "read" | "archived" | "deleted";

export type NotificationPriority = "low" | "normal" | "high" | "critical";

export interface NotificationAction {
  id: EntityId;
  label: string;
  command:
    | "openResource"
    | "openEvent"
    | "openWorkspace"
    | "openFolder"
    | "completeTask"
    | "snooze"
    | "dismiss"
    | "archive"
    | "openSearch";
  targetId?: EntityId;
  targetType?: RelationshipObjectType | "workspace" | "notification";
  payload?: Record<string, string>;
}

export interface NotificationObjectReference {
  id: EntityId;
  type: RelationshipObjectType | "workspace" | "profile" | "import" | "system";
  title?: string;
}

export interface KaryaNotification {
  id: EntityId;
  icon: string;
  title: string;
  description?: string;
  category: NotificationCategory;
  source: string;
  workspaceId?: EntityId;
  profileId?: EntityId;
  status: NotificationStatus;
  priority: NotificationPriority;
  groupKey?: string;
  groupCount: number;
  actions: NotificationAction[];
  references: NotificationObjectReference[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  deliveredAt?: ISODateString;
  scheduledFor?: ISODateString;
  archivedAt?: ISODateString;
  readAt?: ISODateString;
  deletedAt?: ISODateString;
}

export interface ReminderSchedule {
  id: EntityId;
  notificationId?: EntityId;
  title: string;
  description?: string;
  category: NotificationCategory;
  source: string;
  workspaceId?: EntityId;
  profileId?: EntityId;
  objectRef?: NotificationObjectReference;
  remindAt: ISODateString;
  repeat?: "none" | "daily" | "weekly" | "monthly";
  relativeOffsetMinutes?: number;
  status: "scheduled" | "delivered" | "cancelled";
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
