import type { EntityId, KaryaNotification } from "@karya/types";
import type { NotificationState } from "../types";

export function deriveNotifications(notifications: KaryaNotification[]): NotificationState {
  const visible = notifications
    .filter((notification) => notification.status !== "deleted")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const unread = visible.filter((notification) => notification.status === "unread");
  const archived = visible.filter((notification) => notification.status === "archived");
  const active = visible.filter((notification) => notification.status !== "archived");

  return {
    items: visible,
    unread,
    archived,
    byWorkspace: groupBy(active.filter((notification) => Boolean(notification.workspaceId)), (notification) => notification.workspaceId),
    byProfile: groupBy(active.filter((notification) => Boolean(notification.profileId)), (notification) => notification.profileId),
    grouped: deriveNotificationGroups(active),
    unreadCount: unread.length,
    attentionCount: unread.filter((notification) => notification.priority === "high" || notification.priority === "critical" || notification.category === "task" || notification.category === "calendar").length,
  };
}

function deriveNotificationGroups(notifications: KaryaNotification[]): NotificationState["grouped"] {
  const groups = new Map<string, KaryaNotification[]>();
  notifications.forEach((notification) => {
    const key = notification.groupKey ?? notification.id;
    groups.set(key, [...(groups.get(key) ?? []), notification]);
  });
  return [...groups.entries()].map(([key, items]) => ({
    key,
    items,
    count: items.reduce((total, item) => total + item.groupCount, 0),
    latest: items[0],
  }));
}

function groupBy(items: KaryaNotification[], keyFor: (item: KaryaNotification) => EntityId | undefined): Record<EntityId, KaryaNotification[]> {
  return items.reduce<Record<EntityId, KaryaNotification[]>>((groups, item) => {
    const key = keyFor(item);
    if (!key) return groups;
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}
