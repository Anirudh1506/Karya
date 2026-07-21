import type { EntityId } from "./common";

export type CaptureResourceKind = "note";

export interface CaptureSession {
  id: EntityId;
  kind: CaptureResourceKind;
  profileId: EntityId;
  workspaceId: EntityId;
  startedAt: string;
}

export interface CompleteCaptureInput {
  captureId: EntityId;
  name: string;
}
