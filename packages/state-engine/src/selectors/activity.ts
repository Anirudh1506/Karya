import type { EntityId, KaryaActivity } from "@karya/types";
import type { ActivityState } from "../types";

export function deriveActivity(activities: KaryaActivity[]): ActivityState {
  const items = [...activities].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const todayKey = new Date().toISOString().slice(0, 10);
  return {
    items,
    recent: items.slice(0, 50),
    today: items.filter((activity) => activity.occurredAt.slice(0, 10) === todayKey),
    byWorkspace: groupBy(items, (activity) => activity.workspaceId),
    byProfile: groupBy(items, (activity) => activity.profileId),
    byObject: groupByObject(items),
    grouped: deriveActivityGroups(items),
  };
}

function deriveActivityGroups(items: KaryaActivity[]): ActivityState["grouped"] {
  const groups = new Map<string, KaryaActivity[]>();
  for (const item of items) {
    const key = `${item.groupKey}:${item.occurredAt.slice(0, 10)}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()]
    .map(([key, groupItems]) => ({
      key,
      items: groupItems,
      count: groupItems.reduce((total, item) => total + item.groupCount, 0),
      latest: groupItems[0],
    }))
    .sort((left, right) => right.latest.occurredAt.localeCompare(left.latest.occurredAt));
}

function groupBy(items: KaryaActivity[], keyFor: (item: KaryaActivity) => EntityId | undefined): Record<EntityId, KaryaActivity[]> {
  return items.reduce<Record<EntityId, KaryaActivity[]>>((groups, item) => {
    const key = keyFor(item);
    if (!key) return groups;
    groups[key] = [...(groups[key] ?? []), item];
    return groups;
  }, {});
}

function groupByObject(items: KaryaActivity[]): Record<string, KaryaActivity[]> {
  return items.reduce<Record<string, KaryaActivity[]>>((groups, item) => {
    const keys = [`${item.object.type}:${item.object.id}`, ...item.relatedObjects.map((reference) => `${reference.type}:${reference.id}`)];
    for (const key of keys) {
      groups[key] = [...(groups[key] ?? []), item];
    }
    return groups;
  }, {});
}
