import type { EntityId } from "./common";

export type AutosaveState = "idle" | "scheduled" | "saving" | "saved" | "failed";

export interface EditableResourceContent {
  id: EntityId;
  resourceId: EntityId;
  text: string;
  format: "plain-text";
  encoding: "utf-8";
  revision: number;
  updatedAt: string;
}

export interface EditSelection {
  start: number;
  end: number;
}

export interface EditSession {
  id: EntityId;
  resourceId: EntityId;
  openedAt: string;
  lastEditedAt?: string;
  closedAt?: string;
  dirty: boolean;
  autosaveState: AutosaveState;
  status: "open" | "closed";
  cursorPosition?: number;
  selection?: EditSelection;
}

export interface EditCheckpoint {
  id: EntityId;
  resourceId: EntityId;
  sessionId: EntityId;
  kind: "first-edit" | "session-end";
  text: string;
  revision: number;
  createdAt: string;
}
