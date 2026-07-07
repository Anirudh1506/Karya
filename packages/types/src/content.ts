import type { EntityId, ISODateString } from "./common";

export type ContentAddress = string;

export interface ContentDescriptor {
  address: ContentAddress;
  byteLength: number;
  mimeType: string;
  originalName?: string;
  extension?: string;
  createdAt: ISODateString;
  previewAvailable: boolean;
  thumbnailAvailable: boolean;
}

export interface ContentImportResult {
  content: ContentDescriptor;
  resourceId?: EntityId;
}
