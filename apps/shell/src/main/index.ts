import { createKaryaCore } from "@karya/core";
import { FileSystemContentStore } from "@karya/content-store";
import { NodeImportSourceProvider } from "@karya/import-service";
import { KaryaMetadataStore } from "@karya/metadata-store";
import { createShellAdapter, type ShellAdapter } from "@karya/shell-adapter";
import type { ImportDestination, SearchResult } from "@karya/types";
import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, nativeTheme, type MenuItemConstructorOptions, type MessageBoxOptions } from "electron";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ElectronPlatformProviders } from "../platform/electron-platform";

const isDev = process.env.NODE_ENV === "development" || Boolean(process.env.ELECTRON_RENDERER_URL);
const isProduction = !isDev;
const appName = "Karya";
const appId = "com.karya.desktop";
const appCategory = "Productivity";
const copyright = "Copyright © 2026 Karya";
const buildNumber = process.env.KARYA_BUILD_NUMBER ?? app.getVersion();
let shellAdapter: ShellAdapter | undefined;
let metadataStore: KaryaMetadataStore | undefined;
let unsubscribeImports: (() => void) | undefined;
let unsubscribeSnapshots: (() => void) | undefined;
let mainWindow: BrowserWindow | undefined;

app.setName(appName);
app.setAppUserModelId(appId);
if (process.env.KARYA_USER_DATA_DIR) {
  app.setPath("userData", process.env.KARYA_USER_DATA_DIR);
}

function createWindow(): void {
  const windowState = readWindowState();
  mainWindow = new BrowserWindow({
    width: windowState?.bounds.width ?? 1440,
    height: windowState?.bounds.height ?? 900,
    x: windowState?.bounds.x,
    y: windowState?.bounds.y,
    minWidth: 980,
    minHeight: 680,
    title: appName,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#18181b" : "#f4f4f5",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    icon: getAppIconPath(),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: isDev,
    },
  });

  if (windowState?.maximized) {
    mainWindow.maximize();
  }

  mainWindow.on("close", () => {
    if (mainWindow) {
      writeWindowState(mainWindow);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });

  if (isProduction) {
    const productionWindow = mainWindow;
    productionWindow.webContents.on("devtools-opened", () => {
      productionWindow.webContents.closeDevTools();
    });
  }

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(async () => {
  await initializeShell();
  installApplicationMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  unsubscribeSnapshots?.();
  unsubscribeImports?.();
  void metadataStore?.close();
});

async function initializeShell(): Promise<void> {
  const adapter = getShellAdapter();
  await adapter.boot();
  unsubscribeSnapshots = adapter.subscribe((snapshot) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("karya:snapshot", snapshot);
    });
  });
  unsubscribeImports = adapter.subscribeImports((importEvent) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send("karya:import", importEvent);
    });
  });

  ipcMain.handle("karya:shell:invoke", async (_event, method: keyof ShellAdapter | "executeSearchResult", args: unknown[] = []) => {
    return invokeShellMethod(adapter, method, args);
  });
  ipcMain.handle("karya:profile-context-menu", async (_event, profile: { id: string; name: string; archived: boolean }) => {
    return showProfileContextMenu(profile);
  });
  ipcMain.handle("karya:resource-context-menu", async (_event, resource: { id: string; title: string; archived: boolean; hasLocation: boolean }) => {
    return showResourceContextMenu(resource);
  });
  ipcMain.handle("karya:application-context-menu", async (_event, application: { id: string; name: string; pinned: boolean; favorite: boolean; preferred: boolean; hasActiveWorkspace: boolean }) => {
    return showApplicationContextMenu(application);
  });
}

function installApplicationMenu(): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(createApplicationMenu()));
}

