import { createKaryaCore, type KaryaCommand } from "@karya/core";
import { NoopPlatformProviders } from "@karya/platform";
import type { SearchResult } from "@karya/types";
import type { ShellAdapter, ShellAdapterOptions } from "./contracts";
import { executeSearchResult } from "./services/search-execution";

export function createShellAdapter(options: ShellAdapterOptions = {}): ShellAdapter {
  const platform = options.platform ?? new NoopPlatformProviders();
  const core = options.core ?? createKaryaCore({ platform });

  const executeCommand = <TResult = unknown>(command: KaryaCommand): Promise<TResult> =>
    core.commandBus.execute<TResult>(command);

  return {
    currentAccount() {
      return core.shell.currentAccount();
    },
    renameAccount(displayName) {
      return core.shell.renameAccount(displayName);
    },
    trustedDevices() {
      return core.shell.trustedDevices();
    },
    currentDevice() {
      return core.shell.currentDevice();
    },
    renameDevice(deviceId, name) {
      return core.shell.renameDevice(deviceId, name);
    },
    removeDevice(deviceId) {
      return core.shell.removeDevice(deviceId);
    },
    replicaMembership() {
      return core.shell.replicaMembership();
    },
    getTransportStatus() {
      return core.shell.getTransportStatus();
    },
    connectTransport() {
      return core.shell.connectTransport();
    },
    disconnectTransport() {
      return core.shell.disconnectTransport();
    },
    reconnectTransport() {
      return core.shell.reconnectTransport();
    },
    synchronizeTransport() {
      return core.shell.synchronizeTransport();
    },
    async boot() {
      await core.boot();
    },

    subscribe(listener) {
      return core.shell.subscribe(listener);
    },

    subscribeImports(listener) {
      const eventBus = core.registry.resolve("eventBus");
      const unsubscribers = [
        eventBus.subscribe("ImportStarted", (payload) => listener({ type: "ImportStarted", payload })),
        eventBus.subscribe("ImportProgress", (payload) => listener({ type: "ImportProgress", payload })),
        eventBus.subscribe("ImportCompleted", (payload) => listener({ type: "ImportCompleted", payload })),
        eventBus.subscribe("ImportFailed", (payload) => listener({ type: "ImportFailed", payload })),
        eventBus.subscribe("ImportCancelled", (payload) => listener({ type: "ImportCancelled", payload })),
      ];
      return () => {
        unsubscribers.forEach((unsubscribe) => unsubscribe());
      };
    },

    getSnapshot() {
      return core.shell.getSnapshot();
    },

    execute<TResult = unknown>(command: KaryaCommand): Promise<TResult> {
      return executeCommand<TResult>(command);
    },

    getResource(id) {
      return core.shell.getResource(id);
    },

    listResources(query) {
      return core.shell.listResources(query);
    },

    getWorkspace(id) {
      return core.shell.getWorkspace(id);
    },

    listWorkspaces(query) {
      return core.shell.listWorkspaces(query);
    },

    recentResources(limit) {
      return core.shell.recentResources(limit);
    },

    search(term) {
      return core.shell.search(term);
    },

    async executeSearchResult(result: SearchResult) {
      const query = (await core.shell.getSnapshot()).search.query.trim() || result.document.title;
      await executeSearchResult(
        () => core.shell.getSnapshot(),
        executeCommand,
        result,
        core.registry.resolve("commandRegistry"),
      );
      await core.registry.resolve("eventBus").publish("SearchExecuted", { query, result });
    },

    createResource(destination) {
      return core.shell.createResource(destination);
    },

    createNote(destination, title, content) {
      return core.shell.createNote(destination, title, content);
    },

    updateNoteContent(resourceId, content) {
      return core.shell.updateNoteContent(resourceId, content);
    },

    createTask(destination, title, options) {
      return core.shell.createTask(destination, title, options);
    },

    updateTask(resourceId, patch) {
      return core.shell.updateTask(resourceId, patch);
    },

    completeTask(resourceId) {
      return core.shell.completeTask(resourceId);
    },

    reopenTask(resourceId) {
      return core.shell.reopenTask(resourceId);
    },

    createBookmark(destination, url, options) {
      return core.shell.createBookmark(destination, url, options);
    },

    updateBookmark(resourceId, patch) {
      return core.shell.updateBookmark(resourceId, patch);
    },

    createCalendarEvent(destination, title, options) {
      return core.shell.createCalendarEvent(destination, title, options);
    },

    updateCalendarEvent(resourceId, patch) {
      return core.shell.updateCalendarEvent(resourceId, patch);
    },

    archiveCalendarEvent(eventId) {
      return core.shell.archiveCalendarEvent(eventId);
    },

    deleteCalendarEvent(eventId) {
      return core.shell.deleteCalendarEvent(eventId);
    },

    linkResource(path, displayTitle, destination) {
      return core.shell.linkResource(path, displayTitle, destination);
    },

    async linkFileFromPicker(destination) {
      const path = await platform.fileSystem.pickFile();
      return path ? core.shell.linkResource(path, undefined, destination) : undefined;
    },

    async linkDirectoryFromPicker(destination) {
      const path = await platform.fileSystem.pickDirectory();
      return path ? core.shell.linkResource(path, undefined, destination) : undefined;
    },

    syncLinkedResource(resourceId) {
      return core.shell.syncLinkedResource(resourceId);
    },

    syncLinkedResources() {
      return core.shell.syncLinkedResources();
    },

    importContent(path, displayTitle, destination) {
      return core.shell.importContent(path, displayTitle, destination);
    },

    importFile(path, displayTitle, destination) {
      return core.shell.importFile(path, displayTitle, destination);
    },

    importDirectory(path, destination) {
      return core.shell.importDirectory(path, destination);
    },

    async importFileFromPicker(destination) {
      const path = await platform.fileSystem.pickFile();
      return path ? core.shell.importFile(path, undefined, destination) : undefined;
    },

    async importDirectoryFromPicker(destination) {
      const path = await platform.fileSystem.pickDirectory();
      return path ? core.shell.importDirectory(path, destination) : undefined;
    },

    cancelImport(jobId) {
      return core.shell.cancelImport(jobId);
    },

    getImportJob(jobId) {
      return core.shell.getImportJob(jobId);
    },

    listImportJobs() {
      return core.shell.listImportJobs();
    },

    openFolderResource(resourceId, workspaceId) {
      return core.shell.openFolderResource(resourceId, workspaceId);
    },

    openHomeSurface() {
      return core.shell.openHomeSurface();
    },

    openResource(resourceId) {
      return core.shell.openResource(resourceId);
    },
    openResourceWithApplication(resourceId, applicationId, workspaceId) {
      return core.shell.openResourceWithApplication(resourceId, applicationId, workspaceId);
    },

    revealResource(resourceId) {
      return core.shell.revealResource(resourceId);
    },

    openContainingFolder(resourceId) {
      return core.shell.openContainingFolder(resourceId);
    },

    copyResourcePath(resourceId) {
      return core.shell.copyResourcePath(resourceId);
    },

    checkResourceHealth(resourceId) {
      return core.shell.checkResourceHealth(resourceId);
    },

    updateResourceLocation(resourceId, path) {
      return core.shell.updateResourceLocation(resourceId, path);
    },

    renameResource(resourceId, title) {
      return core.shell.renameResource(resourceId, title);
    },

    moveResource(resourceId, destination) {
      return core.shell.moveResource(resourceId, destination);
    },

    duplicateResource(resourceId, destination) {
      return core.shell.duplicateResource(resourceId, destination);
    },

    deleteResource(resourceId) {
      return core.shell.deleteResource(resourceId);
    },

    archiveResource(resourceId) {
      return core.shell.archiveResource(resourceId);
    },

    restoreResource(resourceId) {
      return core.shell.restoreResource(resourceId);
    },

    addWorkspaceReference(resourceId, workspaceId, makePrimary) {
      return core.shell.addWorkspaceReference(resourceId, workspaceId, makePrimary);
    },

    removeWorkspaceReference(resourceId, workspaceId) {
      return core.shell.removeWorkspaceReference(resourceId, workspaceId);
    },

    updateResourceMetadata(resourceId, metadata) {
      return core.shell.updateResourceMetadata(resourceId, metadata);
    },

    createRelationship(sourceId, sourceType, targetId, targetType, relationshipType) {
      return core.shell.createRelationship(sourceId, sourceType, targetId, targetType, relationshipType);
    },

    removeRelationship(sourceId, sourceType, relationshipId) {
      return core.shell.removeRelationship(sourceId, sourceType, relationshipId);
    },

    createNotification(input) {
      return core.shell.createNotification(input);
    },

    markNotificationRead(notificationId) {
      return core.shell.markNotificationRead(notificationId);
    },

    archiveNotification(notificationId) {
      return core.shell.archiveNotification(notificationId);
    },

    deleteNotification(notificationId) {
      return core.shell.deleteNotification(notificationId);
    },

    scheduleReminder(input) {
      return core.shell.scheduleReminder(input);
    },

    createWorkspace(name, description, templateId) {
      return core.shell.createWorkspace(name, description, templateId);
    },

    switchWorkspace(workspaceId) {
      return core.shell.openWorkspace(workspaceId);
    },

    openWorkspace(workspaceId) {
      return core.shell.openWorkspace(workspaceId);
    },

    closeWorkspace(workspaceId) {
      return core.shell.closeWorkspace(workspaceId);
    },

    renameWorkspace(workspaceId, name) {
      return core.shell.renameWorkspace(workspaceId, name);
    },

    archiveWorkspace(workspaceId) {
      return core.shell.archiveWorkspace(workspaceId);
    },

    restoreWorkspace(workspaceId) {
      return core.shell.restoreWorkspace(workspaceId);
    },

    deleteWorkspace(workspaceId) {
      return core.shell.deleteWorkspace(workspaceId);
    },

    pinWorkspace(workspaceId, pinned) {
      return core.shell.pinWorkspace(workspaceId, pinned);
    },

    updateWorkspaceLaunchSet(workspaceId, launchSet) {
      return core.shell.updateWorkspaceLaunchSet(workspaceId, launchSet);
    },

    updateWorkspaceSettings(workspaceId, update) {
      return core.shell.updateWorkspaceSettings(workspaceId, update);
    },

    createProfile(name, options) {
      return core.shell.createProfile(name, options);
    },

    openProfile(profileId) {
      return core.shell.openProfile(profileId);
    },

    viewProfile(profileId) {
      return core.shell.viewProfile(profileId);
    },

    renameProfile(profileId, name) {
      return core.shell.renameProfile(profileId, name);
    },

    updateProfile(profileId, options) {
      return core.shell.updateProfile(profileId, options);
    },

    archiveProfile(profileId) {
      return core.shell.archiveProfile(profileId);
    },

    restoreProfile(profileId) {
      return core.shell.restoreProfile(profileId);
    },

    deleteProfile(profileId) {
      return core.shell.deleteProfile(profileId);
    },

    switchProfile(profileId) {
      return core.shell.switchProfile(profileId);
    },

    discoverApplications() {
      return core.shell.discoverApplications();
    },

    refreshApplications() {
      return core.shell.refreshApplications();
    },

    resumeContext(resourceIds, workspaceId) {
      return core.shell.resumeContext(resourceIds, workspaceId);
    },

    openApplication(applicationId) {
      return core.shell.openApplication(applicationId);
    },

    launchApplication(applicationId, options) {
      return core.shell.launchApplication(applicationId, options);
    },

    pinApplication(applicationId) {
      return core.shell.pinApplication(applicationId);
    },

    unpinApplication(applicationId) {
      return core.shell.unpinApplication(applicationId);
    },

    favoriteApplication(applicationId) {
      return core.shell.favoriteApplication(applicationId);
    },

    unfavoriteApplication(applicationId) {
      return core.shell.unfavoriteApplication(applicationId);
    },

    hideApplication(applicationId) {
      return core.shell.hideApplication(applicationId);
    },

    showApplication(applicationId) {
      return core.shell.showApplication(applicationId);
    },

    setDefaultApplication(applicationId, isDefault) {
      return core.shell.setDefaultApplication(applicationId, isDefault);
    },

    setWorkspacePreferredApplication(workspaceId, applicationId, preferred) {
      return core.shell.setWorkspacePreferredApplication(workspaceId, applicationId, preferred);
    },

    selectResource(resourceId) {
      return core.shell.selectResource(resourceId);
    },

    getPlatform() {
      return platform;
    },
  };
}
