import type { SyncOperation } from "@karya/types";

export interface SyncTransport {
  push(operations: readonly SyncOperation[]): Promise<readonly string[]>;
  pull(cursor?: string): Promise<{ operations: readonly SyncOperation[]; cursor?: string }>;
}
