import type { Workspace } from "./aggregate";
import type { WorkspaceId } from "./types";

export interface WorkspaceRepository {
  save(workspace: Workspace): Promise<void>;
  findById(id: WorkspaceId): Promise<Workspace | undefined>;
  list(): Promise<Workspace[]>;
}
