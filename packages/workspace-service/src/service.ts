import {
  Identifier,
  Timestamp,
  Workspace as WorkspaceAggregate,
  type WorkspaceLayout,
  type WorkspaceRepository,
} from "@karya/domain";
import type { EventBus } from "@karya/event-bus";
import type {
  EntityId,
  Workspace,
  WorkspaceLaunchSet,
  WorkspaceReference,
  WorkspaceSettingsUpdate,
} from "@karya/types";
import type { CreateWorkspaceRequest, WorkspaceService } from "./contracts";
import { publishWorkspaceDomainEvent } from "./events";
import { toDomain, toDomainLaunchSet, toDto } from "./mappers";
import { InMemoryWorkspaceRepository } from "./repository";
import { WORKSPACE_NAME_REQUIRED_ERROR } from "./constants";

export class InMemoryWorkspaceService implements WorkspaceService {
  private readonly repository: WorkspaceRepository;
  private activeWorkspaceId?: EntityId;

  constructor(
    private readonly eventBus: EventBus,
    seed: Workspace[] = [],
    activeWorkspaceId?: EntityId,
    repository?: WorkspaceRepository,
  ) {
    this.repository = repository ?? new InMemoryWorkspaceRepository(seed);
    const activeWorkspace = seed.find(
      (workspace) => workspace.id === activeWorkspaceId && workspace.lifecycleState !== "deleted",
    );
    this.activeWorkspaceId =
      activeWorkspace?.id ??
      seed.find((workspace) => workspace.lifecycleState === "open")?.id ??
      seed.find((workspace) => workspace.lifecycleState !== "deleted")?.id;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    const workspaces = await this.repository.list();
    return workspaces.map(toDto);
  }

  async listWorkspaceReferences(): Promise<WorkspaceReference[]> {
    return (await this.listWorkspaces())
      .filter((workspace) => workspace.lifecycleState !== "deleted")
      .map(({ id, name }) => ({ id, name }));
  }

  async getActiveWorkspace(): Promise<Workspace | undefined> {
    if (!this.activeWorkspaceId) return undefined;
    const workspace = await this.repository.findById(Identifier.from(this.activeWorkspaceId, "WorkspaceId"));
    const dto = workspace ? toDto(workspace) : undefined;
    if (!dto || dto.lifecycleState === "deleted") {
      this.activeWorkspaceId = undefined;
      return undefined;
    }
    return dto;
  }

  async create(request: CreateWorkspaceRequest): Promise<Workspace> {
    const name = request.name.trim();
    if (!name) throw new Error(WORKSPACE_NAME_REQUIRED_ERROR);
    const occurredAt = new Date().toISOString();
    const aggregate = WorkspaceAggregate.createFromRequest({
      id: crypto.randomUUID(),
      name,
      profileId: request.profileId,
      owner: request.owner ?? request.profileId,
      description: request.description,
      color: request.color,
      icon: request.icon,
      templateId: request.templateId,
      createdBy: request.owner ?? request.profileId,
      occurredAt,
    });
    this.activeWorkspaceId = aggregate.toSnapshot().id.value;
    return this.saveAndPublish(aggregate);
  }

  async applyReplica(workspace: Workspace): Promise<Workspace> {
    await this.repository.save(toDomain(workspace));
    await this.eventBus.publish("WorkspaceUpdated", { workspace });
    return workspace;
  }

  async open(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.open(now(), Identifier.from(crypto.randomUUID(), "WorkspaceSessionId"));
    this.activeWorkspaceId = id;
    return this.saveAndPublish(aggregate);
  }

  async close(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.close(now());
    if (this.activeWorkspaceId === id) {
      this.activeWorkspaceId = undefined;
    }
    return this.saveAndPublish(aggregate);
  }

  async rename(id: EntityId, name: string): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.rename(name, now());
    return this.saveAndPublish(aggregate);
  }

  async archive(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.archive(now());
    if (this.activeWorkspaceId === id) {
      this.activeWorkspaceId = undefined;
    }
    return this.saveAndPublish(aggregate);
  }

  async restore(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.restore(now(), Identifier.from(crypto.randomUUID(), "WorkspaceSessionId"));
    this.activeWorkspaceId = id;
    return this.saveAndPublish(aggregate);
  }

  async delete(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.delete(now());
    if (this.activeWorkspaceId === id) {
      this.activeWorkspaceId = undefined;
    }
    return this.saveAndPublish(aggregate);
  }

  async pin(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.pin(now());
    return this.saveAndPublish(aggregate);
  }

  async unpin(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.unpin(now());
    return this.saveAndPublish(aggregate);
  }

  async favorite(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.favorite(now());
    return this.saveAndPublish(aggregate);
  }

  async unfavorite(id: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(id);
    aggregate.unfavorite(now());
    return this.saveAndPublish(aggregate);
  }

  async createWorkspace(name: string, profileId: EntityId): Promise<Workspace> {
    return this.create({ name, profileId, owner: profileId });
  }

  async activateWorkspace(id: EntityId): Promise<Workspace> {
    return this.open(id);
  }

  async restoreWorkspace(id: EntityId): Promise<Workspace> {
    return this.restore(id);
  }

  async addResourceReference(workspaceId: EntityId, resourceId: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(workspaceId);
    aggregate.addResourceReference(Identifier.from(resourceId, "ResourceId"), now());
    return this.saveAndPublish(aggregate);
  }

  async removeResourceReference(workspaceId: EntityId, resourceId: EntityId): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(workspaceId);
    aggregate.removeResourceReference(Identifier.from(resourceId, "ResourceId"), now());
    return this.saveAndPublish(aggregate);
  }

  async setPreferredApplication(workspaceId: EntityId, applicationId: EntityId, preferred = true): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(workspaceId);
    if (preferred) {
      aggregate.pinApplication(Identifier.from(applicationId, "ApplicationId"), now());
    } else {
      aggregate.unpinApplication(Identifier.from(applicationId, "ApplicationId"), now());
    }
    return this.saveAndPublish(aggregate);
  }

  async updateLaunchSet(workspaceId: EntityId, launchSet: WorkspaceLaunchSet | undefined): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(workspaceId);
    aggregate.updateLaunchSet(launchSet ? toDomainLaunchSet(launchSet) : undefined, now());
    return this.saveAndPublish(aggregate);
  }

  async updateSettings(workspaceId: EntityId, update: WorkspaceSettingsUpdate): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(workspaceId);
    aggregate.updateSettings(update, now());
    return this.saveAndPublish(aggregate);
  }

  async updateLayout(workspaceId: EntityId, layout: Partial<WorkspaceLayout>): Promise<Workspace> {
    const aggregate = await this.requireWorkspace(workspaceId);
    aggregate.updateLayout(layout, now());
    return this.saveAndPublish(aggregate);
  }

  private async requireWorkspace(id: EntityId): Promise<WorkspaceAggregate> {
    const workspace = await this.repository.findById(Identifier.from(id, "WorkspaceId"));
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }
    return workspace;
  }

  private async saveAndPublish(aggregate: WorkspaceAggregate): Promise<Workspace> {
    await this.repository.save(aggregate);
    const workspace = toDto(aggregate);
    const events = aggregate.pullEvents();

    for (const event of events) {
      await publishWorkspaceDomainEvent(this.eventBus, event, workspace);
    }

    if (events.length === 0) {
      await this.eventBus.publish("WorkspaceUpdated", { workspace });
    }

    return workspace;
  }
}

function now(): Timestamp {
  return Timestamp.from(new Date().toISOString());
}
