import { fileNameFromPath, parentPath, type Resource } from "@karya/types";
import type { CommandBus } from "../../command-bus";
import {
  assertPathAvailable,
  checkResourceAvailability,
  createLinkedResourceAttributes,
  createNativeBookmark,
  createNativeCalendarEvent,
  createNativeNote,
  createNativeTask,
  createNoteContentAttributes,
  getResourcePath,
  isEditableKaryaNote,
  isKaryaBookmark,
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
  requireActiveResourceContext,
  summarizeNote,
  syncLinkedResource,
  updateNativeBookmark,
  updateNativeCalendarEvent,
  updateNativeTask,
} from "../helpers";

export function registerNativeResourceCommandHandlers(commandBus: CommandBus): void {
  commandBus.register("CreateResourceCommand", async (command, { registry }) => {
    const active = await requireActiveResourceContext({ registry });
    if (command.payload.destination?.workspaceId && command.payload.destination.workspaceId !== active.workspace.id) {
      throw new Error("Resource creation must target the active Workspace");
    }
    const destination = {
      defaultSpace: active.defaultSpace,
      primaryWorkspaceId: active.workspace.id,
      profileId: active.ownershipProfileId,
      workspaceRefs: [active.workspace.id],
    };
    if (command.payload.resourceType === "note") {
      return createNativeNote(
        {
          title: command.payload.displayTitle,
          content: "",
          destination,
          tags: command.payload.tags ?? ["note", "created"],
        },
        { registry },
      );
    }

    return registry.resolve("resourceService").create({
      displayTitle: command.payload.displayTitle ?? "Untitled Resource",
      type: command.payload.resourceType,
      owner: destination.profileId,
      profileId: destination.profileId,
      workspaceRefs: destination.workspaceRefs,
      primaryWorkspaceId: destination.primaryWorkspaceId,
      defaultSpace: destination.defaultSpace,
      tags: command.payload.tags ?? ["created"],
    });
  });

  commandBus.register("CreateNoteCommand", async (command, context) => {
    const active = await requireActiveResourceContext(context);
    if (command.payload.destination?.workspaceId && command.payload.destination.workspaceId !== active.workspace.id) {
      throw new Error("Resource creation must target the active Workspace");
    }
    const destination = {
      defaultSpace: active.defaultSpace,
      primaryWorkspaceId: active.workspace.id,
      profileId: active.ownershipProfileId,
      workspaceRefs: [active.workspace.id],
    };
    return createNativeNote(
      {
        title: command.payload.title,
        content: command.payload.content ?? "",
        destination,
        tags: ["note", "created"],
      },
      context,
    );
  });

  commandBus.register("UpdateNoteContentCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    if (!isEditableKaryaNote(resource)) {
      throw new Error(`Resource is not an editable Karya note: ${resource.id}`);
    }
    const updated = await registryUpdateMetadata(context, resource.id, {
      description: summarizeNote(command.payload.content),
      attributes: {
        ...(resource.metadata.attributes ?? {}),
        ...createNoteContentAttributes(command.payload.content),
        noteLastEditedAt: new Date().toISOString(),
      },
    });
    return updated;
  });

  commandBus.register("CreateTaskCommand", async (command, context) => {
    const destination = await resolveImportDestination(command.payload.destination, context);
    return createNativeTask(
      {
        title: command.payload.title,
        description: command.payload.description ?? "",
        checklistItems: command.payload.checklistItems ?? [],
        checklistCompleted: command.payload.checklistCompleted ?? [],
        labels: command.payload.labels ?? [],
        status: command.payload.status ?? "todo",
        priority: command.payload.priority ?? "none",
        dueDate: command.payload.dueDate,
        reminderAt: command.payload.reminderAt,
        reminderDate: command.payload.reminderDate,
        reminderTime: command.payload.reminderTime,
        reminderRepeat: command.payload.reminderRepeat,
        pinned: command.payload.pinned ?? false,
        parentTaskId: command.payload.parentTaskId,
        destination,
        tags: command.payload.tags ?? ["task", "created"],
      },
      context,
    );
  });

  commandBus.register("UpdateTaskCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    if (!isKaryaTask(resource)) {
      throw new Error(`Resource is not a Karya task: ${resource.id}`);
    }
    return updateNativeTask(resource, command.payload.patch, context);
  });

  commandBus.register("CompleteTaskCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    if (!isKaryaTask(resource)) {
      throw new Error(`Resource is not a Karya task: ${resource.id}`);
    }
    return updateNativeTask(resource, { status: "completed" }, context);
  });

  commandBus.register("ReopenTaskCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    if (!isKaryaTask(resource)) {
      throw new Error(`Resource is not a Karya task: ${resource.id}`);
    }
    return updateNativeTask(resource, { status: "todo" }, context);
  });

  commandBus.register("CreateBookmarkCommand", async (command, context) => {
    const destination = await resolveImportDestination(command.payload.destination, context);
    const normalizedUrl = normalizeBookmarkUrl(command.payload.url);
    const metadata = await context.platform?.web.fetchMetadata(normalizedUrl);
    return createNativeBookmark(
      {
        url: metadata?.url ?? normalizedUrl,
        title: command.payload.title ?? metadata?.title,
        description: command.payload.description ?? metadata?.description,
        websiteName: command.payload.websiteName ?? metadata?.siteName,
        favicon: command.payload.favicon ?? metadata?.favicon,
        previewImage: command.payload.previewImage ?? metadata?.previewImage,
        notes: command.payload.notes ?? "",
        labels: command.payload.labels ?? [],
        readingStatus: command.payload.readingStatus ?? "unread",
        favorite: command.payload.favorite ?? false,
        pinned: command.payload.pinned ?? false,
        destination,
        tags: command.payload.tags ?? ["bookmark", "created"],
      },
      context,
    );
  });

  commandBus.register("UpdateBookmarkCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    if (!isKaryaBookmark(resource)) {
      throw new Error(`Resource is not a Karya bookmark: ${resource.id}`);
    }
    return updateNativeBookmark(resource, command.payload.patch, context);
  });

  commandBus.register("CreateCalendarEventCommand", async (command, context) => {
    const destination = await resolveImportDestination(command.payload.destination, context);
    return createNativeCalendarEvent(
      {
        title: command.payload.title,
        description: command.payload.description ?? "",
        startDate: command.payload.startDate,
        endDate: command.payload.endDate,
        startTime: command.payload.startTime,
        endTime: command.payload.endTime,
        timeZone: command.payload.timeZone,
        allDay: command.payload.allDay ?? false,
        color: command.payload.color,
        labels: command.payload.labels ?? [],
        category: command.payload.category ?? "meeting",
        reminder: command.payload.reminder,
        recurrence: command.payload.recurrence,
        repeatUntil: command.payload.repeatUntil,
        location: command.payload.location,
        url: command.payload.url,
        relatedResourceIds: command.payload.relatedResourceIds ?? [],
        destination,
        tags: command.payload.tags ?? ["calendar", "event", "created"],
      },
      context,
    );
  });

  commandBus.register("UpdateCalendarEventCommand", async (command, context) => {
    const event = await context.registry.resolve("eventService").getEvent(command.payload.eventId);
    if (!event) {
      throw new Error(`Calendar event not found: ${command.payload.eventId}`);
    }
    return updateNativeCalendarEvent(event, command.payload.patch, context);
  });

  commandBus.register("ArchiveCalendarEventCommand", async (command, context) => {
    await context.registry.resolve("eventService").archive(command.payload.eventId);
  });

  commandBus.register("DeleteCalendarEventCommand", async (command, context) => {
    await context.registry.resolve("eventService").delete(command.payload.eventId);
  });

  commandBus.register("LinkResourceCommand", async (command, context) => {
    const metadata = await context.platform?.fileSystem.getMetadata(command.payload.path);
    if (!metadata) {
      throw new Error(`Cannot link missing filesystem item: ${command.payload.path}`);
    }

    const destination = await resolveImportDestination(command.payload.destination, context);
    const noteLike = metadata.kind === "file" && isNoteFile(metadata.extension);
    const linked = await context.registry.resolve("resourceService").create({
      displayTitle: command.payload.displayTitle ?? metadata.name,
      type: metadata.mimeType ?? (metadata.kind === "directory" ? "inode/directory" : "application/octet-stream"),
      owner: destination.profileId,
      profileId: destination.profileId,
      workspaceRefs: destination.workspaceRefs,
      primaryWorkspaceId: destination.primaryWorkspaceId,
      defaultSpace: destination.defaultSpace,
      tags: metadata.kind === "directory" ? ["linked", "folder"] : noteLike ? ["linked", "note"] : ["linked"],
      metadata: {
        kind: metadata.kind === "directory" ? "folder" : noteLike ? "note" : "content",
        description:
          metadata.kind === "directory"
            ? "Linked folder on this computer"
            : noteLike
              ? "Linked note on this computer"
              : "Linked file on this computer",
        attributes: {
          ...createLinkedResourceAttributes(metadata, command.payload.path),
          ...(noteLike
            ? {
                noteOrigin: "linked",
                noteEditableInKarya: false,
              }
            : {}),
        },
      },
    });
    await context.publish("ResourceReferenced", {
      resource: linked,
      workspaceId: destination.primaryWorkspaceId ?? destination.workspaceRefs[0],
    });
    return linked;
  });

  commandBus.register("SyncLinkedResourceCommand", async (command, context) => {
    const resource = await requireResource(command.payload.resourceId, context);
    return syncLinkedResource(resource, context);
  });

  commandBus.register("SyncLinkedResourcesCommand", async (_command, context) => {
    const resources = await context.registry.resolve("resourceService").listResources();
    const linkedResources = resources.filter((resource) => isLinkedResource(resource));
    const synced: Resource[] = [];
    for (const resource of linkedResources) {
      synced.push(await syncLinkedResource(resource, context));
    }
    return synced;
  });
}
