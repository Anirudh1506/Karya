import {
  Identifier,
  Resource as ResourceAggregate,
  ResourceFactory,
  Tag,
  Timestamp,
  type RelationshipType,
  type ResourceCommand,
  type ResourceRepository,
} from "@karya/domain";
import type { EventBus } from "@karya/event-bus";
import type { EntityId, LifecycleState, Resource } from "@karya/types";
import type { CreateResourceRequest, ResourceService, UpdateResourceRequest } from "./contracts";
import { publishResourceDomainEvent } from "./events";
import { toDomainMetadataPatch, toDto } from "./mappers";
import { InMemoryResourceRepository } from "./repository";

export class InMemoryResourceService implements ResourceService {
  private readonly repository: ResourceRepository;

  constructor(
    private readonly eventBus: EventBus,
    seed: Resource[] = [],
    repository?: ResourceRepository,
  ) {
    this.repository = repository ?? new InMemoryResourceRepository(seed);
  }

  async listResources(): Promise<Resource[]> {
    const resources = await this.repository.list();
    return resources.map(toDto);
  }

  async getResource(id: EntityId): Promise<Resource | undefined> {
    const resource = await this.repository.findById(Identifier.from(id, "ResourceId"));
    return resource ? toDto(resource) : undefined;
  }

  async create(request: CreateResourceRequest): Promise<Resource> {
    return this.createResource(request);
  }

  async update(request: UpdateResourceRequest): Promise<Resource> {
    const aggregate = await this.requireResource(request.id);
    const occurredAt = now();

    if (request.metadata) {
      aggregate.updateMetadata(toDomainMetadataPatch(request.metadata, occurredAt), occurredAt);
    }
    if (request.tags) {
      aggregate.replaceTags(request.tags.map(Tag.from), occurredAt);
    }
    if (request.owner || request.profileId || request.primaryWorkspaceId || request.defaultSpace) {
      const snapshot = aggregate.toSnapshot();
      const workspaceRefs = request.workspaceRefs ?? snapshot.workspaceRefs.map((workspaceId) => workspaceId.value);
      aggregate.movePlacement({
        owner: Identifier.from(request.owner ?? snapshot.ownership.owner.value, "OwnerId"),
        profileId: Identifier.from(request.profileId ?? snapshot.ownership.profileId.value, "ProfileId"),
        workspaceRefs: workspaceRefs.map((workspaceId) => Identifier.from(workspaceId, "WorkspaceId")),
        primaryWorkspaceId: request.primaryWorkspaceId
          ? Identifier.from(request.primaryWorkspaceId, "WorkspaceId")
          : workspaceRefs[0]
            ? Identifier.from(workspaceRefs[0], "WorkspaceId")
            : undefined,
        defaultSpace: request.defaultSpace ?? snapshot.defaultSpace,
      }, occurredAt);
    } else if (request.workspaceRefs) {
      await this.replaceWorkspaceReferences(aggregate, request.workspaceRefs, occurredAt);
    }

    return this.saveAndPublish(aggregate);
  }

  async rename(id: EntityId, title: string): Promise<Resource> {
    const aggregate = await this.requireResource(id);
    aggregate.rename(title, now());
    return this.saveAndPublish(aggregate);
  }

  async archive(id: EntityId): Promise<void> {
    await this.updateLifecycle(id, "archived");
  }

  async restore(id: EntityId): Promise<Resource> {
    return this.updateLifecycle(id, "active");
  }

  async delete(id: EntityId): Promise<void> {
    await this.updateLifecycle(id, "deleted");
  }

  async createResource(input: CreateResourceRequest): Promise<Resource> {
    const occurredAt = new Date().toISOString();
    const aggregate = ResourceFactory.create({
      id: crypto.randomUUID(),
      type: input.type,
      owner: input.owner,
      profileId: input.profileId,
      workspaceRefs: input.workspaceRefs,
      primaryWorkspaceId: input.primaryWorkspaceId,
      defaultSpace: input.defaultSpace,
      tags: input.tags,
      title: input.displayTitle,
      description: input.description,
      createdBy: input.owner,
      kind: input.metadata?.kind,
      importance: input.metadata?.importance,
      color: input.metadata?.color,
      attributes: input.metadata?.attributes,
      occurredAt,
    });

    return this.saveAndPublish(aggregate);
  }

  async updateLifecycle(id: EntityId, lifecycleState: LifecycleState): Promise<Resource> {
    const aggregate = await this.requireResource(id);
    const occurredAt = now();

    if (lifecycleState === "archived") {
      aggregate.archive(occurredAt);
    } else if (lifecycleState === "deleted") {
      aggregate.delete(occurredAt);
    } else if (lifecycleState === "active") {
      aggregate.restore(occurredAt);
    } else {
      aggregate.updateMetadata({}, occurredAt);
    }

    return this.saveAndPublish(aggregate);
  }