function createApplicationMenu(): MenuItemConstructorOptions[] {
  const isMac = process.platform === "darwin";
  const appMenu: MenuItemConstructorOptions = {
    label: appName,
    submenu: [
      { label: `About ${appName}`, click: showAboutDialog },
      { label: "Check for Updates...", enabled: false },
      { type: "separator" },
      { label: "Settings...", accelerator: "CommandOrControl+,", click: () => sendNativeCommand("open-settings") },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" },
    ],
  };

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [appMenu] : []),
    {
      label: "File",
      submenu: [
        { label: "New Workspace", accelerator: "CommandOrControl+Shift+N", click: () => void createWorkspaceFromMenu() },
        { type: "separator" },
        { label: "Import File...", accelerator: "CommandOrControl+I", click: () => void getShellAdapter().importFileFromPicker(undefined) },
        { label: "Import Folder...", accelerator: "CommandOrControl+Shift+I", click: () => void getShellAdapter().importDirectoryFromPicker(undefined) },
        { type: "separator" },
        { label: "Settings...", accelerator: "CommandOrControl+,", click: () => sendNativeCommand("open-settings") },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Toggle Sidebar", accelerator: "CommandOrControl+B", click: () => sendNativeCommand("toggle-sidebar") },
        { label: "Toggle Inspector", accelerator: "CommandOrControl+Shift+B", click: () => sendNativeCommand("toggle-inspector") },
        { label: "Toggle Dock", accelerator: "CommandOrControl+Shift+D", click: () => sendNativeCommand("toggle-dock") },
        { type: "separator" },
        { role: "reload", visible: isDev },
        { role: "forceReload", visible: isDev },
        { role: "toggleDevTools", visible: isDev },
        { type: "separator", visible: isDev },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Workspace",
      submenu: [
        { label: "Continue Working", accelerator: "CommandOrControl+Return", click: () => void continueActiveWorkspaceFromMenu() },
        { label: "Search", accelerator: "CommandOrControl+K", click: () => sendNativeCommand("open-search") },
        { label: "Activity", click: () => sendNativeCommand("open-activity") },
      ],
    },
    {
      label: "Help",
      submenu: [
        { label: "Documentation", enabled: false },
        { label: "Keyboard Shortcuts", click: () => sendNativeCommand("open-keyboard-shortcuts") },
        { type: "separator" },
        ...(!isMac ? [{ label: `About ${appName}`, click: showAboutDialog } satisfies MenuItemConstructorOptions] : []),
      ],
    },
  ];

  return template;
}

async function createWorkspaceFromMenu(): Promise<void> {
  await getShellAdapter().createWorkspace("New Workspace");
}

async function continueActiveWorkspaceFromMenu(): Promise<void> {
  const adapter = getShellAdapter();
  const snapshot = await adapter.getSnapshot();
  const breadcrumbWorkspace = [...snapshot.shell.breadcrumbs].reverse().find((breadcrumb) => breadcrumb.workspaceId)?.workspaceId;
  const activeWorkspaceId = snapshot.shell.activeSurface.type === "workspace"
    ? snapshot.shell.activeSurface.workspaceId
    : snapshot.shell.activeSurface.type === "folder"
      ? breadcrumbWorkspace
      : undefined;
  if (activeWorkspaceId) {
    await adapter.resumeContext([activeWorkspaceId], activeWorkspaceId);
  }
}

function sendNativeCommand(command: string): void {
  BrowserWindow.getFocusedWindow()?.webContents.send("karya:native-command", command);
}

function showAboutDialog(): void {
  const platformLabel = `${process.platform} ${process.arch}`;
  const options: MessageBoxOptions = {
    type: "info",
    title: `About ${appName}`,
    message: appName,
    detail: [
      `Version: ${app.getVersion()}`,
      `Build: ${buildNumber}`,
      `Platform: ${platformLabel}`,
      `Category: ${appCategory}`,
      "",
      copyright,
      "License: Desktop alpha, all rights reserved.",
      "Homepage: https://karya.desktop",
      "",
      "Check for Updates is unavailable in Phase 1.",
    ].join("\n"),
    icon: nativeImage.createFromPath(getAppIconPath()),
    buttons: ["OK"],
  };
  const parent = mainWindow ?? BrowserWindow.getFocusedWindow();
  void (parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options));
}

function getAppIconPath(): string {
  const iconFile = process.platform === "win32" ? "icon.ico" : process.platform === "darwin" ? "icon.icns" : "icon.png";
  return app.isPackaged
    ? join(process.resourcesPath, iconFile)
    : join(__dirname, "../../build", iconFile);
}

function getWindowStatePath(): string {
  return join(app.getPath("userData"), "window-state.json");
}

