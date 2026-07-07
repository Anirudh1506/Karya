import type { ImportDestination, ImportJob, JobId, JobProgress, JobSnapshot, KaryaEventMap, KaryaEventName, Resource } from "@karya/types";

export type ImportCommand = {
  id: string;
  type: "ImportContentCommand";
  payload: { path: string; displayTitle?: string; tags?: string[]; folderParentId?: string; relativePath?: string; destination?: ImportDestination };
} | {
  id: string;
  type: "CreateFolderResourceCommand";
  payload: { path: string; displayTitle?: string; destination?: ImportDestination };
} | {
  id: string;
  type: "UpdateFolderImportStatusCommand";
  payload: { folderId: string; importStatus: string; indexedCount?: number; childCount?: number };
};

export interface ImportCommandExecutor {
  execute<TResult = unknown>(command: ImportCommand): Promise<TResult>;
}

export interface ImportEventPublisher {
  publish<TEventName extends KaryaEventName>(
    eventName: TEventName,
    payload: KaryaEventMap[TEventName],
  ): Promise<void>;
}

export interface ImportFileCandidate {
  path: string;
  relativePath: string;
  displayTitle?: string;
}

export interface ImportSourceProvider {
  walkDirectory(path: string): Promise<ImportFileCandidate[]>;
}

export interface Disposable {
  dispose(): void;
}

export interface FileWatcher {
  watch(path: string): Disposable;
}

export interface JobCancellationSignal {
  readonly cancelled: boolean;
}

export interface JobExecutionContext {
  signal: JobCancellationSignal;
  update(progress: Partial<JobProgress>): Promise<void>;
}

export interface Job {
  type: string;
  path?: string;
  displayTitle?: string;
  progress: JobProgress;
  run(context: JobExecutionContext): Promise<Partial<JobSnapshot>>;
}

export interface JobManager {
  queue(job: Job): Promise<JobId>;
  cancel(jobId: JobId): Promise<void>;
  get(jobId: JobId): JobSnapshot | undefined;
  list(): JobSnapshot[];
}

export interface ImportService {
  importFile(path: string, displayTitle?: string, destination?: ImportDestination): Promise<ImportJob>;
  importDirectory(path: string, destination?: ImportDestination): Promise<ImportJob>;
  cancel(jobId: JobId): Promise<void>;
  getJob(jobId: JobId): Promise<ImportJob | undefined>;
  listJobs(): Promise<ImportJob[]>;
}

export interface ImportServiceOptions {
  commandExecutor: ImportCommandExecutor;
  eventPublisher: ImportEventPublisher;
  jobManager?: ObservableJobManager;
  sourceProvider?: ImportSourceProvider;
}

export type JobSnapshotListener = (snapshot: JobSnapshot) => void | Promise<void>;

export interface ObservableJobManager extends JobManager {
  subscribe(listener: JobSnapshotListener): Disposable;
}

export interface ImportFileResult {
  resource: Resource;
  contentAddress?: string;
}
