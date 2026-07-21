import type { AuthenticationProvider } from "@karya/types";
import type {
  EntityId,
  TransportAcknowledgement,
  TransportBatch,
  TransportDownload,
  TransportSessionContext,
  TransportSessionRecord,
  TransportStatus,
} from "@karya/types";

export interface TransportProvider {
  readonly id: string;
  connect(context: TransportSessionContext): Promise<void>;
  disconnect(): Promise<void>;
  upload(batch: TransportBatch): Promise<TransportAcknowledgement>;
  download(cursor?: string): Promise<TransportDownload>;
  acknowledge(acknowledgement: TransportAcknowledgement): Promise<void>;
}

export interface TransportSynchronizationPort {
  deviceId(): Promise<EntityId>;
  pending(): Promise<readonly import("@karya/types").SyncOperation[]>;
  replay(operations: readonly import("@karya/types").SyncOperation[]): Promise<void>;
  acknowledge(operationIds: readonly EntityId[]): Promise<void>;
}

export interface TransportSessionRepository {
  get(id: "remote-transport"): Promise<TransportSessionRecord | undefined>;
  save(session: TransportSessionRecord): Promise<void>;
}

export interface RetryScheduler {
  wait(milliseconds: number): Promise<void>;
}

export interface RemoteTransportOptions {
  batchSize?: number;
  retryLimit?: number;
  initialBackoffMs?: number;
  authentication?: AuthenticationProvider;
  scheduler?: RetryScheduler;
  now?: () => Date;
}

export interface RemoteTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  synchronize(): Promise<void>;
  status(): Promise<TransportStatus>;
  subscribe(listener: () => void): () => void;
}