function readWindowState(): { bounds: { x?: number; y?: number; width: number; height: number }; maximized: boolean } | undefined {
  const statePath = getWindowStatePath();
  if (!existsSync(statePath)) return undefined;
  try {
    const state = JSON.parse(readFileSync(statePath, "utf8")) as { bounds?: { x?: number; y?: number; width?: number; height?: number }; maximized?: boolean };
    if (!state.bounds?.width || !state.bounds?.height) return undefined;
    return {
      bounds: {
        x: state.bounds.x ?? undefined,
        y: state.bounds.y ?? undefined,
        width: state.bounds.width,
        height: state.bounds.height,
      },
      maximized: Boolean(state.maximized),
    };
  } catch {
    return undefined;
  }
}

function writeWindowState(window: BrowserWindow): void {
  const state = {
    bounds: window.isMaximized() ? window.getNormalBounds() : window.getBounds(),
    maximized: window.isMaximized(),
  };
  writeFileSync(getWindowStatePath(), `${JSON.stringify(state, null, 2)}\n`);
}

type ProfileContextAction =
  | "open"
  | "rename"
  | "create-workspace"
  | "set-active"
  | "archive"
  | "restore"
  | "delete"
  | "properties";

function showProfileContextMenu(profile: { id: string; name: string; archived: boolean }): Promise<ProfileContextAction | undefined> {
  return new Promise((resolve) => {
    let selected: ProfileContextAction | undefined;
    const choose = (action: ProfileContextAction) => {
      selected = action;
    };
    const menu = Menu.buildFromTemplate([
      { label: "Open", click: () => choose("open") },
      { label: "Rename", enabled: !profile.archived, click: () => choose("rename") },
      { label: "Create Workspace", enabled: !profile.archived, click: () => choose("create-workspace") },
      { label: "Set as Active", enabled: !profile.archived, click: () => choose("set-active") },
      { label: "Duplicate", enabled: false },
      { type: "separator" },
      profile.archived
        ? { label: "Restore", click: () => choose("restore") }
        : { label: "Archive", click: () => choose("archive") },
      { label: "Delete", click: () => choose("delete") },
      { type: "separator" },
      { label: "Properties", click: () => choose("properties") },
    ]);

    menu.popup({
      callback: () => resolve(selected),
    });
  });
}

type ResourceContextAction =
  | "open"
  | "open-with"
  | "reveal"
  | "rename"
  | "duplicate"
  | "move"
  | "add-to-workspace"
  | "archive"
  | "restore"
  | "delete"
  | "properties";

function showResourceContextMenu(resource: { id: string; title: string; archived: boolean; hasLocation: boolean }): Promise<ResourceContextAction | undefined> {
  return new Promise((resolve) => {
    let selected: ResourceContextAction | undefined;
    const choose = (action: ResourceContextAction) => {
      selected = action;
    };
    const menu = Menu.buildFromTemplate([
      { label: "Open", click: () => choose("open") },
      { label: "Open With...", enabled: resource.hasLocation, click: () => choose("open-with") },
      { label: "Reveal", enabled: resource.hasLocation, click: () => choose("reveal") },
      { type: "separator" },
      { label: "Rename", enabled: !resource.archived, click: () => choose("rename") },
      { label: "Duplicate", click: () => choose("duplicate") },
      { label: "Move To...", enabled: !resource.archived, click: () => choose("move") },
      { label: "Add to Workspace...", enabled: !resource.archived, click: () => choose("add-to-workspace") },
      { label: "Share...", enabled: false },
      { type: "separator" },
      resource.archived
        ? { label: "Restore", click: () => choose("restore") }
        : { label: "Archive", click: () => choose("archive") },
      { label: "Delete", click: () => choose("delete") },
      { type: "separator" },
      { label: "Properties", click: () => choose("properties") },
    ]);

    menu.popup({
      callback: () => resolve(selected),
    });
  });
}

type ApplicationContextAction =
  | "launch"
  | "open-workspace"
  | "pin"
  | "unpin"
  | "favorite"
  | "unfavorite"
  | "set-preferred"
  | "unset-preferred"
  | "remove-from-workspace"
  | "properties";

