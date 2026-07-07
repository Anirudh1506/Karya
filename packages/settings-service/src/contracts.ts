import type { SettingDefinition } from "@karya/types";

export interface SettingsService {
  listSettings(): Promise<SettingDefinition[]>;
}
