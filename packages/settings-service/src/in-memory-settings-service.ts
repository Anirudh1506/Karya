import type { SettingsRepository } from "@karya/persistence";
import type { EntityId, SettingDefinition } from "@karya/types";
import type { SettingsService } from "./contracts";

export class InMemorySettingsService implements SettingsService {
  constructor(
    settings: SettingDefinition[] = [],
    private readonly repository: SettingsRepository = new InMemorySettingsRepository(settings),
  ) {}

  async listSettings(): Promise<SettingDefinition[]> {
    return this.repository.list();
  }
}

class InMemorySettingsRepository implements SettingsRepository {
  private readonly settings = new Map<EntityId, SettingDefinition>();

  constructor(seed: SettingDefinition[]) {
    seed.forEach((setting) => this.settings.set(setting.id, setting));
  }

  async list(): Promise<SettingDefinition[]> {
    return [...this.settings.values()];
  }

  async get(id: EntityId): Promise<SettingDefinition | undefined> {
    return this.settings.get(id);
  }

  async save(setting: SettingDefinition): Promise<void> {
    this.settings.set(setting.id, setting);
  }

  async delete(id: EntityId): Promise<void> {
    this.settings.delete(id);
  }
}
