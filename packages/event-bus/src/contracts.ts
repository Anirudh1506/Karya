import type { KaryaEventMap, KaryaEventName } from "@karya/types";

export type EventHandler<TEventName extends KaryaEventName> = (
  payload: KaryaEventMap[TEventName],
) => void | Promise<void>;

export interface EventBus {
  publish<TEventName extends KaryaEventName>(eventName: TEventName, payload: KaryaEventMap[TEventName]): Promise<void>;
  subscribe<TEventName extends KaryaEventName>(eventName: TEventName, handler: EventHandler<TEventName>): () => void;
  clear(): void;
}

export interface TransactionalEventBus extends EventBus {
  beginTransaction(): void;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): void;
}

export interface LifecycleEventBus extends EventBus {
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): boolean;
}