function showApplicationContextMenu(application: { id: string; name: string; pinned: boolean; favorite: boolean; preferred: boolean; hasActiveWorkspace: boolean }): Promise<ApplicationContextAction | undefined> {
  return new Promise((resolve) => {
    let selected: ApplicationContextAction | undefined;
    const choose = (action: ApplicationContextAction) => {
      selected = action;
    };
    const menu = Menu.buildFromTemplate([
      { label: "Launch", click: () => choose("launch") },
      { label: "Open Workspace", enabled: application.hasActiveWorkspace, click: () => choose("open-workspace") },
      { type: "separator" },
      application.pinned
        ? { label: "Unpin", click: () => choose("unpin") }
        : { label: "Pin", click: () => choose("pin") },
      application.favorite
        ? { label: "Unfavorite", click: () => choose("unfavorite") }
        : { label: "Favorite", click: () => choose("favorite") },
      application.preferred
        ? { label: "Remove as Workspace Preferred", enabled: application.hasActiveWorkspace, click: () => choose("unset-preferred") }
        : { label: "Set as Workspace Preferred", enabled: application.hasActiveWorkspace, click: () => choose("set-preferred") },
      { label: "Remove From Workspace", enabled: application.preferred && application.hasActiveWorkspace, click: () => choose("remove-from-workspace") },
      { type: "separator" },
      { label: "Properties", click: () => choose("properties") },
    ]);

    menu.popup({
      callback: () => resolve(selected),
    });
  });
}

function getShellAdapter(): ShellAdapter {
  if (shellAdapter) return shellAdapter;

  const platform = new ElectronPlatformProviders();
  const contentStore = new FileSystemContentStore({
    rootPath: join(app.getPath("userData"), "content-store"),
  });
  const store = new KaryaMetadataStore({
    databasePath: join(app.getPath("userData"), "karya-metadata.sqlite"),
  });
  metadataStore = store;
  const core = createKaryaCore({
    contentStore,
    importSourceProvider: new NodeImportSourceProvider(),
    platform,
    seed: {
      includeDemoContent: isDev,
    },
    persistence: {
      applications: store.applications,
      profiles: store.profiles,
      resourceQueries: store.resourceQueries,
      resources: store.aggregateResources,
      searchQueries: store.searchQueries,
      search: store.search,
      sessions: store.sessions,
      settings: store.settings,
      workspaces: store.aggregateWorkspaces,
      workspaceQueries: store.workspaceQueries,
      unitOfWork: store.unitOfWork,
      initialize: () => store.initialize(),
      seedIfEmpty: (seed) => store.seedIfEmpty(seed),
      close: () => store.close(),
    },
  });
  shellAdapter = createShellAdapter({ core, platform });
  return shellAdapter;
}

