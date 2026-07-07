import type { EntityId } from "./common";

export interface SettingDefinition {
  id: EntityId;
  label: string;
  category: string;
  value: string | number | boolean;
  searchable: boolean;
}
