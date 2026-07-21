import type { KaryaEventMap, KaryaEventName } from "@karya/types";
import type { EventBus, EventHandler, LifecycleEventBus, TransactionalEventBus } from "./contracts";

export class InMemoryEventBus implements EventBus, TransactionalEventBus, LifecycleEventBus {
  private readonly handlers = new Map<
    KaryaEventName,
    Set<(payload: KaryaEventMap[KaryaEventName]) => void | Promise<void>>
  >();
  private bufferedEvents: Array<{
    eventName: KaryaEventName;
    payload: KaryaEventMap[KaryaEventName];
  }> = [];
  private transactionDepth = 0;
  private started: boolean;
  private lifecycleEvents: Array<{
    eventName: KaryaEventName;
    payload: KaryaEventMap[KaryaEventName];
  }> = [];

  constructor(started = true) {
    this.started = started;
  }

  async publish<TEventName extends KaryaEventName>(
    eventName: TEventName,
    payload: KaryaEventMap[TEventName],
  ): Promise<void> {
    if (!this.started) {
      this.lifecycleEvents.push({ eventName, payload });
      return;
    }
    if (this.transactionDepth > 0) {
      this.bufferedEvents.push({ eventName, payload });
      return;
    }

    await this.publishNow(eventName, payload);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const events = this.lifecycleEvents;
    this.lifecycleEvents = [];
    for (const event of events) {
      await this.publishNow(event.eventName, event.payload);
    }
  }

  async stop(): Promise<void> {
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }

  beginTransaction(): void {
    this.transactionDepth += 1;
  }

  async commitTransaction(): Promise<void> {
    if (this.transactionDepth === 0) return;

    this.transactionDepth -= 1;
    if (this.transactionDepth > 0) return;

    const events = this.bufferedEvents;
    this.bufferedEvents = [];

    for (const event of events) {
      await this.publishNow(event.eventName, event.payload);
    }
  }

  rollbackTransaction(): void {
    if (this.transactionDepth === 0) return;

    this.transactionDepth = 0;
    this.bufferedEvents = [];
  }

  private async publishNow<TEventName extends KaryaEventName>(
    eventName: TEventName,
    payload: KaryaEventMap[TEventName],
  ): Promise<void> {
    const handlers = this.handlers.get(eventName) ?? new Set();
    await Promise.all([...handlers].map((handler) => handler(payload)));
  }

  subscribe<TEventName extends KaryaEventName>(eventName: TEventName, handler: EventHandler<TEventName>): () => void {
    const handlers = this.handlers.get(eventName) ?? new Set();
    handlers.add(handler as (payload: KaryaEventMap[KaryaEventName]) => void | Promise<void>);
    this.handlers.set(eventName, handlers);

    return () => {
      handlers.delete(handler as (payload: KaryaEventMap[KaryaEventName]) => void | Promise<void>);
    };
  }

  clear(): void {
    this.handlers.clear();
    this.bufferedEvents = [];
    this.transactionDepth = 0;
    this.lifecycleEvents = [];
    this.started = false;
  }
}
