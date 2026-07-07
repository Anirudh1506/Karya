import type { EntityId, ISODateString } from "./common";
import type { Resource } from "./resource";

export type JobId = EntityId;

export interface ImportDestination {
  profileId?: EntityId;
  workspaceId?: EntityId;
  defaultSpace?: Resource["defaultSpace"];
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobProgress {
  processed: number;
  total: number;
  currentPath?: string;
  message?: string;
}

export interface ImportFailure {
  path: string;
  message: string;
}

export interface ImportJobSummary {
  imported: number;
  skippedDuplicates: number;
  failed: number;
  elapsedMs: number;
  failures: ImportFailure[];
}

export interface ImportJob {
  id: JobId;
  type: "file-import" | "directory-import";
  status: JobStatus;
  path: string;
  displayTitle?: string;
  queuedAt: ISODateString;
  startedAt?: ISODateString;
  finishedAt?: ISODateString;
  progress: JobProgress;
  summary?: ImportJobSummary;
  error?: string;
}

export interface JobSnapshot {
  id: JobId;
  type: string;
  status: JobStatus;
  path?: string;
  displayTitle?: string;
  queuedAt: ISODateString;
  startedAt?: ISODateString;
  finishedAt?: ISODateString;
  progress: JobProgress;
  summary?: ImportJobSummary;
  error?: string;
}
