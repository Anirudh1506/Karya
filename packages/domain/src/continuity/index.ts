import { Identifier, Timestamp } from "../common";

export type SessionId = Identifier;
export type ResourceId = Identifier;
export type WorkspaceId = Identifier;
export type ProfileId = Identifier;

export interface ResumeContext {
  profileId: ProfileId;
  workspaceId?: WorkspaceId;
  resourceIds: ResourceId[];
  capturedAt: Timestamp;
}

export interface LaunchIntent {
  kind: "resume" | "open-resource" | "open-workspace" | "open-application";
  targetId?: Identifier;
}

export interface ActivityTimelineItem {
  id: Identifier;
  label: string;
  occurredAt: Timestamp;
}

export interface ActivityTimeline {
  items: ActivityTimelineItem[];
}
