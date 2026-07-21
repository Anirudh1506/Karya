import type { EntityId } from "./common";

export type SyncEntityType = "profile" | "workspace" | "resource" | "resource-content" | "capture" | "notification";
export type SyncAcknowledgementState = "pending" | "acknowledged" | "failed";

export interface SyncOperation {
  id: EntityId;
  deviceId: EntityId;
  sequence: number;
  timestamp: string;
  entityType: SyncEntityType;
  entityId: EntityId;
  operationType: string;
  payload: string;
  dependencies: EntityId[];
  acknowledgementState: SyncAcknowledgementState;
  acknowledgedAt?: string;
  failureReason?: string;
}

export interface SyncDeviceState {
  id: "local-device";
  deviceId: EntityId;
  nextSequence: number;
  lastReplayAt?: string;
}

export interface SyncReplayReceipt {
  id: EntityId;
  operationId: EntityId;
  replayedAt: string;
}

export interface SyncConflict {
  id: EntityId;
  operationId: EntityId;
  entityType: SyncEntityType;
  entityId: EntityId;
  detectedAt: string;
  reason: "concurrent-modification" | "missing-dependency" | "unsupported-operation";
  localTimestamp?: string;
  remoteTimestamp?: string;
  resolved: false;
}

export interface SyncStatus {
  deviceId: EntityId;
  pendingOperations: number;
  acknowledgedOperations: number;
  queueSize: number;
  lastReplayAt?: string;
}
