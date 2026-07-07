import type { EntityId, InstalledApplication } from "@karya/types";

export interface ApplicationRepository {
  list(): Promise<InstalledApplication[]>;
  get(id: EntityId): Promise<InstalledApplication | undefined>;
  findById(id: EntityId): Promise<InstalledApplication | undefined>;
  save(application: InstalledApplication): Promise<void>;
  delete(id: EntityId): Promise<void>;
  remove(id: EntityId): Promise<void>;
}

export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly applications = new Map<EntityId, InstalledApplication>();

  constructor(seed: InstalledApplication[] = []) {
    seed.forEach((application) => this.applications.set(application.metadata.id, application));
  }

  async list(): Promise<InstalledApplication[]> {
    return [...this.applications.values()];
  }

  async findById(id: EntityId): Promise<InstalledApplication | undefined> {
    return this.applications.get(id);
  }

  async get(id: EntityId): Promise<InstalledApplication | undefined> {
    return this.findById(id);
  }

  async save(application: InstalledApplication): Promise<void> {
    this.applications.set(application.metadata.id, application);
  }

  async remove(id: EntityId): Promise<void> {
    this.applications.delete(id);
  }

  async delete(id: EntityId): Promise<void> {
    await this.remove(id);
  }
}
