import type { Resource } from "@karya/types";
import type { CommandBus } from "../../command-bus";
import { basename, dirname } from "node:path";
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

export function registerResourceCommandHandlers(commandBus: CommandBus): void {
  commandBus.register("CreateRelationshipCommand", async (command, context) => {
    await context.registry.resolve("relationshipService").createRelationship({
      source: { id: command.payload.sourceId, type: command.payload.sourceType },
      target: { id: command.payload.targetId, type: command.payload.targetType },
      type: command.payload.relationshipType,
    });
    await context.publish("RelationshipCreated", command.payload);
    await context.publish("relationship:created", command.payload);
  });

  commandBus.register("RemoveRelationshipCommand", async (command, context) => {
    await context.registry.resolve("relationshipService").removeRelationship(
      { id: command.payload.sourceId, type: command.payload.sourceType },
      command.payload.relationshipId,
    );
    await context.publish("RelationshipRemoved", command.payload);
    await context.publish("relationship:removed", command.payload);
  });

  commandBus.register("CreateNotificationCommand", async (command, context) => {
    return context.registry.resolve("notificationService").create(command.payload);
  });

  commandBus.register("MarkNotificationReadCommand", async (command, context) => {
    return context.registry.resolve("notificationService").markRead(command.payload.notificationId);
  });

  commandBus.register("ArchiveNotificationCommand", async (command, context) => {
    return context.registry.resolve("notificationService").archive(command.payload.notificationId);
  });

  commandBus.register("DeleteNotificationCommand", async (command, context) => {
    return context.registry.resolve("notificationService").delete(command.payload.notificationId);
  });

  commandBus.register("ScheduleReminderCommand", async (command, context) => {
    return context.registry.resolve("notificationService").scheduleReminder(command.payload);
  });

commandBus.register("OpenResourceCommand", async (command, context) => {
    return openResourceById(command.payload.resourceId, context);
  });

  commandBus.register("OpenResourceWithApplicationCommand", async (command, context) => {
    return openResourceWithApplication(command.payload.resourceId, command.payload.applicationId, command.payload.workspaceId, context);
  });

  commandBus.register("RevealResourceCommand", async (command, context) => {
    const initialResource = await requireResource(command.payload.resourceId, context);
    const resource = isLinkedResource(initialResource) ? await syncLinkedResource(initialResource, context) : initialResource;
    const path = requireResourcePath(resource);
    await assertPathAvailable(resource, path, context);
    await context.platform?.fileSystem.revealPath(path);
    return markResourceHealth(resource.id, "available", context);
  });

  commandBus.register("OpenContainingFolderCommand", async (command, context) => {
    const initialResource = await requireResource(command.payload.resourceId, context);
    const resource = isLinkedResource(initialResource) ? await syncLinkedResource(initialResource, context) : initialResource;
    const path = requireResourcePath(resource);
    const exists = await context.platform?.fileSystem.exists(path);
    if (!exists) {
      await markResourceHealth(resource.id, "missing", context);
    }
    await context.platform?.fileSystem.openContainingFolder(path);
    return exists ? markResourceHealth(resource.id, "available", context) : requireResource(resource.id, context);
  });

  commandBus.register("CopyResourcePathCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    const path = requireResourcePath(resource);
    await context.platform?.clipboard.writeText(path);
  });

  commandBus.register("CheckResourceHealthCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    if (isLinkedResource(resource)) {
      return syncLinkedResource(resource, context);
    }
    if (resource.lifecycleState === "archived") {
      return markResourceHealth(resource.id, "archived", context);
    }
    const path = getResourcePath(resource);
    if (!path) {
      return markResourceHealth(resource.id, "offline", context);
    }
    const exists = await context.platform?.fileSystem.exists(path);
    return markResourceHealth(resource.id, exists ? "available" : "missing", context);
  });

  commandBus.register("UpdateResourceLocationCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    const metadata = await context.platform?.fileSystem.getMetadata(command.payload.path);
    return registryUpdateMetadata(context, resource.id, {
      attributes: {
        ...(resource.metadata.attributes ?? {}),
        ...(metadata ? createLinkedResourceAttributes(metadata, command.payload.path) : {
          contentSourcePath: command.payload.path,
          contentContainingDirectory: dirname(command.payload.path),
          resourceHealth: "moved",
          resourceLocationKind: "local",
          resourceLastVerifiedAt: new Date().toISOString(),
        }),
        resourceHealth: "moved",
      },
    });
  });

  commandBus.register("RenameResourceCommand", async (command, { registry }) => {
    return registry.resolve("resourceService").rename(command.payload.resourceId, command.payload.title);
  });

  commandBus.register("MoveResourceCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    const destination = await resolveImportDestination(command.payload.destination, context);
    const moved = await context.registry.resolve("resourceService").update({
      id: resource.id,
      owner: destination.profileId,
      profileId: destination.profileId,
      workspaceRefs: destination.workspaceRefs,
      primaryWorkspaceId: destination.primaryWorkspaceId,
      defaultSpace: destination.defaultSpace,
      metadata: {
        ...resource.metadata,
        updatedAt: new Date().toISOString(),
      },
    });
    await context.publish("ResourceMoved", {
      resource: moved,
      fromWorkspaceIds: resource.workspaceRefs,
      toWorkspaceIds: moved.workspaceRefs,
    });
    return moved;
  });

  commandBus.register("DuplicateResourceCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    const destination = await resolveImportDestination(
      command.payload.destination ?? {
        profileId: resource.defaultSpace === "user" ? undefined : resource.profileId,
        workspaceId: resource.primaryWorkspaceId ?? resource.workspaceRefs[0],
        defaultSpace: resource.defaultSpace,
      },
      context,
    );
    const duplicate = await context.registry.resolve("resourceService").create({
      displayTitle: `${resource.metadata.title} Copy`,
      description: resource.metadata.description,
      type: resource.type,
      owner: destination.profileId,
      profileId: destination.profileId,
      workspaceRefs: destination.workspaceRefs,
      primaryWorkspaceId: destination.primaryWorkspaceId,
      defaultSpace: destination.defaultSpace,
      metadata: {
        ...resource.metadata,
        title: `${resource.metadata.title} Copy`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tags: resource.tags,
    });
    await context.publish("ResourceDuplicated", { source: resource, duplicate });
    return duplicate;
  });

  commandBus.register("DeleteResourceCommand", async (command, { registry }) => {
    await registry.resolve("resourceService").delete(command.payload.resourceId);
  });

  commandBus.register("ArchiveResourceCommand", async (command, { registry }) => {
    await registry.resolve("resourceService").archive(command.payload.resourceId);
  });

  commandBus.register("RestoreResourceCommand", async (command, { registry }) => {
    return registry.resolve("resourceService").restore(command.payload.resourceId);
  });

  commandBus.register("AddWorkspaceReferenceCommand", async (command, context) => {
    const resource = await context.registry
      .resolve("resourceService")
      .addWorkspaceReference(command.payload.resourceId, command.payload.workspaceId, command.payload.makePrimary);
    await context.publish("ResourceReferenced", {
      resource,
      workspaceId: command.payload.workspaceId,
    });
    return resource;
  });

  commandBus.register("RemoveWorkspaceReferenceCommand", async (command, context) => {
    const resource = await context.registry
      .resolve("resourceService")
      .removeWorkspaceReference(command.payload.resourceId, command.payload.workspaceId);
    await context.publish("ResourceUnreferenced", {
      resource,
      workspaceId: command.payload.workspaceId,
    });
    return resource;
  });

  commandBus.register("UpdateResourceMetadataCommand", async (command, { registry }) => {
    return registry
      .resolve("resourceService")
      .updateMetadata(command.payload.resourceId, command.payload.metadata);
  });
}