  async addWorkspaceReference(id: EntityId, workspaceId: EntityId, makePrimary = false): Promise<Resource> {
    const aggregate = await this.requireResource(id);
    aggregate.addWorkspaceReference(Identifier.from(workspaceId, "WorkspaceId"), now(), makePrimary);
    return this.saveAndPublish(aggregate);
  }

  async removeWorkspaceReference(id: EntityId, workspaceId: EntityId): Promise<Resource> {
    const aggregate = await this.requireResource(id);
    aggregate.removeWorkspaceReference(Identifier.from(workspaceId, "WorkspaceId"), now());
    return this.saveAndPublish(aggregate);
  }

  async addRelationship(
    sourceId: EntityId,
    targetResourceId: EntityId,
    type: Resource["relationships"][number]["type"],
    metadata: Record<string, string> = {},
  ): Promise<Resource> {
    const aggregate = await this.requireResource(sourceId);
    const occurredAt = now();

    aggregate.addRelationship(
      {
        id: Identifier.from(crypto.randomUUID(), "RelationshipId"),
        targetResourceId: Identifier.from(targetResourceId, "ResourceId"),
        type: type as RelationshipType,
        metadata,
      },
      occurredAt,
    );

    return this.saveAndPublish(aggregate);
  }

  async removeRelationship(sourceId: EntityId, relationshipId: EntityId): Promise<Resource> {
    const aggregate = await this.requireResource(sourceId);
    aggregate.removeRelationship(Identifier.from(relationshipId, "RelationshipId"), now());
    return this.saveAndPublish(aggregate);
  }

  async updateMetadata(id: EntityId, metadata: Partial<Resource["metadata"]>): Promise<Resource> {
    const aggregate = await this.requireResource(id);
    const occurredAt = now();
    aggregate.updateMetadata(toDomainMetadataPatch(metadata, occurredAt), occurredAt);
    return this.saveAndPublish(aggregate);
  }

  async execute(command: ResourceCommand): Promise<Resource> {
    if (command.type === "CreateResource") {
      const resource = ResourceFactory.create(command.payload);
      return this.saveAndPublish(resource);
    }

    const aggregate = await this.requireResource(command.payload.id);
    const occurredAt = Timestamp.from(command.payload.occurredAt);

    if (command.type === "RenameResource") {
      aggregate.rename(command.payload.title, occurredAt, command.payload.actorId ? Identifier.from(command.payload.actorId, "UserId") : undefined);
    } else if (command.type === "ArchiveResource") {
      aggregate.archive(occurredAt);
    } else if (command.type === "RestoreResource") {
      aggregate.restore(occurredAt);
    } else if (command.type === "DeleteResource") {
      aggregate.delete(occurredAt);
    } else if (command.type === "AddWorkspaceReference") {
      aggregate.addWorkspaceReference(Identifier.from(command.payload.workspaceId, "WorkspaceId"), occurredAt, command.payload.makePrimary);
    } else if (command.type === "RemoveWorkspaceReference") {
      aggregate.removeWorkspaceReference(Identifier.from(command.payload.workspaceId, "WorkspaceId"), occurredAt);
    } else if (command.type === "UpdateMetadata") {
      aggregate.updateMetadata(command.payload.metadata, occurredAt);
    }

    return this.saveAndPublish(aggregate);
  }

  private async replaceWorkspaceReferences(
    aggregate: ResourceAggregate,
    workspaceRefs: EntityId[],
    occurredAt: Timestamp,
  ): Promise<void> {
    const snapshot = aggregate.toSnapshot();
    const nextRefs = new Set(workspaceRefs);

    snapshot.workspaceRefs
      .filter((workspaceId) => !nextRefs.has(workspaceId.value))
      .forEach((workspaceId) => aggregate.removeWorkspaceReference(workspaceId, occurredAt));
    workspaceRefs.forEach((workspaceId) =>
      aggregate.addWorkspaceReference(Identifier.from(workspaceId, "WorkspaceId"), occurredAt),
    );
  }

  private async requireResource(id: EntityId): Promise<ResourceAggregate> {
    const resource = await this.repository.findById(Identifier.from(id, "ResourceId"));
    if (!resource) {
      throw new Error(`Resource not found: ${id}`);
    }
    return resource;
  }

  private async saveAndPublish(aggregate: ResourceAggregate): Promise<Resource> {
    await this.repository.save(aggregate);
    const resource = toDto(aggregate);
    const events = aggregate.pullEvents();

    for (const event of events) {
      await publishResourceDomainEvent(this.eventBus, event, resource);
    }

    if (events.length === 0) {
      await this.eventBus.publish("ResourceUpdated", { resource });
      await this.eventBus.publish("resource:updated", { resource });
    }

    return resource;
  }
}

function now(): Timestamp {
  return Timestamp.from(new Date().toISOString());
}
