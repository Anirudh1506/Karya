import { describe, expect, it } from "vitest";
import type { ImportCommand, ImportSourceProvider } from "./contracts";
import { DefaultImportService } from "./import-service";
import type { ImportJob, KaryaEventMap, KaryaEventName, Resource } from "@karya/types";

describe("DefaultImportService", () => {
  it("imports a single file through ImportContentCommand", async () => {
    const executor = new FakeImportExecutor();
    const events: ImportEventRecord[] = [];
    const service = createService({ executor, events });

    const job = await service.importFile("/imports/a.txt", "A");
    const completed = await waitForJob(service, job.id);

    expect(executor.commands).toHaveLength(1);
    expect(executor.commands[0]?.type).toBe("ImportContentCommand");
    expect(fileImportCommands(executor)[0]?.payload.path).toBe("/imports/a.txt");
    expect(completed.status).toBe("completed");
    expect(completed.summary).toMatchObject({ imported: 1, failed: 0 });
    expect(events.map((event) => event.name)).toContain("ImportStarted");
    expect(events.map((event) => event.name)).toContain("ImportCompleted");
  });

  it("imports nested directories sequentially", async () => {
    const executor = new FakeImportExecutor();
    const sourceProvider = new FakeSourceProvider([
      file("/imports/root.txt", "root.txt"),
      file("/imports/nested/deck.pdf", "nested/deck.pdf"),
    ]);
    const service = createService({ executor, sourceProvider });

    const job = await service.importDirectory("/imports");
    const completed = await waitForJob(service, job.id);

    expect(fileImportCommands(executor).map((command) => command.payload.displayTitle)).toEqual(["root.txt", "nested/deck.pdf"]);
    expect(completed.progress).toMatchObject({ processed: 2, total: 2 });
    expect(completed.summary).toMatchObject({ imported: 2, failed: 0 });
  });

  it("reports duplicate content addresses without bypassing content import", async () => {
    const executor = new FakeImportExecutor({ addresses: ["sha256:same", "sha256:same"] });
    const sourceProvider = new FakeSourceProvider([
      file("/imports/a.txt", "a.txt"),
      file("/imports/copy.txt", "copy.txt"),
    ]);
    const service = createService({ executor, sourceProvider });

    const job = await service.importDirectory("/imports");
    const completed = await waitForJob(service, job.id);

    expect(fileImportCommands(executor)).toHaveLength(2);
    expect(completed.summary).toMatchObject({ imported: 2, skippedDuplicates: 1, failed: 0 });
  });

  it("publishes progress while directory imports run", async () => {
    const executor = new FakeImportExecutor();
    const events: ImportEventRecord[] = [];
    const sourceProvider = new FakeSourceProvider([
      file("/imports/a.txt", "a.txt"),
      file("/imports/b.txt", "b.txt"),
      file("/imports/c.txt", "c.txt"),
    ]);
    const service = createService({ executor, sourceProvider, events });

    const job = await service.importDirectory("/imports");
    await waitForJob(service, job.id);

    const progressEvents = events.filter((event) => event.name === "ImportProgress");
    expect(progressEvents.length).toBeGreaterThanOrEqual(3);
    expect(progressEvents.at(-1)?.payload.job.progress).toMatchObject({ processed: 3, total: 3 });
  });

  it("continues after individual file failures and reports partial failures", async () => {
    const executor = new FakeImportExecutor({ failPaths: new Set(["/imports/b.txt"]) });
    const sourceProvider = new FakeSourceProvider([
      file("/imports/a.txt", "a.txt"),
      file("/imports/b.txt", "b.txt"),
      file("/imports/c.txt", "c.txt"),
    ]);
    const service = createService({ executor, sourceProvider });

    const job = await service.importDirectory("/imports");
    const completed = await waitForJob(service, job.id);

    expect(completed.status).toBe("completed");
    expect(completed.summary).toMatchObject({ imported: 2, failed: 1 });
    expect(completed.summary?.failures[0]).toMatchObject({ path: "b.txt" });
  });

  it("cancels before starting remaining files", async () => {
    const gate = createGate();
    const executor = new FakeImportExecutor({ beforeResolve: async () => gate.promise });
    const sourceProvider = new FakeSourceProvider([
      file("/imports/a.txt", "a.txt"),
      file("/imports/b.txt", "b.txt"),
      file("/imports/c.txt", "c.txt"),
    ]);
    const service = createService({ executor, sourceProvider });

    const job = await service.importDirectory("/imports");
    await waitFor(() => fileImportCommands(executor).length === 1);
    await service.cancel(job.id);
    gate.release();
    const cancelled = await waitForJob(service, job.id);

    expect(cancelled.status).toBe("cancelled");
    expect(fileImportCommands(executor)).toHaveLength(1);
    expect(cancelled.summary).toMatchObject({ imported: 1, failed: 0 });
  });

  it("completes empty directories without importing files", async () => {
    const executor = new FakeImportExecutor();
    const service = createService({ executor, sourceProvider: new FakeSourceProvider([]) });

    const job = await service.importDirectory("/empty");
    const completed = await waitForJob(service, job.id);

    expect(fileImportCommands(executor)).toHaveLength(0);
    expect(completed.progress).toMatchObject({ processed: 0, total: 0 });
    expect(completed.summary).toMatchObject({ imported: 0, failed: 0 });
  });

  it("handles large directory imports with stable progress totals", async () => {
    const files = Array.from({ length: 100 }, (_, index) => file(`/imports/${index}.txt`, `${index}.txt`));
    const executor = new FakeImportExecutor();
    const service = createService({ executor, sourceProvider: new FakeSourceProvider(files) });

    const job = await service.importDirectory("/imports");
    const completed = await waitForJob(service, job.id);

    expect(fileImportCommands(executor)).toHaveLength(100);
    expect(completed.progress).toMatchObject({ processed: 100, total: 100 });
    expect(completed.summary).toMatchObject({ imported: 100, failed: 0 });
  });
});

