import type {
  ApplicationProvider,
  CameraProvider,
  ClipboardProvider,
  DownloadProvider,
  FileSystemProvider,
  NotificationProvider,
  PlatformProviders,
  SecureStorageProvider,
  WebProvider,
  WindowProvider,
} from "@karya/platform";
import type { InstalledApplication } from "@karya/types";
import { clipboard, dialog, shell as electronShell } from "electron";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { MACOS_OPEN_COMMAND, MACOS_PLATFORM, MACOS_TEXT_EDITOR_NAME, TEXT_FILE_EXTENSION } from "./constants";
import { discoverNativeApplications, launchApplication } from "./services/application-service";
import { fetchWebMetadata } from "./services/web-metadata";
import {
  exists,
  findFileSystemMetadataById,
  getFileSystemMetadata,
  isTextReadableExtension,
} from "./resources/file-system";

const execFileAsync = promisify(execFile);

export class ElectronPlatformProviders implements PlatformProviders {
  private discoveredApplications: InstalledApplication[] = [];

  applications: ApplicationProvider = {
    discoverInstalledApplications: async () => {
      this.discoveredApplications = await discoverNativeApplications();
      return this.discoveredApplications;
    },
    refreshApplications: async () => {
      this.discoveredApplications = await discoverNativeApplications();
      return this.discoveredApplications;
    },
    getApplicationMetadata: async (applicationId) => {
      return this.findApplication(applicationId);
    },
    getApplicationIcon: async (applicationId) => {
      return (await this.findApplication(applicationId))?.metadata.iconRef;
    },
    resolveExecutablePath: async (applicationId) => {
      return (await this.findApplication(applicationId))?.metadata.executablePath;
    },
    async openExternal(url) {
      await electronShell.openExternal(url);
    },
    launch: async (applicationId, options) => {
      const application = await this.findApplication(applicationId);
      await launchApplication(application, options?.arguments);
    },
    openFile: async (applicationId, path) => {
      const application = await this.findApplication(applicationId);
      await launchApplication(application, [path]);
    },
  };

  camera: CameraProvider = {
    async isAvailable() {
      return false;
    },
    async capture() {
      return undefined;
    },
  };

  clipboard: ClipboardProvider = {
    async readText() {
      return clipboard.readText();
    },
    async writeText(text) {
      clipboard.writeText(text);
    },
  };

  downloads: DownloadProvider = {
    async listDownloads() {
      return [];
    },
  };

  web: WebProvider = {
    async fetchMetadata(url) {
      return fetchWebMetadata(url);
    },
  };

  fileSystem: FileSystemProvider = {
    async pickFile() {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
      });
      return result.canceled ? undefined : result.filePaths[0];
    },
    async pickDirectory() {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      });
      return result.canceled ? undefined : result.filePaths[0];
    },
    async exists(path) {
      return exists(path);
    },
    async getMetadata(path) {
      return getFileSystemMetadata(path);
    },
    async findByFileSystemId(fileSystemId, searchRoots) {
      return findFileSystemMetadataById(fileSystemId, searchRoots);
    },
    async readTextFile(path) {
      const metadata = await getFileSystemMetadata(path);
      if (!metadata || metadata.kind !== "file" || !isTextReadableExtension(metadata.extension)) return undefined;
      try {
        return await readFile(path, "utf8");
      } catch {
        return undefined;
      }
    },
    async openPath(path) {
      const metadata = await getFileSystemMetadata(path);
      if (
        process.platform === MACOS_PLATFORM &&
        metadata?.kind === "file" &&
        metadata.extension?.toLocaleLowerCase() === TEXT_FILE_EXTENSION
      ) {
        await execFileAsync(MACOS_OPEN_COMMAND, ["-a", MACOS_TEXT_EDITOR_NAME, path]);
        return;
      }
      const error = await electronShell.openPath(path);
      if (error) {
        throw new Error(error);
      }
    },
    async revealPath(path) {
      electronShell.showItemInFolder(path);
    },
    async openContainingFolder(path) {
      const error = await electronShell.openPath(dirname(path));
      if (error) {
        throw new Error(error);
      }
    },
  };

  notifications: NotificationProvider = {
    async notify() {},
  };

  secureStorage: SecureStorageProvider = {
    async get() {
      return undefined;
    },
    async set() {},
    async remove() {},
  };

  windows: WindowProvider = {
    async setTitle() {},
    async minimize() {},
    async close() {},
  };

  private async findApplication(applicationId: string): Promise<InstalledApplication | undefined> {
    if (this.discoveredApplications.length === 0) {
      this.discoveredApplications = await discoverNativeApplications();
    }
    return this.discoveredApplications.find((application) => application.metadata.id === applicationId);
  }
}
