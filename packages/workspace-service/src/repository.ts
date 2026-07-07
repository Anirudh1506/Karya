import { Identifier, Workspace as WorkspaceAggregate, type WorkspaceRepository } from "@karya/domain";
import type { EntityId, Workspace } from "@karya/types";
import { toDomain } from "./mappers";

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly workspaces = new Map<EntityId, WorkspaceAggregate>();

  constructor(seed: Workspace[] = []) {
    seed.forEach((workspace) => this.workspaces.set(workspace.id, toDomain(workspace)));
  }

  async save(workspace: WorkspaceAggregate): Promise<void> {
    this.workspaces.set(workspace.toSnapshot().id.value, WorkspaceAggregate.rehydrate(workspace.toSnapshot()));
  }

  async findById(id: Identifier): Promise<WorkspaceAggregate | undefined> {
    const workspace = this.workspaces.get(id.value);
    return workspace ? WorkspaceAggregate.rehydrate(workspace.toSnapshot()) : undefined;
  }

  async list(): Promise<WorkspaceAggregate[]> {
    return [...this.workspaces.values()].map((workspace) => WorkspaceAggregate.rehydrate(workspace.toSnapshot()));
  }
}
