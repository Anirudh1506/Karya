import { Identifier, Resource as ResourceAggregate, type ResourceRepository } from "@karya/domain";
import type { EntityId, Resource } from "@karya/types";
import { toDomain } from "./mappers";

export class InMemoryResourceRepository implements ResourceRepository {
  private readonly resources = new Map<EntityId, ResourceAggregate>();

  constructor(seed: Resource[] = []) {
    seed.forEach((resource) => this.resources.set(resource.id, toDomain(resource)));
  }

  async save(resource: ResourceAggregate): Promise<void> {
    this.resources.set(resource.toSnapshot().id.value, ResourceAggregate.rehydrate(resource.toSnapshot()));
  }

  async findById(id: Identifier): Promise<ResourceAggregate | undefined> {
    const resource = this.resources.get(id.value);
    return resource ? ResourceAggregate.rehydrate(resource.toSnapshot()) : undefined;
  }

  async list(): Promise<ResourceAggregate[]> {
    return [...this.resources.values()].map((resource) => ResourceAggregate.rehydrate(resource.toSnapshot()));
  }
}
