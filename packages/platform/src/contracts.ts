import type { EntityId, InstalledApplication } from "@karya/types";

export interface ClipboardProvider {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface NotificationRequest {
  title: string;
  body?: string;
}

export interface NotificationProvider {
  notify(request: NotificationRequest): Promise<void>;
}

export interface WindowProvider {
  setTitle(title: string): Promise<void>;
  minimize(): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemProvider {
  pickFile(): Promise<string | undefined>;
  pickDirectory(): Promise<string | undefined>;
  exists(path: string): Promise<boolean>;
  getMetadata(path: string): Promise<FileSystemMetadata | undefined>;
  findByFileSystemId(fileSystemId: string, searchRoots: string[]): Promise<FileSystemMetadata | undefined>;
  readTextFile(path: string): Promise<string | undefined>;
  openPath(path: string): Promise<void>;
  revealPath(path: string): Promise<void>;
  openContainingFolder(path: string): Promise<void>;
}

export interface FileSystemMetadata {
  path: string;
  name: string;
  kind: "file" | "directory";
  byteLength: number;
  createdAt?: string;
  modifiedAt?: string;
  mimeType?: string;
  extension?: string;
  fileSystemId?: string;
}

export interface DownloadProvider {
  listDownloads(): Promise<Array<{ id: string; name: string; source: string; createdAt: string }>>;
}

export interface WebMetadata {
  url: string;
  title?: string;
  description?: string;
  siteName?: string;
  favicon?: string;
  previewImage?: string;
}

export interface WebProvider {
  fetchMetadata(url: string): Promise<WebMetadata | undefined>;
}

export interface ApplicationProvider {
  discoverInstalledApplications(): Promise<InstalledApplication[]>;
  refreshApplications(): Promise<InstalledApplication[]>;
  getApplicationMetadata(applicationId: EntityId): Promise<InstalledApplication | undefined>;
  getApplicationIcon(applicationId: EntityId): Promise<string | undefined>;
  resolveExecutablePath(applicationId: EntityId): Promise<string | undefined>;
  openExternal(url: string): Promise<void>;
  launch(applicationId: EntityId, options?: { arguments?: string[]; workingDirectory?: string }): Promise<void>;
  openFile(applicationId: EntityId, path: string): Promise<void>;
}

export interface PlatformProviders {
  applications: ApplicationProvider;
  clipboard: ClipboardProvider;
  downloads: DownloadProvider;
  fileSystem: FileSystemProvider;
  notifications: NotificationProvider;
  web: WebProvider;
  windows: WindowProvider;
}
