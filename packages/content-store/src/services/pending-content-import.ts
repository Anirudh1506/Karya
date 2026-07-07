import type { ContentDescriptor } from "@karya/types";
import type { ContentReference, PendingContentImport } from "../contracts";

export interface PendingContentImportStore {
  finalizeImport(stagingFile: string, content: ContentDescriptor, reference: ContentReference): Promise<void>;
  rollbackImport(stagingFile: string): Promise<void>;
}

export class FileSystemPendingContentImport implements PendingContentImport {
  constructor(
    private readonly store: PendingContentImportStore,
    private readonly stagingFile: string,
    readonly content: ContentDescriptor,
  ) {}

  async commit(reference: ContentReference): Promise<void> {
    await this.store.finalizeImport(this.stagingFile, this.content, reference);
  }

  async rollback(): Promise<void> {
    await this.store.rollbackImport(this.stagingFile);
  }
}
