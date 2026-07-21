import type { KaryaEventMap, KaryaEventName } from "@karya/types";
import type { ContentStore } from "@karya/content-store";
import type { MetadataUnitOfWork } from "@karya/persistence";
import type { PlatformProviders } from "@karya/platform";
import type { TransactionalEventBus } from "@karya/event-bus";
import type { KaryaCommand } from "./contracts";
import type { ServiceRegistry } from "./service-registry";

export type CommandHandler<TCommand extends KaryaCommand = KaryaCommand> = (
  command: TCommand,
  context: KernelCommandContext,
) => Promise<unknown>;

export interface KernelCommandContext {
  registry: ServiceRegistry;
  contentStore?: ContentStore;
  eventBus?: TransactionalEventBus;
  platform?: PlatformProviders;
  unitOfWork?: MetadataUnitOfWork;
  afterCommit(operation: () => Promise<void>): void;
  afterRollback(operation: () => Promise<void>): void;
  publish<TEventName extends KaryaEventName>(eventName: TEventName, payload: KaryaEventMap[TEventName]): Promise<void>;
}

export class CommandBus {
  private readonly handlers = new Map<KaryaCommand["type"], CommandHandler>();
  private afterCommitHooks: Array<() => Promise<void>> = [];
  private afterRollbackHooks: Array<() => Promise<void>> = [];

  constructor(context: Omit<KernelCommandContext, "afterCommit" | "afterRollback">) {
    this.context = {
      ...context,
      afterCommit: (operation) => {
        this.afterCommitHooks.push(operation);
      },
      afterRollback: (operation) => {
        this.afterRollbackHooks.push(operation);
      },
    };
  }

  private readonly context: KernelCommandContext;

  register<TType extends KaryaCommand["type"]>(
    type: TType,
    handler: CommandHandler<Extract<KaryaCommand, { type: TType }>>,
  ): void {
    this.handlers.set(type, handler as CommandHandler);
  }

  getContext(): KernelCommandContext {
    return this.context;
  }

  async execute<TResult = unknown>(command: KaryaCommand): Promise<TResult> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`Command handler is not registered: ${command.type}`);
    }

    try {
      const result = await this.executeInUnitOfWork(() => handler(command, this.context));
      await this.context.publish("command:executed", {
        commandId: command.id,
        commandType: command.type,
      });
      return result as TResult;
    } catch (error) {
      await this.context.publish("command:failed", {
        commandId: command.id,
        commandType: command.type,
        message: error instanceof Error ? error.message : "Unknown command failure",
      });
      throw error;
    }
  }

  private async executeInUnitOfWork<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
    this.afterCommitHooks = [];
    this.afterRollbackHooks = [];

    if (!this.context.unitOfWork) {
      try {
        const result = await operation();
        await this.runAfterCommitHooks();
        return result;
      } catch (error) {
        await this.runAfterRollbackHooks();
        throw error;
      }
    }

    this.context.eventBus?.beginTransaction();
    try {
      const result = await this.context.unitOfWork.transaction(operation);
      await this.runAfterCommitHooks();
      await this.context.eventBus?.commitTransaction();
      return result;
    } catch (error) {
      this.context.eventBus?.rollbackTransaction();
      await this.runAfterRollbackHooks();
      throw error;
    } finally {
      this.afterCommitHooks = [];
      this.afterRollbackHooks = [];
    }
  }

  private async runAfterCommitHooks(): Promise<void> {
    for (const hook of this.afterCommitHooks) {
      await hook();
    }
  }

  private async runAfterRollbackHooks(): Promise<void> {
    for (const hook of this.afterRollbackHooks.reverse()) {
      await hook();
    }
  }
}
