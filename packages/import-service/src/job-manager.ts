import type { JobId, JobProgress, JobSnapshot } from "@karya/types";
import type { Disposable, Job, JobSnapshotListener, ObservableJobManager } from "./contracts";

interface ManagedJob {
  snapshot: JobSnapshot;
  signal: { cancelled: boolean };
}

export class InMemoryJobManager implements ObservableJobManager {
  private readonly jobs = new Map<JobId, ManagedJob>();
  private readonly listeners = new Set<JobSnapshotListener>();

  async queue(job: Job): Promise<JobId> {
    const id = crypto.randomUUID();
    const snapshot: JobSnapshot = {
      id,
      type: job.type,
      status: "queued",
      path: job.path,
      displayTitle: job.displayTitle,
      queuedAt: new Date().toISOString(),
      progress: { ...job.progress },
    };
    this.jobs.set(id, { snapshot, signal: { cancelled: false } });
    await this.emit(snapshot);
    void this.run(id, job);
    return id;
  }

  async cancel(jobId: JobId): Promise<void> {
    const managed = this.jobs.get(jobId);
    if (!managed || managed.snapshot.status === "completed" || managed.snapshot.status === "failed") {
      return;
    }

    managed.signal.cancelled = true;
    if (managed.snapshot.status === "queued") {
      this.updateSnapshot(jobId, {
        status: "cancelled",
        finishedAt: new Date().toISOString(),
      });
    }
  }

  get(jobId: JobId): JobSnapshot | undefined {
    return cloneSnapshot(this.jobs.get(jobId)?.snapshot);
  }

  list(): JobSnapshot[] {
    return [...this.jobs.values()].map((job) => cloneSnapshot(job.snapshot));
  }

  subscribe(listener: JobSnapshotListener): Disposable {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }

  private async run(jobId: JobId, job: Job): Promise<void> {
    const managed = this.jobs.get(jobId);
    if (!managed) return;

    if (managed.signal.cancelled) {
      this.updateSnapshot(jobId, { status: "cancelled", finishedAt: new Date().toISOString() });
      return;
    }

    this.updateSnapshot(jobId, { status: "running", startedAt: new Date().toISOString() });

    try {
      const result = await job.run({
        signal: managed.signal,
        update: async (progress) => {
          this.updateProgress(jobId, progress);
        },
      });
      const latest = this.jobs.get(jobId);
      if (!latest) return;

      this.updateSnapshot(jobId, {
        ...result,
        status: latest.signal.cancelled ? "cancelled" : "completed",
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      const latest = this.jobs.get(jobId);
      if (!latest) return;

      this.updateSnapshot(jobId, {
        status: latest.signal.cancelled ? "cancelled" : "failed",
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown job failure",
      });
    }
  }

  private updateProgress(jobId: JobId, progress: Partial<JobProgress>): void {
    const managed = this.jobs.get(jobId);
    if (!managed) return;
    this.updateSnapshot(jobId, {
      progress: {
        ...managed.snapshot.progress,
        ...progress,
      },
    });
  }

  private updateSnapshot(jobId: JobId, patch: Partial<JobSnapshot>): void {
    const managed = this.jobs.get(jobId);
    if (!managed) return;
    managed.snapshot = cloneSnapshot({
      ...managed.snapshot,
      ...patch,
      progress: patch.progress ? { ...patch.progress } : { ...managed.snapshot.progress },
    });
    void this.emit(managed.snapshot);
  }

  private async emit(snapshot: JobSnapshot): Promise<void> {
    await Promise.all([...this.listeners].map((listener) => listener(cloneSnapshot(snapshot))));
  }
}

function cloneSnapshot(snapshot: JobSnapshot | undefined): JobSnapshot {
  if (!snapshot) {
    throw new Error("Cannot clone an empty job snapshot");
  }

  return {
    ...snapshot,
    progress: { ...snapshot.progress },
    summary: snapshot.summary
      ? {
          ...snapshot.summary,
          failures: snapshot.summary.failures.map((failure) => ({ ...failure })),
        }
      : undefined,
  };
}
