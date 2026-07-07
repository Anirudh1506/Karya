import type { FileSystemMetadata } from "@karya/platform";
import type { Resource } from "@karya/types";
import { dirname } from "node:path";
import type { CommandContext } from "./resource-context";
import { getResourcePath, markResourceHealth, readStringAttribute, registryUpdateMetadata } from "./resource-context";

export async function syncLinkedResource(
  resource: Resource,
  context: CommandContext,
): Promise<Resource> {
  if (!isLinkedResource(resource)) {
    return checkResourceAvailability(resource, context);
  }
  if (resource.lifecycleState === "archived") {
    return markResourceHealth(resource.id, "archived", context);
  }

  const currentPath = getResourcePath(resource);
  if (currentPath) {
    const currentMetadata = await context.platform?.fileSystem.getMetadata(currentPath);
    if (currentMetadata) {
      return updateLinkedResourceFromMetadata(resource, currentMetadata, currentPath, "available", context);
    }
  }

  const fileSystemId = readStringAttribute(resource, "linkedFileSystemId");
  const containingDirectory = readStringAttribute(resource, "contentContainingDirectory");
  const originalDirectory = readStringAttribute(resource, "linkedOriginalDirectory");
  const recovered = fileSystemId
    ? await context.platform?.fileSystem.findByFileSystemId(
      fileSystemId,
      [containingDirectory, originalDirectory].filter((value): value is string => Boolean(value)),
    )
    : undefined;

  if (recovered) {
    return updateLinkedResourceFromMetadata(resource, recovered, recovered.path, "moved", context);
  }

  return markResourceHealth(resource.id, "missing", context);
}

export async function checkResourceAvailability(resource: Resource, context: CommandContext): Promise<Resource> {
  if (resource.lifecycleState === "archived") {
    return markResourceHealth(resource.id, "archived", context);
  }
  const path = getResourcePath(resource);
  if (!path) {
    return markResourceHealth(resource.id, "offline", context);
  }
  const exists = await context.platform?.fileSystem.exists(path);
  return markResourceHealth(resource.id, exists ? "available" : "missing", context);
}

export async function updateLinkedResourceFromMetadata(
  resource: Resource,
  metadata: FileSystemMetadata,
  previousPath: string,
  health: "available" | "moved",
  context: CommandContext,
): Promise<Resource> {
  const titleChanged = resource.metadata.title !== metadata.name;
  const synced = await registryUpdateMetadata(context, resource.id, {
    title: metadata.name,
    kind: metadata.kind === "directory" ? "folder" : "content",
    updatedAt: new Date().toISOString(),
    attributes: {
      ...createLinkedResourceAttributes(metadata, metadata.path),
      linkedPreviousPath: health === "moved" ? previousPath : readStringAttribute(resource, "linkedPreviousPath") ?? null,
      resourceHealth: health,
    },
  });
  if (titleChanged) {
    await context.publish("ResourceRenamed", { resource: synced });
  } else {
    await context.publish("ResourceUpdated", { resource: synced });
  }
  return synced;
}

export function isLinkedResource(resource: Resource): boolean {
  return resource.metadata.attributes?.resourceLocationKind === "local-linked"
    || resource.tags.includes("linked");
}

export function createLinkedResourceAttributes(metadata: FileSystemMetadata, path: string): NonNullable<Resource["metadata"]["attributes"]> {
  return {
    contentSourcePath: path,
    contentContainingDirectory: dirname(path),
    contentByteLength: metadata.byteLength,
    contentMimeType: metadata.mimeType ?? (metadata.kind === "directory" ? "inode/directory" : "application/octet-stream"),
    contentOriginalName: metadata.name,
    contentExtension: metadata.extension ?? null,
    folderPath: metadata.kind === "directory" ? path : null,
    linked: true,
    linkedFileSystemId: metadata.fileSystemId ?? null,
    linkedOriginalDirectory: dirname(path),
    linkedLastModifiedAt: metadata.modifiedAt ?? null,
    linkedCreatedAt: metadata.createdAt ?? null,
    resourceHealth: "available",
    resourceLocationKind: "local-linked",
    resourceLastVerifiedAt: new Date().toISOString(),
  };
}
