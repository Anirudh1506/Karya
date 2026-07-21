import type { EntityId } from "./common";

export interface CommandDefinition {
  id: EntityId;
  title: string;
  description?: string;
  category?: "create" | "navigate" | "workspace" | "profile" | "resource" | "application" | "system" | "action";
  scope: "global" | "workspace" | "profile" | "resource" | "application";
  keywords: string[];
  shortcut?: string;
  pinned?: boolean;
  lastExecutedAt?: string;
  executionCount?: number;
}

export type SearchEntityType =
  "resource" | "event" | "notification" | "activity" | "profile" | "workspace" | "application" | "command" | "setting";

export interface SearchDocument {
  id: EntityId;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  keywords: string[];
  sourceId: EntityId;
  profileId?: EntityId;
  workspaceIds?: EntityId[];
  createdAt?: string;
  updatedAt?: string;
  lastOpenedAt?: string;
}

export type SearchMatchKind = "exact" | "prefix" | "word-boundary" | "contains";

export interface SearchMatch {
  field: "title" | "subtitle" | "keyword";
  kind: SearchMatchKind;
  start: number;
  length: number;
}

export interface SearchResult {
  document: SearchDocument;
  score: number;
  matches?: SearchMatch[];
}
