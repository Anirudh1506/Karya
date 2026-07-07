import type { CommandDefinition, EntityId, SearchDocument } from "@karya/types";

export interface CommandExecutionContext {
  execute<TResult = unknown>(command: unknown): Promise<TResult>;
  getSnapshot(): Promise<unknown>;
}

export type RegisteredCommandHandler = (context: CommandExecutionContext) => Promise<unknown>;

export interface RegisterCommandRequest extends CommandDefinition {
  handler?: RegisteredCommandHandler;
}

export interface CommandRegistry {
  register(command: RegisterCommandRequest): void;
  list(): Promise<CommandDefinition[]>;
  listSearchDocuments(): Promise<SearchDocument[]>;
  query(term: string): Promise<SearchDocument[]>;
  execute(commandId: EntityId, context: CommandExecutionContext): Promise<unknown>;
  pin(commandId: EntityId, pinned: boolean): Promise<CommandDefinition>;
  recent(limit?: number): Promise<CommandDefinition[]>;
  pinned(): Promise<CommandDefinition[]>;
}
