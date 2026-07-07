import type { EntityId } from "@karya/types";
import type { Repository } from "./contracts";

export class InMemoryRepository<TEntity extends { id: EntityId }> implements Repository<TEntity> {
  private readonly entities = new Map<EntityId, TEntity>();

  constructor(seed: TEntity[] = []) {
    seed.forEach((entity) => this.entities.set(entity.id, entity));
  }

  async list(): Promise<TEntity[]> {
    return [...this.entities.values()];
  }

  async get(id: EntityId): Promise<TEntity | undefined> {
    return this.entities.get(id);
  }

  async save(entity: TEntity): Promise<void> {
    this.entities.set(entity.id, entity);
  }

  async delete(id: EntityId): Promise<void> {
    this.entities.delete(id);
  }
}
