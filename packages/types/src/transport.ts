import type { AuthenticationProof } from "./account";
import type { EntityId, ISODateString } from "./common";
import type { SyncOperation } from "./synchronization";

export type TransportConnectionState =
  "idle" | "connecting" | "connected" | "offline" | "reconnecting" | "suspended" | "failed";

export interface TransportBatch {
  id: EntityId;
  replicaId: EntityId;
  operations: readonly SyncOperation[];
}

export interface TransportAcknowledgement {
  batchId: EntityId;
  operationIds: readonly EntityId[];
}

export interface TransportDownload {
  batches: readonly TransportBatch[];
  cursor?: string;
}

export interface TransportSessionContext {
  replicaId: EntityId;
  credentials?: AuthenticationProof;
}

export interface TransportSessionRecord {
  id: "remote-transport";
  state: TransportConnectionState;
  cursor?: string;
  retryCount: number;
  lastSuccessfulSynchronization?: ISODateString;
  updatedAt: ISODateString;
}

export interface TransportStatus extends TransportSessionRecord {
  provider: string;
  queueSize: number;
  pendingBatches: number;
}
