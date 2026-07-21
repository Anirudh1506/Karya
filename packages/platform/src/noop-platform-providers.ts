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

  secureStorage: SecureStorageProvider = {
    async get() {
      return undefined;
    },
    async set() {},
    async remove() {},
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
