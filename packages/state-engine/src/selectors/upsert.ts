import type { EntityId, InstalledApplication } from "@karya/types";

export function upsertById<TItem extends { id: EntityId }>(items: TItem[], item: TItem): TItem[] {
  const exists = items.some((current) => current.id === item.id);
  return exists ? items.map((current) => (current.id === item.id ? item : current)) : [...items, item];
}

export function upsertApplication(items: InstalledApplication[], item: InstalledApplication): InstalledApplication[] {
  const exists = items.some((current) => current.metadata.id === item.metadata.id);
  return exists
    ? items.map((current) => (current.metadata.id === item.metadata.id ? item : current))
    : [...items, item];
}
