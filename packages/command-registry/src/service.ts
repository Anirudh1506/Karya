import type { EventBus } from "@karya/event-bus";
import type { CommandDefinition, EntityId, SearchDocument } from "@karya/types";
import type { CommandExecutionContext, CommandRegistry, RegisterCommandRequest, RegisteredCommandHandler } from "./contracts";

interface CommandRecord {
  definition: CommandDefinition;
  handler?: RegisteredCommandHandler;
}

export class InMemoryCommandRegistry implements CommandRegistry {
  private readonly commands = new Map<EntityId, CommandRecord>();

  constructor(private readonly eventBus: EventBus) {}

  register(command: RegisterCommandRequest): void {
    this.commands.set(command.id, {
      definition: normalizeCommand(command),
      handler: command.handler,
    });
  }

  async list(): Promise<CommandDefinition[]> {
    return [...this.commands.values()].map((record) => ({ ...record.definition })).sort(compareCommands);
  }

  async listSearchDocuments(): Promise<SearchDocument[]> {
    return (await this.list()).map(commandToSearchDocument);
  }

  async query(term: string): Promise<SearchDocument[]> {
    const normalizedTerm = term.trim().toLocaleLowerCase();
    if (!normalizedTerm) return this.listSearchDocuments();
    return (await this.listSearchDocuments()).filter((document) =>
      [document.title, document.subtitle ?? "", ...document.keywords].join(" ").toLocaleLowerCase().includes(normalizedTerm),
    );
  }

  async execute(commandId: EntityId, context: CommandExecutionContext): Promise<unknown> {
    const record = this.commands.get(commandId);
    if (!record) throw new Error(`Command is not registered: ${commandId}`);
    if (!record.handler) throw new Error(`Command does not have an execution handler: ${commandId}`);
    const result = await record.handler(context);
    const now = new Date().toISOString();
    record.definition = {
      ...record.definition,
      lastExecutedAt: now,
      executionCount: (record.definition.executionCount ?? 0) + 1,
    };
    await this.eventBus.publish("command:executed", { commandId, commandType: "palette" });
    return result;
  }

  async pin(commandId: EntityId, pinned: boolean): Promise<CommandDefinition> {
    const record = this.commands.get(commandId);
    if (!record) throw new Error(`Command is not registered: ${commandId}`);
    record.definition = { ...record.definition, pinned };
    return { ...record.definition };
  }

  async recent(limit = 8): Promise<CommandDefinition[]> {
    return (await this.list())
      .filter((command) => command.lastExecutedAt)
      .sort((left, right) => (right.lastExecutedAt ?? "").localeCompare(left.lastExecutedAt ?? ""))
      .slice(0, limit);
  }

  async pinned(): Promise<CommandDefinition[]> {
    return (await this.list()).filter((command) => command.pinned);
  }
}

export function commandToSearchDocument(command: CommandDefinition): SearchDocument {
  return {
    id: `command:${command.id}`,
    type: "command",
    title: command.title,
    subtitle: command.description ?? command.category ?? "Command",
    keywords: [
      command.id,
      command.category ?? "",
      command.scope,
      command.shortcut ?? "",
      command.pinned ? "pinned favorite" : "",
      command.lastExecutedAt ? "recent" : "",
      ...command.keywords,
    ].filter(Boolean),
    sourceId: command.id,
  };
}

function normalizeCommand(command: RegisterCommandRequest): CommandDefinition {
  return {
    id: command.id,
    title: command.title,
    description: command.description,
    category: command.category ?? "system",
    scope: command.scope,
    keywords: command.keywords,
    shortcut: command.shortcut,
    pinned: command.pinned ?? false,
    lastExecutedAt: command.lastExecutedAt,
    executionCount: command.executionCount ?? 0,
  };
}

function compareCommands(left: CommandDefinition, right: CommandDefinition): number {
  if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
  const recent = (right.lastExecutedAt ?? "").localeCompare(left.lastExecutedAt ?? "");
  if (recent !== 0) return recent;
  return left.title.localeCompare(right.title);
}
