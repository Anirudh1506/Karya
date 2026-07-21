import * as Clipboard from "expo-clipboard";
import * as SecureStore from "expo-secure-store";
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

export class ExpoPlatformProviders implements PlatformProviders {
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
      return Clipboard.getStringAsync();
    },
    async writeText(text) {
      await Clipboard.setStringAsync(text);
    },
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
    async get(key) {
      return (await SecureStore.getItemAsync(key)) ?? undefined;
    },
    async set(key, value) {
      await SecureStore.setItemAsync(key, value);
    },
    async remove(key) {
      await SecureStore.deleteItemAsync(key);
    },
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
