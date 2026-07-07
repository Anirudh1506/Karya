import type { EntityId, ISODateString, LifecycleState } from "./common";
import type { ResourceMetadata, ResourcePermissions, ResourceRelationship, ResourceVersionInfo } from "./resource";

export interface CalendarEvent {
  id: EntityId;
  objectType: "event";
  eventType: "calendar-event";
  type: "application/vnd.karya.calendar-event";
  metadata: ResourceMetadata;
  owner: EntityId;
  profileId: EntityId;
  workspaceRefs: EntityId[];
  primaryWorkspaceId?: EntityId;
  defaultSpace:
    | "none"
    | "user"
    | "profile"
    | "user-and-profile";
  tags: string[];
  relationships: ResourceRelationship[];
  permissions?: ResourcePermissions;
  versionInfo?: ResourceVersionInfo;
  status: LifecycleState;
  lifecycleState: LifecycleState;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
