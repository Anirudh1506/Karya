import type { Resource } from "@karya/types";

type MetadataCarrier = Pick<Resource, "metadata">;

export function readTaskString(item: MetadataCarrier, key: string): string | undefined {
  const value = item.metadata.attributes?.[key];
  return typeof value === "string" ? value : undefined;
}

export function readTaskList(item: MetadataCarrier, key: string): string[] {
  return (readTaskString(item, key) ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function readTaskBooleanList(item: MetadataCarrier, key: string): boolean[] {
  return (readTaskString(item, key) ?? "").split("\n").map((item) => item === "1" || item === "true");
}

export function readTaskBoolean(item: MetadataCarrier, key: string): boolean {
  return item.metadata.attributes?.[key] === true;
}