async function invokeShellMethod(adapter: ShellAdapter, method: keyof ShellAdapter | "executeSearchResult", args: unknown[]): Promise<unknown> {
  switch (method) {
    case "boot":
      return adapter.boot();
    case "getSnapshot":
      return adapter.getSnapshot();
    case "execute":
      return adapter.execute(args[0] as Parameters<ShellAdapter["execute"]>[0]);
    case "getResource":
      return adapter.getResource(args[0] as string);
    case "listResources":
      return adapter.listResources(args[0] as Parameters<ShellAdapter["listResources"]>[0]);
    case "getWorkspace":
      return adapter.getWorkspace(args[0] as string);
    case "listWorkspaces":
      return adapter.listWorkspaces(args[0] as Parameters<ShellAdapter["listWorkspaces"]>[0]);
    case "recentResources":
      return adapter.recentResources(args[0] as number | undefined);
    case "search":
      return adapter.search(args[0] as string);
    case "executeSearchResult":
      return adapter.executeSearchResult(args[0] as SearchResult);
    case "createResource":
      return adapter.createResource(args[0] as ImportDestination | undefined);
    case "createNote":
      return adapter.createNote(args[0] as ImportDestination | undefined, args[1] as string | undefined, args[2] as string | undefined);
    case "updateNoteContent":
      return adapter.updateNoteContent(args[0] as string, args[1] as string);
    case "createTask":
      return adapter.createTask(args[0] as ImportDestination | undefined, args[1] as string | undefined, args[2] as Parameters<ShellAdapter["createTask"]>[2]);
    case "updateTask":
      return adapter.updateTask(args[0] as string, args[1] as Parameters<ShellAdapter["updateTask"]>[1]);
    case "completeTask":
      return adapter.completeTask(args[0] as string);
    case "reopenTask":
      return adapter.reopenTask(args[0] as string);
    case "createBookmark":
      return adapter.createBookmark(args[0] as ImportDestination | undefined, args[1] as string, args[2] as Parameters<ShellAdapter["createBookmark"]>[2]);
    case "updateBookmark":
      return adapter.updateBookmark(args[0] as string, args[1] as Parameters<ShellAdapter["updateBookmark"]>[1]);
    case "createCalendarEvent":
      return adapter.createCalendarEvent(args[0] as ImportDestination | undefined, args[1] as string | undefined, args[2] as Parameters<ShellAdapter["createCalendarEvent"]>[2]);
    case "updateCalendarEvent":
      return adapter.updateCalendarEvent(args[0] as string, args[1] as Parameters<ShellAdapter["updateCalendarEvent"]>[1]);
    case "archiveCalendarEvent":
      return adapter.archiveCalendarEvent(args[0] as string);
    case "deleteCalendarEvent":
      return adapter.deleteCalendarEvent(args[0] as string);
    case "linkResource":
      return adapter.linkResource(args[0] as string, args[1] as string | undefined, args[2] as ImportDestination | undefined);
    case "linkFileFromPicker":
      return adapter.linkFileFromPicker(args[0] as ImportDestination | undefined);
    case "linkDirectoryFromPicker":
      return adapter.linkDirectoryFromPicker(args[0] as ImportDestination | undefined);
    case "syncLinkedResource":
      return adapter.syncLinkedResource(args[0] as string);
    case "syncLinkedResources":
      return adapter.syncLinkedResources();
    case "importContent":
      return adapter.importContent(args[0] as string, args[1] as string | undefined, args[2] as ImportDestination | undefined);
    case "importFile":
      return adapter.importFile(args[0] as string, args[1] as string | undefined, args[2] as ImportDestination | undefined);
    case "importDirectory":
      return adapter.importDirectory(args[0] as string, args[1] as ImportDestination | undefined);
    case "importFileFromPicker":
      return adapter.importFileFromPicker(args[0] as ImportDestination | undefined);
    case "importDirectoryFromPicker":
      return adapter.importDirectoryFromPicker(args[0] as ImportDestination | undefined);
    case "cancelImport":
      return adapter.cancelImport(args[0] as string);
    case "getImportJob":
      return adapter.getImportJob(args[0] as string);
    case "listImportJobs":
      return adapter.listImportJobs();
    case "openFolderResource":
      return adapter.openFolderResource(args[0] as string, args[1] as string | undefined);
    case "openHomeSurface":
      return adapter.openHomeSurface();
    case "openResource":
      return adapter.openResource(args[0] as string);
    case "openResourceWithApplication":
      return adapter.openResourceWithApplication(args[0] as string, args[1] as string, args[2] as string | undefined);
    case "revealResource":
      return adapter.revealResource(args[0] as string);
    case "openContainingFolder":
      return adapter.openContainingFolder(args[0] as string);
    case "copyResourcePath":
      return adapter.copyResourcePath(args[0] as string);
    case "checkResourceHealth":
      return adapter.checkResourceHealth(args[0] as string);
    case "updateResourceLocation":
      return adapter.updateResourceLocation(args[0] as string, args[1] as string);
    case "renameResource":
      return adapter.renameResource(args[0] as string, args[1] as string);
    case "moveResource":
      return adapter.moveResource(args[0] as string, args[1] as ImportDestination);
    case "duplicateResource":
      return adapter.duplicateResource(args[0] as string, args[1] as ImportDestination | undefined);
    case "deleteResource":
      return adapter.deleteResource(args[0] as string);
    case "archiveResource":
      return adapter.archiveResource(args[0] as string);
    case "restoreResource":
      return adapter.restoreResource(args[0] as string);
    case "addWorkspaceReference":
      return adapter.addWorkspaceReference(args[0] as string, args[1] as string, args[2] as boolean | undefined);
    case "removeWorkspaceReference":
      return adapter.removeWorkspaceReference(args[0] as string, args[1] as string);
    case "updateResourceMetadata":
      return adapter.updateResourceMetadata(args[0] as string, args[1] as Parameters<ShellAdapter["updateResourceMetadata"]>[1]);
    case "createRelationship":
      return adapter.createRelationship(
        args[0] as string,
        args[1] as Parameters<ShellAdapter["createRelationship"]>[1],
        args[2] as string,
        args[3] as Parameters<ShellAdapter["createRelationship"]>[3],
        args[4] as Parameters<ShellAdapter["createRelationship"]>[4],
      );
    case "removeRelationship":
      return adapter.removeRelationship(args[0] as string, args[1] as Parameters<ShellAdapter["removeRelationship"]>[1], args[2] as string);
    case "createNotification":
      return adapter.createNotification(args[0] as Parameters<ShellAdapter["createNotification"]>[0]);
    case "markNotificationRead":
      return adapter.markNotificationRead(args[0] as string);
    case "archiveNotification":
      return adapter.archiveNotification(args[0] as string);
    case "deleteNotification":
      return adapter.deleteNotification(args[0] as string);
    case "scheduleReminder":
      return adapter.scheduleReminder(args[0] as Parameters<ShellAdapter["scheduleReminder"]>[0]);
    case "createWorkspace":
      return adapter.createWorkspace(args[0] as string, args[1] as string | undefined, args[2] as string | undefined);
    case "switchWorkspace":
      return adapter.switchWorkspace(args[0] as string);
    case "openWorkspace":
      return adapter.openWorkspace(args[0] as string);
    case "closeWorkspace":
      return adapter.closeWorkspace(args[0] as string);
    case "renameWorkspace":
      return adapter.renameWorkspace(args[0] as string, args[1] as string);
    case "archiveWorkspace":
      return adapter.archiveWorkspace(args[0] as string);
    case "restoreWorkspace":
      return adapter.restoreWorkspace(args[0] as string);
    case "deleteWorkspace":
      return adapter.deleteWorkspace(args[0] as string);
    case "pinWorkspace":
      return adapter.pinWorkspace(args[0] as string, args[1] as boolean);
    case "updateWorkspaceLaunchSet":
      return adapter.updateWorkspaceLaunchSet(args[0] as string, args[1] as Parameters<ShellAdapter["updateWorkspaceLaunchSet"]>[1]);
    case "createProfile":
      return adapter.createProfile(args[0] as string, args[1] as Parameters<ShellAdapter["createProfile"]>[1]);
    case "openProfile":
      return adapter.openProfile(args[0] as string);
    case "viewProfile":
      return adapter.viewProfile(args[0] as string);
    case "renameProfile":
      return adapter.renameProfile(args[0] as string, args[1] as string);
    case "updateProfile":
      return adapter.updateProfile(args[0] as string, args[1] as Parameters<ShellAdapter["updateProfile"]>[1]);
    case "archiveProfile":
      return adapter.archiveProfile(args[0] as string);
    case "restoreProfile":
      return adapter.restoreProfile(args[0] as string);
    case "deleteProfile":
      return adapter.deleteProfile(args[0] as string);
    case "switchProfile":
      return adapter.switchProfile(args[0] as string);
    case "discoverApplications":
      return adapter.discoverApplications();
    case "refreshApplications":
      return adapter.refreshApplications();
    case "resumeContext":
      return adapter.resumeContext(args[0] as string[], args[1] as string | undefined);
    case "openApplication":
      return adapter.openApplication(args[0] as string);
    case "launchApplication":
      return adapter.launchApplication(args[0] as string, args[1] as Parameters<ShellAdapter["launchApplication"]>[1]);
    case "pinApplication":
      return adapter.pinApplication(args[0] as string);
    case "unpinApplication":
      return adapter.unpinApplication(args[0] as string);
    case "favoriteApplication":
      return adapter.favoriteApplication(args[0] as string);
    case "unfavoriteApplication":
      return adapter.unfavoriteApplication(args[0] as string);
    case "hideApplication":
      return adapter.hideApplication(args[0] as string);
    case "showApplication":
      return adapter.showApplication(args[0] as string);
    case "setDefaultApplication":
      return adapter.setDefaultApplication(args[0] as string, args[1] as boolean | undefined);
    case "setWorkspacePreferredApplication":
      return adapter.setWorkspacePreferredApplication(args[0] as string, args[1] as string, args[2] as boolean | undefined);
    case "selectResource":
      return adapter.selectResource(args[0] as string | undefined);
    case "getPlatform":
      return undefined;
    case "subscribe":
      return undefined;
  }
}
