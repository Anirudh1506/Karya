import { basename } from "node:path";
import type { ImportDestination, ImportJob, ImportJobSummary, JobId, JobSnapshot, Resource } from "@karya/types";
import type {
  ImportCommandExecutor,
  ImportEventPublisher,
  ImportFileCandidate,
  ImportFileResult,
  ImportService,
  ImportServiceOptions,
  ImportSourceProvider,
  ObservableJobManager,
} from "./contracts";
import { InMemoryJobManager } from "./job-manager";

export class DefaultImportService implements ImportService {
  private readonly commandExecutor: ImportCommandExecutor;
  private readonly eventPublisher: ImportEventPublisher;
  private readonly jobManager: ObservableJobManager;
  private readonly sourceProvider?: ImportSourceProvider;
  private readonly lastStatuses = new Map<JobId, ImportJob["status"]>();

  constructor(options: ImportServiceOptions) {
    this.commandExecutor = options.commandExecutor;
    this.eventPublisher = options.eventPublisher;
    this.jobManager = options.jobManager ?? new InMemoryJobManager();
    this.sourceProvider = options.sourceProvider;
    this.jobManager.subscribe((snapshot) => {
      void this.publishSnapshot(snapshot);
    });
  }

  async importFile(path: string, displayTitle?: string, destination?: ImportDestination): Promise<ImportJob> {
    const queuedAt = Date.now();
    const id = await this.jobManager.queue({
      type: "file-import",
      path,
      displayTitle,
      progress: { processed: 0, total: 1, currentPath: path },
      run: async ({ update }) => {
        const summary = createSummary(queuedAt);
        const result = await this.importCandidate({ path, relativePath: displayTitle ?? path, displayTitle }, undefined, destination);
        summary.imported = 1;
        summary.skippedDuplicates = result.contentAddress ? 0 : 0;
        await update({ processed: 1, total: 1, currentPath: path });
        return { summary };
      },
    });
    return this.requireImportJob(id);
  }

  async importDirectory(path: string, destination?: ImportDestination): Promise<ImportJob> {
    if (!this.sourceProvider) {
      throw new Error("Import source provider is not configured");
    }

    const files = await this.sourceProvider.walkDirectory(path);
    const folder = await this.commandExecutor.execute<Resource>({
      id: crypto.randomUUID(),
      type: "CreateFolderResourceCommand",
      payload: { path, displayTitle: basename(path) || path, destination },
    });
    const queuedAt = Date.now();
    const id = await this.jobManager.queue({
      type: "directory-import",
      path,
      displayTitle: folder.metadata.title,
      progress: { processed: 0, total: files.length, currentPath: path },
      run: async ({ signal, update }) => {
        const summary = createSummary(queuedAt);
        const seenContentAddresses = new Set<string>();
        let processed = 0;

        for (const file of files) {
          if (signal.cancelled) break;

          await update({ processed, total: files.length, currentPath: file.relativePath });

          try {
            const result = await this.importCandidate(file, folder.id, destination);
            summary.imported += 1;
            if (result.contentAddress) {
              if (seenContentAddresses.has(result.contentAddress)) {
                summary.skippedDuplicates += 1;
              }
              seenContentAddresses.add(result.contentAddress);
            }
          } catch (error) {
            summary.failed += 1;
            summary.failures.push({
              path: file.relativePath,
              message: error instanceof Error ? error.message : "Unknown import failure",
            });
          } finally {
            processed += 1;
            await update({ processed, total: files.length, currentPath: file.relativePath });
          }
        }

        summary.elapsedMs = Date.now() - queuedAt;
        await this.commandExecutor.execute({
          id: crypto.randomUUID(),
          type: "UpdateFolderImportStatusCommand",
          payload: {
            folderId: folder.id,
            importStatus: signal.cancelled ? "cancelled" : "indexed",
            indexedCount: summary.imported,
            childCount: files.length,
          },
        });
        return { summary };
      },
    });
    return this.requireImportJob(id);
  }

  async cancel(jobId: JobId): Promise<void> {
    await this.jobManager.cancel(jobId);
  }

  async getJob(jobId: JobId): Promise<ImportJob | undefined> {
    const snapshot = this.jobManager.get(jobId);
    return snapshot ? toImportJob(snapshot) : undefined;
  }

  async listJobs(): Promise<ImportJob[]> {
    return this.jobManager.list().map(toImportJob);
  }

  private async importCandidate(
    candidate: ImportFileCandidate,
    folderParentId?: string,
    destination?: ImportDestination,
  ): Promise<ImportFileResult> {
    const resource = await this.commandExecutor.execute<Resource>({
      id: crypto.randomUUID(),
      type: "ImportContentCommand",
      payload: {
        path: candidate.path,
        displayTitle: candidate.displayTitle ?? candidate.relativePath,
        folderParentId,
        relativePath: candidate.relativePath,
        destination,
        tags: ["imported"],
      },
    });

    return {
      resource,
      contentAddress: readContentAddress(resource),
    };
  }

  private requireImportJob(jobId: JobId): ImportJob {
    const snapshot = this.jobManager.get(jobId);
    if (!snapshot) {
      throw new Error(`Import job was not queued: ${jobId}`);
    }
    return toImportJob(snapshot);
  }

  private async publishSnapshot(snapshot: JobSnapshot): Promise<void> {
    const job = toImportJob(snapshot);
    const previousStatus = this.lastStatuses.get(job.id);
    this.lastStatuses.set(job.id, job.status);

    if (job.status === "running" && previousStatus !== "running") {
      await this.eventPublisher.publish("ImportStarted", { job });
      return;
    }

    if (job.status === "running") {
      await this.eventPublisher.publish("ImportProgress", { job });
      return;
    }

    if (job.status === "completed" && previousStatus !== "completed") {
      await this.eventPublisher.publish("ImportCompleted", { job });
      return;
    }

    if (job.status === "failed" && previousStatus !== "failed") {
      await this.eventPublisher.publish("ImportFailed", { job });
      return;
    }

    if (job.status === "cancelled" && previousStatus !== "cancelled") {
      await this.eventPublisher.publish("ImportCancelled", { job });
    }
  }
}

function createSummary(startedAt: number): ImportJobSummary {
  return {
    imported: 0,
    skippedDuplicates: 0,
    failed: 0,
    elapsedMs: Date.now() - startedAt,
    failures: [],
  };
}

function toImportJob(snapshot: JobSnapshot): ImportJob {
  if (snapshot.type !== "file-import" && snapshot.type !== "directory-import") {
    throw new Error(`Job is not an import job: ${snapshot.id}`);
  }

  return {
    id: snapshot.id,
    type: snapshot.type,
    status: snapshot.status,
    path: snapshot.path ?? snapshot.progress.currentPath ?? "",
    displayTitle: snapshot.displayTitle,
    queuedAt: snapshot.queuedAt,
    startedAt: snapshot.startedAt,
    finishedAt: snapshot.finishedAt,
    progress: { ...snapshot.progress },
    summary: snapshot.summary
      ? {
          ...snapshot.summary,
          failures: snapshot.summary.failures.map((failure) => ({ ...failure })),
        }
      : undefined,
    error: snapshot.error,
  };
}

function readContentAddress(resource: Resource): string | undefined {
  if (resource.metadata.kind !== "content") return undefined;
  const value = resource.metadata.attributes?.contentAddress;
  return typeof value === "string" ? value : undefined;
}
