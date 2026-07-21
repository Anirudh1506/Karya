import type { EntityId, ISODateString } from "./common";
import type { RelationshipObjectType } from "./resource";

export type ActivityObjectType =
  RelationshipObjectType | "workspace" | "profile" | "application" | "import" | "notification" | "system";

export type ActivityCategory =
  | "resource"
  | "task"
  | "bookmark"
  | "calendar"
  | "workspace"
  | "profile"
  | "import"
  | "application"
  | "relationship"
  | "notification"
  | "system";

export type ActivityVerb =
  | "created"
  | "edited"
  | "opened"
  | "closed"
  | "completed"
  | "reopened"
  | "due"
  | "overdue"
  | "archived"
  | "restored"
  | "deleted"
  | "imported"
  | "failed"
  | "linked"
  | "launched"
  | "referenced"
  | "related"
  | "moved"
  | "renamed"
  | "notified";

export interface ActivityObjectReference {
  id: EntityId;
  type: ActivityObjectType;
  title?: string;
}

export interface KaryaActivity {
  id: EntityId;
  eventType: string;
  category: ActivityCategory;
  verb: ActivityVerb;
  title: string;
  description?: string;
  object: ActivityObjectReference;
  relatedObjects: ActivityObjectReference[];
  profileId?: EntityId;
  workspaceId?: EntityId;
  applicationId?: EntityId;
  actor: {
    id: EntityId;
    type: "local-user";
    name?: string;
  };
  source: string;
  groupKey: string;
  groupCount: number;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  occurredAt: ISODateString;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ActivityGroup {
  key: string;
  title: string;
  category: ActivityCategory;
  verb: ActivityVerb;
  count: number;
  latest: KaryaActivity;
  items: KaryaActivity[];
}