class FakeImportExecutor {
  readonly commands: ImportCommand[] = [];
  private nextAddress = 0;

  constructor(
    private readonly options: {
      addresses?: string[];
      beforeResolve?: () => Promise<void>;
      failPaths?: Set<string>;
    } = {},
  ) {}

  async execute<TResult = unknown>(command: ImportCommand): Promise<TResult> {
    this.commands.push(command);
    if (command.type === "CreateFolderResourceCommand") {
      return createResource(command.payload.displayTitle ?? command.payload.path, "folder:address", {
        type: "inode/directory",
        kind: "folder",
      }) as TResult;
    }
    if (command.type === "UpdateFolderImportStatusCommand") {
      return createResource(command.payload.folderId, "folder:address", {
        type: "inode/directory",
        kind: "folder",
      }) as TResult;
    }
    await this.options.beforeResolve?.();

    if (this.options.failPaths?.has(command.payload.path)) {
      throw new Error(`Import failed for ${command.payload.path}`);
    }

    const address = this.options.addresses?.[this.nextAddress] ?? `sha256:${this.nextAddress}`;
    this.nextAddress += 1;
    return createResource(command.payload.displayTitle ?? command.payload.path, address) as TResult;
  }
}

class FakeSourceProvider implements ImportSourceProvider {
  constructor(private readonly files: ReturnType<typeof file>[]) {}

  async walkDirectory(): Promise<ReturnType<typeof file>[]> {
    return this.files;
  }
}

function createService(options: {
  events?: ImportEventRecord[];
  executor?: FakeImportExecutor;
  sourceProvider?: ImportSourceProvider;
}): DefaultImportService {
  return new DefaultImportService({
    commandExecutor: options.executor ?? new FakeImportExecutor(),
    eventPublisher: {
      async publish<TEventName extends KaryaEventName>(
        eventName: TEventName,
        payload: KaryaEventMap[TEventName],
      ): Promise<void> {
        options.events?.push({
          name: eventName as ImportEventName,
          payload: payload as KaryaEventMap[ImportEventName],
        });
      },
    },
    sourceProvider: options.sourceProvider,
  });
}

function file(path: string, relativePath: string): { path: string; relativePath: string; displayTitle: string } {
  return { path, relativePath, displayTitle: relativePath };
}

function createResource(
  title: string,
  address: string,
  options: { type?: string; kind?: string } = {},
): Resource {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type: options.type ?? "text/plain",
    metadata: {
      title,
      kind: options.kind ?? "content",
      createdAt: now,
      updatedAt: now,
      attributes: {
        contentAddress: address,
      },
    },
    owner: "profile:user",
    profileId: "profile:user",
    workspaceRefs: [],
    defaultSpace: "user",
    tags: ["imported"],
    relationships: [],
    status: "active",
    lifecycleState: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function fileImportCommands(executor: FakeImportExecutor): Extract<ImportCommand, { type: "ImportContentCommand" }>[] {
  return executor.commands.filter(
    (command): command is Extract<ImportCommand, { type: "ImportContentCommand" }> => command.type === "ImportContentCommand",
  );
}

async function waitForJob(service: DefaultImportService, jobId: string): Promise<ImportJob> {
  await waitFor(async () => {
    const job = await service.getJob(jobId);
    return !!job && ["completed", "failed", "cancelled"].includes(job.status);
  });
  const job = await service.getJob(jobId);
  if (!job) throw new Error(`Missing job ${jobId}`);
  return job;
}

async function waitFor(predicate: () => boolean | Promise<boolean>): Promise<void> {
  const startedAt = Date.now();
  while (!(await predicate())) {
    if (Date.now() - startedAt > 1000) {
      throw new Error("Timed out waiting for import job");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function createGate(): { promise: Promise<void>; release: () => void } {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

type ImportEventName = "ImportStarted" | "ImportProgress" | "ImportCompleted" | "ImportFailed" | "ImportCancelled";

interface ImportEventRecord {
  name: ImportEventName;
  payload: KaryaEventMap[ImportEventName];
}
