import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { ContentAddress, ContentDescriptor, EntityId } from "@karya/types";
import type {
  ContentGarbageCollectionResult,
  ContentImportRequest,
  ContentIntegrityResult,
  ContentReadResult,
  ContentArtifact,
  ContentReference,
  ContentStore,
  PendingContentImport,
} from "./contracts";
import { detectMimeType } from "./mime";
import { FileSystemPendingContentImport } from "./services/pending-content-import";
import { exists, hashFile, streamFileWithHash } from "./utils/file-hash";

interface StoredContentRecord {
  content: ContentDescriptor;
  references: EntityId[];
}

export interface FileSystemContentStoreOptions {
  rootPath: string;
}

export class FileSystemContentStore implements ContentStore {
  private readonly blobsPath: string;
  private readonly metadataPath: string;
  private readonly previewsPath: string;
  private readonly stagingPath: string;
  private readonly thumbnailsPath: string;

  constructor(options: FileSystemContentStoreOptions) {
    this.blobsPath = join(options.rootPath, "blobs");
    this.metadataPath = join(options.rootPath, "metadata");
    this.previewsPath = join(options.rootPath, "previews");
    this.stagingPath = join(options.rootPath, "staging");
    this.thumbnailsPath = join(options.rootPath, "thumbnails");
  }

  async prepareImport(request: ContentImportRequest): Promise<PendingContentImport> {
    await this.ensureDirectories();

    const sourceStat = await stat(request.path);
    if (!sourceStat.isFile()) {
      throw new Error(`Content import source is not a file: ${request.path}`);
    }

    const stagingFile = join(this.stagingPath, `${randomUUID()}.blob`);
    const { address, byteLength, header } = await streamFileWithHash(request.path, stagingFile);
    const content: ContentDescriptor = {
      address,
      byteLength,
      mimeType: detectMimeType(request.path, header, request.mimeType),
      originalName: request.originalName ?? basename(request.path),
      extension: extname(request.path).replace(".", "") || undefined,
      createdAt: new Date().toISOString(),
      previewAvailable: false,
      thumbnailAvailable: false,
    };

    return new FileSystemPendingContentImport(this, stagingFile, content);
  }

  async read(address: ContentAddress): Promise<ContentReadResult> {
    const content = await this.require(address);
    return {
      content,
      stream: createReadStream(this.blobPath(address)),
    };
  }

  async get(address: ContentAddress): Promise<ContentDescriptor | undefined> {
    const record = await this.readRecord(address);
    return record?.content;
  }

  async retain(address: ContentAddress, reference: ContentReference): Promise<void> {
    const record = await this.requireRecord(address);
    if (!record.references.includes(reference.resourceId)) {
      record.references.push(reference.resourceId);
      await this.writeRecord(record);
    }
  }

  async release(address: ContentAddress, reference: ContentReference): Promise<void> {
    const record = await this.readRecord(address);
    if (!record) return;

    record.references = record.references.filter((resourceId) => resourceId !== reference.resourceId);
    await this.writeRecord(record);
  }

  async generatePreview(_address: ContentAddress): Promise<ContentArtifact | undefined> {
    return undefined;
  }

  async generateThumbnail(_address: ContentAddress): Promise<ContentArtifact | undefined> {
    return undefined;
  }

  async verify(address: ContentAddress): Promise<ContentIntegrityResult> {
    const content = await this.get(address);
    if (!content) {
      return { ok: false, expectedAddress: address, reason: "Content metadata not found" };
    }

    try {
      const actualAddress = await hashFile(this.blobPath(address));
      return {
        ok: actualAddress === address,
        expectedAddress: address,
        actualAddress,
        reason: actualAddress === address ? undefined : "Content hash mismatch",
      };
    } catch (error) {
      return {
        ok: false,
        expectedAddress: address,
        reason: error instanceof Error ? error.message : "Content blob could not be read",
      };
    }
  }

  async collectGarbage(): Promise<ContentGarbageCollectionResult> {
    await this.ensureDirectories();
    const removed: ContentDescriptor[] = [];
    const metadataEntries = await readdir(this.metadataPath);

    for (const entry of metadataEntries) {
      if (!entry.endsWith(".json")) continue;
      const address = entry.slice(0, -".json".length);
      const record = await this.readRecord(address);
      if (!record || record.references.length > 0) continue;

      await rm(this.blobPath(address), { force: true });
      await rm(this.recordPath(address), { force: true });
      removed.push(record.content);
    }

    return { removed };
  }

  async finalizeImport(stagingFile: string, content: ContentDescriptor, reference: ContentReference): Promise<void> {
    await this.ensureDirectories();
    const destination = this.blobPath(content.address);
    await mkdir(this.blobDirectory(content.address), { recursive: true });

    if (!(await exists(destination))) {
      await rename(stagingFile, destination);
    } else {
      await rm(stagingFile, { force: true });
    }

    const existing = await this.readRecord(content.address);
    const record: StoredContentRecord = existing ?? { content, references: [] };
    if (!record.references.includes(reference.resourceId)) {
      record.references.push(reference.resourceId);
    }
    await this.writeRecord(record);
  }

  async rollbackImport(stagingFile: string): Promise<void> {
    await rm(stagingFile, { force: true });
  }

  private async ensureDirectories(): Promise<void> {
    await Promise.all([
      mkdir(this.blobsPath, { recursive: true }),
      mkdir(this.metadataPath, { recursive: true }),
      mkdir(this.previewsPath, { recursive: true }),
      mkdir(this.stagingPath, { recursive: true }),
      mkdir(this.thumbnailsPath, { recursive: true }),
    ]);
  }

  private async require(address: ContentAddress): Promise<ContentDescriptor> {
    const content = await this.get(address);
    if (!content) {
      throw new Error(`Content not found: ${address}`);
    }
    return content;
  }

  private async requireRecord(address: ContentAddress): Promise<StoredContentRecord> {
    const record = await this.readRecord(address);
    if (!record) {
      throw new Error(`Content not found: ${address}`);
    }
    return record;
  }

  private async readRecord(address: ContentAddress): Promise<StoredContentRecord | undefined> {
    try {
      return JSON.parse(await readFile(this.recordPath(address), "utf8")) as StoredContentRecord;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  private async writeRecord(record: StoredContentRecord): Promise<void> {
    await writeFile(this.recordPath(record.content.address), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }

  private blobDirectory(address: ContentAddress): string {
    return join(this.blobsPath, address.slice(0, 2), address.slice(2, 4));
  }

  private blobPath(address: ContentAddress): string {
    return join(this.blobDirectory(address), address);
  }

  private recordPath(address: ContentAddress): string {
    return join(this.metadataPath, `${address}.json`);
  }
}
