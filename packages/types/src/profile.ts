import type { EntityId, ISODateString } from "./common";

export type ProfileLifecycleState = "active" | "archived" | "deleted";

export type ProfileTemplate = "personal" | "startup" | "university" | "freelancing" | "custom";

export interface ProfilePreferences {
  banner?: string;
  defaultApplicationIds?: EntityId[];
  defaultCreateTemplateIds?: string[];
  favoriteWorkspaceIds?: EntityId[];
}

export interface Profile {
  id: EntityId;
  name: string;
  description?: string;
  icon?: string;
  accentColor?: string;
  template?: ProfileTemplate;
  lifecycleState?: ProfileLifecycleState;
  defaultSpaceId?: EntityId;
  spaceIds: EntityId[];
  createdAt: ISODateString;
  updatedAt?: ISODateString;
  archivedAt?: ISODateString;
  deletedAt?: ISODateString;
  lastActiveAt?: ISODateString;
  preferences?: ProfilePreferences;
}
