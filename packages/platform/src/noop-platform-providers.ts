import type {
  ApplicationProvider,
  ClipboardProvider,
  DownloadProvider,
  FileSystemProvider,
  NotificationProvider,
  PlatformProviders,
  WebProvider,
  WindowProvider,
} from "./contracts";

export class NoopPlatformProviders implements PlatformProviders {
  applications: ApplicationProvider = {
    async discoverInstalledApplications() {
      return [];
    },
    async refreshApplications() {
      return [];
    },
    async getApplicationMetadata() {
      return undefined;
    },
    async getApplicationIcon() {
      return undefined;
    },
    async resolveExecutablePath() {
      return undefined;
    },
    async openExternal() {},
    async launch() {},
    async openFile() {},
  };

  clipboard: ClipboardProvider = {
    async readText() {
      return "";
    },
    async writeText() {},
  };

  downloads: DownloadProvider = {
    async listDownloads() {
      return [];
    },
  };

  fileSystem: FileSystemProvider = {
    async pickFile() {
      return undefined;
    },
    async pickDirectory() {
      return undefined;
    },
    async exists() {
      return false;
    },
    async getMetadata() {
      return undefined;
    },
    async findByFileSystemId() {
      return undefined;
    },
    async readTextFile() {
      return undefined;
    },
    async openPath() {},
    async revealPath() {},
    async openContainingFolder() {},
  };

  notifications: NotificationProvider = {
    async notify() {},
  };

  web: WebProvider = {
    async fetchMetadata() {
      return undefined;
    },
  };

  windows: WindowProvider = {
    async setTitle() {},
    async minimize() {},
    async close() {},
  };
}
