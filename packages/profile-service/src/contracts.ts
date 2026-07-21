import type { EntityId, Profile, ProfilePreferences, ProfileTemplate } from "@karya/types";

export interface CreateProfileRequest {
  name: string;
  description?: string;
  icon?: string;
  accentColor?: string;
  template?: ProfileTemplate;
}

export interface UpdateProfileRequest {
  id: EntityId;
  name?: string;
  description?: string;
  icon?: string;
  accentColor?: string;
  defaultSpaceId?: EntityId;
  spaceIds?: EntityId[];
  preferences?: ProfilePreferences;
}

export interface ProfileService {
  create(request: CreateProfileRequest): Promise<Profile>;
  rename(id: EntityId, name: string): Promise<Profile>;
  update(request: UpdateProfileRequest): Promise<Profile>;
  archive(id: EntityId): Promise<Profile>;
  restore(id: EntityId): Promise<Profile>;
  delete(id: EntityId): Promise<Profile>;
  switchProfile(id: EntityId): Promise<Profile>;
  listProfiles(): Promise<Profile[]>;
  getActiveProfile(): Promise<Profile | undefined>;
  activateProfile(id: EntityId, restoreWorkspace?: boolean): Promise<Profile>;
  applyReplica(profile: Profile): Promise<Profile>;
}
