import { fileNameFromPath, parentPath, type Resource } from "@karya/types";
import type { CommandBus } from "../../command-bus";
import {
  assertPathAvailable,
  checkResourceAvailability,
  createIndexedNoteAttributes,
  createLinkedResourceAttributes,
  createNativeBookmark,
  createNativeCalendarEvent,
  createNativeNote,
  createNativeTask,
  createNoteContentAttributes,
  getResourcePath,
  isEditableKaryaNote,
  isKaryaBookmark,
  isKaryaCalendarEvent,
  isKaryaTask,
  isLinkedResource,
  isNoteFile,
  markResourceHealth,
  normalizeBookmarkUrl,
  openResourceById,
  openResourceWithApplication,
  rankSearchResultsByActivity,
  readStringAttribute,
  recordResourceNavigation,
  registryUpdateMetadata,
  requireResource,
  requireResourcePath,
  resolveImportDestination,
  summarizeNote,
  syncLinkedResource,
  updateNativeBookmark,
  updateNativeCalendarEvent,
  updateNativeTask,
} from "../helpers";

export function registerImportFolderCommandHandlers(commandBus: CommandBus): void {
  commandBus.register("ImportContentCommand", async (command, context) => {
    if (!context.contentStore) {
      throw new Error("Content store is not configured");
    }

    const pendingImport = await context.contentStore.prepareImport({
      path: command.payload.path,
      originalName: command.payload.displayTitle ?? fileNameFromPath(command.payload.path),
    });
    context.afterRollback(() => pendingImport.rollback());

    const destination = await resolveImportDestination(command.payload.destination, context);
    const content = pendingImport.content;
    const importedNoteContent = isNoteFile(content.extension)
      ? await context.platform?.fileSystem.readTextFile(command.payload.path)
      : undefined;
    const isImportedNote = typeof importedNoteContent === "string";
    const resource = await context.registry.resolve("resourceService").create({
      displayTitle: command.payload.displayTitle ?? content.originalName ?? "Imported Resource",
      type: isImportedNote ? "text/markdown" : content.mimeType,
      owner: destination.profileId,
      profileId: destination.profileId,
      workspaceRefs: destination.workspaceRefs,
      primaryWorkspaceId: destination.primaryWorkspaceId,
      defaultSpace: destination.defaultSpace,
      tags: command.payload.tags ?? (isImportedNote ? ["imported", "note"] : ["imported"]),
      metadata: {
        kind: isImportedNote ? "note" : "content",
        description: isImportedNote ? summarizeNote(importedNoteContent) : undefined,
        attributes: {
          contentAddress: content.address,
          contentByteLength: content.byteLength,
          contentMimeType: content.mimeType,
          contentOriginalName: content.originalName ?? null,
          contentExtension: content.extension ?? null,
          contentSourcePath: command.payload.path,
          contentContainingDirectory: parentPath(command.payload.path),
          resourceHealth: "available",
          resourceLocationKind: "local",
          resourceLastVerifiedAt: new Date().toISOString(),
          folderParentId: command.payload.folderParentId ?? null,
          folderRelativePath: command.payload.relativePath ?? null,
          ...(isImportedNote
            ? {
                noteOrigin: "imported",
                noteEditableInKarya: true,
                ...createNoteContentAttributes(importedNoteContent),
              }
            : {}),
        },
      },
    });

    context.afterCommit(async () => {
      await pendingImport.commit({ resourceId: resource.id });
      await context.publish("ResourceContentImported", { resource, content });
      if (command.payload.folderParentId) {
        const folder = await context.registry.resolve("resourceService").getResource(command.payload.folderParentId);
        if (folder) {
          await context.publish("ChildResourceDiscovered", { folder, child: resource });
        }
      }
    });

    return resource;
  });

  commandBus.register("CreateFolderResourceCommand", async (command, { registry, publish }) => {
    const destination = await resolveImportDestination(command.payload.destination, { registry });
    const folder = await registry.resolve("resourceService").create({
      displayTitle: command.payload.displayTitle ?? fileNameFromPath(command.payload.path),
      type: "inode/directory",
      owner: destination.profileId,
      profileId: destination.profileId,
      workspaceRefs: destination.workspaceRefs,
      primaryWorkspaceId: destination.primaryWorkspaceId,
      defaultSpace: destination.defaultSpace,
      tags: ["folder", "imported"],
      metadata: {
        kind: "folder",
        description: "Imported folder",
        attributes: {
          folderPath: command.payload.path,
          contentSourcePath: command.payload.path,
          contentContainingDirectory: parentPath(command.payload.path),
          folderImportStatus: "queued",
          folderIndexedCount: 0,
          folderChildCount: 0,
          resourceHealth: "available",
          resourceLocationKind: "local",
          resourceLastVerifiedAt: new Date().toISOString(),
        },
      },
    });
    await publish("FolderImported", { folder });
    return folder;
  });

  commandBus.register("UpdateFolderImportStatusCommand", async (command, context) => {
    const folder = await requireResource(command.payload.folderId, context);
    const updated = await registryUpdateMetadata(context, folder.id, {
      attributes: {
        folderImportStatus: command.payload.importStatus,
        folderIndexedCount: command.payload.indexedCount ?? Number(folder.metadata.attributes?.folderIndexedCount ?? 0),
        folderChildCount: command.payload.childCount ?? Number(folder.metadata.attributes?.folderChildCount ?? 0),
        folderLastIndexedAt: new Date().toISOString(),
      },
    });
    if (command.payload.importStatus === "indexed") {
      await context.publish("FolderIndexed", {
        folder: updated,
        indexedCount: Number(updated.metadata.attributes?.folderIndexedCount ?? 0),
      });
    } else {
      await context.publish("FolderUpdated", { folder: updated });
    }
    return updated;
  });

  commandBus.register("OpenFolderResourceCommand", async (command, context) => {
    const folder = await requireResource(command.payload.resourceId, context);
    if (folder.metadata.kind !== "folder" && folder.type !== "inode/directory") {
      throw new Error(`Resource is not a folder: ${folder.id}`);
    }
    if (isLinkedResource(folder)) {
      return openResourceById(folder.id, context);
    }
    const requestedWorkspaceId = command.payload.workspaceId;
    const workspaceId =
      requestedWorkspaceId && folder.workspaceRefs.includes(requestedWorkspaceId)
        ? requestedWorkspaceId
        : (folder.primaryWorkspaceId ?? folder.workspaceRefs[0]);
    const workspace = workspaceId
      ? (await context.registry.resolve("workspaceService").listWorkspaces()).find(
          (candidate) => candidate.id === workspaceId,
        )
      : undefined;
    if (workspaceId) {
      await context.registry.resolve("continuityService").updateWorkspaceNavigation({
        surface: "folder",
        workspaceId,
        profileId: folder.profileId,
        folderId: folder.id,
        selectedResourceId: folder.id,
        capturedAt: new Date().toISOString(),
      });
    }
    await context.publish("FolderSurfaceOpened", { folder, workspace });
    return folder;
  });

  commandBus.register("OpenHomeSurfaceCommand", async (_command, context) => {
    await context.publish("HomeSurfaceOpened", {});
  });
}
