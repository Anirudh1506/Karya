import type { ShellAdapter } from "@karya/shell-adapter";
import { NoopPlatformProviders } from "@karya/platform";

let shellAdapter: ShellAdapter | undefined;
let bootPromise: Promise<void> | undefined;

export function getShellAdapter(): ShellAdapter {
  shellAdapter ??= window.karyaShell?.invoke ? createIpcShellAdapter() : createFallbackShellAdapter();
  return shellAdapter;
}

export function bootShellAdapter(): Promise<void> {
  bootPromise ??= getShellAdapter().boot();
  return bootPromise;
}

function createIpcShellAdapter(): ShellAdapter {
  const invoke = <TResponse>(method: string, ...args: unknown[]): Promise<TResponse> => {
    if (!window.karyaShell?.invoke) {
      throw new Error("Karya Shell IPC bridge is unavailable");
    }
    return window.karyaShell.invoke<TResponse>(method, args);
  };

  return {
    boot: () => invoke("boot"),
    currentAccount: () => invoke("currentAccount"),
    renameAccount: (displayName) => invoke("renameAccount", displayName),
    trustedDevices: () => invoke("trustedDevices"),
    currentDevice: () => invoke("currentDevice"),
    renameDevice: (deviceId, name) => invoke("renameDevice", deviceId, name),
    removeDevice: (deviceId) => invoke("removeDevice", deviceId),
    replicaMembership: () => invoke("replicaMembership"),
    getTransportStatus: () => invoke("getTransportStatus"),
    connectTransport: () => invoke("connectTransport"),
    disconnectTransport: () => invoke("disconnectTransport"),
    reconnectTransport: () => invoke("reconnectTransport"),
    synchronizeTransport: () => invoke("synchronizeTransport"),
    subscribe: (listener) => window.karyaShell?.subscribe(listener) ?? (() => {}),
    subscribeImports: (listener) => window.karyaShell?.subscribeImports(listener) ?? (() => {}),
    getSnapshot: () => invoke("getSnapshot"),
    execute: (command) => invoke("execute", command),
    getResource: (id) => invoke("getResource", id),
    listResources: (query) => invoke("listResources", query),
    getWorkspace: (id) => invoke("getWorkspace", id),
    listWorkspaces: (query) => invoke("listWorkspaces", query),
    recentResources: (limit) => invoke("recentResources", limit),
    search: (term) => invoke("search", term),
    executeSearchResult: (result) => invoke("executeSearchResult", result),
    createResource: (destination) => invoke("createResource", destination),
    createNote: (destination, title, content) => invoke("createNote", destination, title, content),
    updateNoteContent: (resourceId, content) => invoke("updateNoteContent", resourceId, content),
    createTask: (destination, title, options) => invoke("createTask", destination, title, options),
    updateTask: (resourceId, patch) => invoke("updateTask", resourceId, patch),
    completeTask: (resourceId) => invoke("completeTask", resourceId),
    reopenTask: (resourceId) => invoke("reopenTask", resourceId),
    createBookmark: (destination, url, options) => invoke("createBookmark", destination, url, options),
    updateBookmark: (resourceId, patch) => invoke("updateBookmark", resourceId, patch),
    createCalendarEvent: (destination, title, options) => invoke("createCalendarEvent", destination, title, options),
    updateCalendarEvent: (resourceId, patch) => invoke("updateCalendarEvent", resourceId, patch),
    archiveCalendarEvent: (eventId) => invoke("archiveCalendarEvent", eventId),
    deleteCalendarEvent: (eventId) => invoke("deleteCalendarEvent", eventId),
    linkResource: (path, displayTitle, destination) => invoke("linkResource", path, displayTitle, destination),
    linkFileFromPicker: (destination) => invoke("linkFileFromPicker", destination),
    linkDirectoryFromPicker: (destination) => invoke("linkDirectoryFromPicker", destination),
    syncLinkedResource: (resourceId) => invoke("syncLinkedResource", resourceId),
    syncLinkedResources: () => invoke("syncLinkedResources"),
    importContent: (path, displayTitle, destination) => invoke("importContent", path, displayTitle, destination),
    importFile: (path, displayTitle, destination) => invoke("importFile", path, displayTitle, destination),
    importDirectory: (path, destination) => invoke("importDirectory", path, destination),
    importFileFromPicker: (destination) => invoke("importFileFromPicker", destination),
    importDirectoryFromPicker: (destination) => invoke("importDirectoryFromPicker", destination),
    cancelImport: (jobId) => invoke("cancelImport", jobId),
    getImportJob: (jobId) => invoke("getImportJob", jobId),
    listImportJobs: () => invoke("listImportJobs"),
    openFolderResource: (resourceId, workspaceId) => invoke("openFolderResource", resourceId, workspaceId),
    openHomeSurface: () => invoke("openHomeSurface"),
    openResource: (resourceId) => invoke("openResource", resourceId),
    openResourceWithApplication: (resourceId, applicationId, workspaceId) =>
      invoke("openResourceWithApplication", resourceId, applicationId, workspaceId),
    revealResource: (resourceId) => invoke("revealResource", resourceId),
    openContainingFolder: (resourceId) => invoke("openContainingFolder", resourceId),
    copyResourcePath: (resourceId) => invoke("copyResourcePath", resourceId),
    checkResourceHealth: (resourceId) => invoke("checkResourceHealth", resourceId),
    updateResourceLocation: (resourceId, path) => invoke("updateResourceLocation", resourceId, path),
    renameResource: (resourceId, title) => invoke("renameResource", resourceId, title),
    moveResource: (resourceId, destination) => invoke("moveResource", resourceId, destination),
    duplicateResource: (resourceId, destination) => invoke("duplicateResource", resourceId, destination),
    deleteResource: (resourceId) => invoke("deleteResource", resourceId),
    archiveResource: (resourceId) => invoke("archiveResource", resourceId),
    restoreResource: (resourceId) => invoke("restoreResource", resourceId),
    addWorkspaceReference: (resourceId, workspaceId, makePrimary) =>
      invoke("addWorkspaceReference", resourceId, workspaceId, makePrimary),
    removeWorkspaceReference: (resourceId, workspaceId) => invoke("removeWorkspaceReference", resourceId, workspaceId),
    updateResourceMetadata: (resourceId, metadata) => invoke("updateResourceMetadata", resourceId, metadata),
    createRelationship: (sourceId, sourceType, targetId, targetType, relationshipType) =>
      invoke("createRelationship", sourceId, sourceType, targetId, targetType, relationshipType),
    removeRelationship: (sourceId, sourceType, relationshipId) =>
      invoke("removeRelationship", sourceId, sourceType, relationshipId),
    createNotification: (input) => invoke("createNotification", input),
    markNotificationRead: (notificationId) => invoke("markNotificationRead", notificationId),
    archiveNotification: (notificationId) => invoke("archiveNotification", notificationId),
    deleteNotification: (notificationId) => invoke("deleteNotification", notificationId),
    scheduleReminder: (input) => invoke("scheduleReminder", input),
    createWorkspace: (name, description, templateId) => invoke("createWorkspace", name, description, templateId),
    switchWorkspace: (workspaceId) => invoke("switchWorkspace", workspaceId),
    openWorkspace: (workspaceId) => invoke("openWorkspace", workspaceId),
    closeWorkspace: (workspaceId) => invoke("closeWorkspace", workspaceId),
    renameWorkspace: (workspaceId, name) => invoke("renameWorkspace", workspaceId, name),
    archiveWorkspace: (workspaceId) => invoke("archiveWorkspace", workspaceId),
    restoreWorkspace: (workspaceId) => invoke("restoreWorkspace", workspaceId),
    deleteWorkspace: (workspaceId) => invoke("deleteWorkspace", workspaceId),
    pinWorkspace: (workspaceId, pinned) => invoke("pinWorkspace", workspaceId, pinned),
    updateWorkspaceLaunchSet: (workspaceId, launchSet) => invoke("updateWorkspaceLaunchSet", workspaceId, launchSet),
    updateWorkspaceSettings: (workspaceId, update) => invoke("updateWorkspaceSettings", workspaceId, update),
    createProfile: (name, options) => invoke("createProfile", name, options),
    openProfile: (profileId) => invoke("openProfile", profileId),
    viewProfile: (profileId) => invoke("viewProfile", profileId),
    renameProfile: (profileId, name) => invoke("renameProfile", profileId, name),
    updateProfile: (profileId, options) => invoke("updateProfile", profileId, options),
    archiveProfile: (profileId) => invoke("archiveProfile", profileId),
    restoreProfile: (profileId) => invoke("restoreProfile", profileId),
    deleteProfile: (profileId) => invoke("deleteProfile", profileId),
    switchProfile: (profileId) => invoke("switchProfile", profileId),
    discoverApplications: () => invoke("discoverApplications"),
    refreshApplications: () => invoke("refreshApplications"),
    resumeContext: (resourceIds, workspaceId) => invoke("resumeContext", resourceIds, workspaceId),
    openApplication: (applicationId) => invoke("openApplication", applicationId),
    launchApplication: (applicationId, options) => invoke("launchApplication", applicationId, options),
    pinApplication: (applicationId) => invoke("pinApplication", applicationId),
    unpinApplication: (applicationId) => invoke("unpinApplication", applicationId),
    favoriteApplication: (applicationId) => invoke("favoriteApplication", applicationId),
    unfavoriteApplication: (applicationId) => invoke("unfavoriteApplication", applicationId),
    hideApplication: (applicationId) => invoke("hideApplication", applicationId),
    showApplication: (applicationId) => invoke("showApplication", applicationId),
    setDefaultApplication: (applicationId, isDefault) => invoke("setDefaultApplication", applicationId, isDefault),
    setWorkspacePreferredApplication: (workspaceId, applicationId, preferred) =>
      invoke("setWorkspacePreferredApplication", workspaceId, applicationId, preferred),
    selectResource: (resourceId) => invoke("selectResource", resourceId),
    getPlatform: () => new NoopPlatformProviders(),
  };
}

function createFallbackShellAdapter(): ShellAdapter {
  throw new Error("Karya Shell IPC bridge is required in the desktop renderer");
}
