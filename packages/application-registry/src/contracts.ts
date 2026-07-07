import type { EntityId, InstalledApplication } from "@karya/types";

export interface LaunchApplicationRequest {
  applicationId: EntityId;
  launchArguments?: string[];
  workingDirectory?: string;
  workspaceId?: EntityId;
  profileId?: EntityId;
  resourceIds?: EntityId[];
  resourcePath?: string;
}

export interface ApplicationRegistry {
  discoverApplications(): Promise<InstalledApplication[]>;
  refreshApplications(): Promise<InstalledApplication[]>;
  registerApplication(application: InstalledApplication): Promise<InstalledApplication>;
  updateMetadata(id: EntityId, metadata: Partial<InstalledApplication["metadata"]>): Promise<InstalledApplication>;
  removeApplication(id: EntityId): Promise<InstalledApplication>;
  categorizeApplication(id: EntityId, category: NonNullable<InstalledApplication["metadata"]["category"]>): Promise<InstalledApplication>;
  searchApplications(term: string): Promise<InstalledApplication[]>;
  openApplication(id: EntityId): Promise<InstalledApplication>;
  launchApplication(request: LaunchApplicationRequest): Promise<InstalledApplication>;
  listInstalledApplications(): Promise<InstalledApplication[]>;
  listPinnedApplications(): Promise<InstalledApplication[]>;
  pinApplication(id: EntityId): Promise<InstalledApplication>;
  unpinApplication(id: EntityId): Promise<InstalledApplication>;
  favoriteApplication(id: EntityId): Promise<InstalledApplication>;
  unfavoriteApplication(id: EntityId): Promise<InstalledApplication>;
  hideApplication(id: EntityId): Promise<InstalledApplication>;
  showApplication(id: EntityId): Promise<InstalledApplication>;
  setDefaultApplication(id: EntityId, isDefault?: boolean): Promise<InstalledApplication>;
}
