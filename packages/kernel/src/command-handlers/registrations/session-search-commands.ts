import type { Resource, SearchResult } from "@karya/types";
import type { CommandBus } from "../../command-bus";
import type { ServiceRegistry } from "../../service-registry";
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

export function registerSessionSearchCommandHandlers(commandBus: CommandBus): void {
commandBus.register("ResumeContextCommand", async (command, context) => {
    const { registry, publish } = context;
    const requestedResourceId = command.payload.resourceIds[0];
    const resource = requestedResourceId
      ? await registry.resolve("resourceService").getResource(requestedResourceId)
      : undefined;
    const currentSession = await registry.resolve("continuityService").getCurrentSession();
    const requestedWorkspaceSession = command.payload.workspaceId
      ? currentSession.workspaceSessions?.[command.payload.workspaceId]
      : undefined;
    const savedContext = currentSession.resumeContext;
    const savedContextMatches = requestedResourceId
      ? savedContext?.resourceIds.includes(requestedResourceId)
      : command.payload.workspaceId
        ? savedContext?.workspaceId === command.payload.workspaceId
        : Boolean(savedContext);
    const sessionContext = requestedWorkspaceSession && !requestedResourceId
      ? {
          profileId: requestedWorkspaceSession.profileId,
          workspaceId: requestedWorkspaceSession.workspaceId,
          resourceIds: requestedWorkspaceSession.activeResourceIds.length
            ? requestedWorkspaceSession.activeResourceIds
            : requestedWorkspaceSession.recentResourceIds,
          applicationIds: requestedWorkspaceSession.launchedApplicationIds,
          navigation: requestedWorkspaceSession.lastNavigationContext,
          selectedResourceId: requestedWorkspaceSession.lastSelectedResourceId,
        }
      : undefined;
    const workspaceId =
      command.payload.workspaceId ??
      sessionContext?.workspaceId ??
      (savedContextMatches ? savedContext?.workspaceId : undefined) ??
      resource?.primaryWorkspaceId ??
      resource?.workspaceRefs[0];
    const resourceIds = command.payload.resourceIds.length
      ? command.payload.resourceIds
      : sessionContext?.resourceIds.length
        ? sessionContext.resourceIds
        : savedContextMatches
          ? savedContext?.resourceIds ?? []
          : [];
    const profileId = resource?.profileId ?? sessionContext?.profileId ?? savedContext?.profileId ?? currentSession.activeProfileId;
    const selectedResourceId = requestedResourceId ?? sessionContext?.selectedResourceId ?? resourceIds[0];

    if (workspaceId) {
      await registry.resolve("workspaceService").open(workspaceId);
    }

    if (selectedResourceId) {
      await publish("ResourceSelected", { resourceId: selectedResourceId });
    }

    if (workspaceId && sessionContext) {
      if (sessionContext.navigation) {
        await registry.resolve("continuityService").updateWorkspaceNavigation({
          ...sessionContext.navigation,
          profileId,
          capturedAt: new Date().toISOString(),
        });
      }
      const session = await registry.resolve("continuityService").resumeWorkspaceSession(workspaceId, profileId);
      for (const applicationId of sessionContext.applicationIds ?? []) {
        await registry.resolve("applicationRegistry").launchApplication({
          applicationId,
          workspaceId,
          profileId,
          resourceIds,
        });
      }
      return session;
    }

    const session = await registry.resolve("continuityService").resumeContext({
      profileId,
      workspaceId,
      resourceIds,
      applicationIds: savedContextMatches ? savedContext?.applicationIds : undefined,
      workingDirectory: savedContextMatches ? savedContext?.workingDirectory : undefined,
      launchArguments: savedContextMatches ? savedContext?.launchArguments : undefined,
    });

    if (requestedResourceId && resource && workspaceId) {
      await registry.resolve("continuityService").recordWorkspaceResourceActivity({
        workspaceId,
        profileId,
        resourceId: requestedResourceId,
        title: resource.metadata.title,
        type: "resource-resumed",
      });
      await registry.resolve("continuityService").updateWorkspaceNavigation({
        surface: readStringAttribute(resource, "folderParentId") ? "folder" : "workspace",
        workspaceId,
        profileId,
        folderId: readStringAttribute(resource, "folderParentId"),
        selectedResourceId: requestedResourceId,
        capturedAt: new Date().toISOString(),
      });
    }

    if (savedContextMatches && savedContext) {
      for (const applicationId of savedContext.applicationIds ?? []) {
        await registry.resolve("applicationRegistry").launchApplication({
          applicationId,
          workspaceId,
          profileId,
          resourceIds,
          workingDirectory: savedContext.workingDirectory,
          launchArguments: savedContext.launchArguments,
        });
      }
    }

    if (requestedResourceId && resource && getResourcePath(resource)) {
      await openResourceById(requestedResourceId, context);
    }

    return session;
  });

  commandBus.register("SearchCommand", async (command, { registry, publish }) => {
    const results = await registry.resolve("searchService").query(command.payload.term);
    const expandedResults = await expandRelationshipResults(results, registry);
    const session = await registry.resolve("continuityService").getCurrentSession();
    const rankedResults = rankSearchResultsByActivity(expandedResults, session);
    await publish("SearchCompleted", { query: command.payload.term, results: rankedResults });
    return rankedResults;
  });

  commandBus.register("OpenSettingCommand", async (command, { publish }) => {
    await publish("SettingOpened", { settingId: command.payload.settingId });
    return command.payload.settingId;
  });

  commandBus.register("SelectResourceCommand", async (command, context) => {
    if (command.payload.resourceId) {
      const resource = await context.registry.resolve("resourceService").getResource(command.payload.resourceId);
      if (resource) {
        const activeWorkspace = await context.registry.resolve("workspaceService").getActiveWorkspace();
        await recordResourceNavigation(resource, context, activeWorkspace?.id);
      }
    }
    await context.publish("ResourceSelected", { resourceId: command.payload.resourceId });
    return command.payload.resourceId;
  });

  commandBus.register("SelectCalendarEventCommand", async (command, context) => {
    await context.publish("CalendarEventSelected", { eventId: command.payload.eventId });
    return command.payload.eventId;
  });
}

async function expandRelationshipResults(results: SearchResult[], registry: ServiceRegistry): Promise<SearchResult[]> {
  const expanded = [...results];
  const seenDocumentIds = new Set(expanded.map((result) => result.document.id));
  const documents = await registry.resolve("searchService").listDocuments();

  for (const result of results) {
    if (result.document.type !== "resource" && result.document.type !== "event") continue;
    const relatedObjects = await registry.resolve("relationshipService").listRelatedObjects({
      id: result.document.sourceId,
      type: result.document.type,
    });

    for (const related of relatedObjects) {
      const document = documents.find((candidate) =>
        candidate.type === related.ref.type && candidate.sourceId === related.ref.id,
      );
      if (!document || seenDocumentIds.has(document.id)) continue;
      seenDocumentIds.add(document.id);
      expanded.push({
        document: {
          ...document,
          subtitle: document.subtitle ? `${document.subtitle} · Related` : "Related",
          keywords: [...document.keywords, result.document.title, related.relationship.type],
        },
        score: Math.max(1, Math.floor(result.score * 0.6)),
      });
    }
  }

  return expanded.sort((left, right) => right.score - left.score);
}
