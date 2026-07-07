import type { ContentAddress, ContentDescriptor, EntityId } from "@karya/types";

export interface ContentImportRequest {
  path: string;
  originalName?: string;
  mimeType?: string;
}

export interface PendingContentImport {
  content: ContentDescriptor;
  commit(reference: ContentReference): Promise<void>;
  rollback(): Promise<void>;
}

export interface ContentReference {
  resourceId: EntityId;
}

export interface ContentReadResult {
  content: ContentDescriptor;
  stream: AsyncIterable<Uint8Array>;
}

export interface ContentArtifact {
  path: string;
  mimeType: string;
  byteLength: number;
}

export interface ContentIntegrityResult {
  ok: boolean;
  expectedAddress: ContentAddress;
  actualAddress?: ContentAddress;
  reason?: string;
}

export interface ContentGarbageCollectionResult {
  removed: ContentDescriptor[];
}

export interface ContentStore {
  prepareImport(request: ContentImportRequest): Promise<PendingContentImport>;
  read(address: ContentAddress): Promise<ContentReadResult>;
  get(address: ContentAddress): Promise<ContentDescriptor | undefined>;
  retain(address: ContentAddress, reference: ContentReference): Promise<void>;
  release(address: ContentAddress, reference: ContentReference): Promise<void>;
  generatePreview(address: ContentAddress): Promise<ContentArtifact | undefined>;
  generateThumbnail(address: ContentAddress): Promise<ContentArtifact | undefined>;
  verify(address: ContentAddress): Promise<ContentIntegrityResult>;
  collectGarbage(): Promise<ContentGarbageCollectionResult>;
}
