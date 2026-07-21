import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "./in-memory-event-bus";

describe("InMemoryEventBus lifecycle", () => {
  it("starts and stops idempotently while preserving events published during suspension", async () => {
    const eventBus = new InMemoryEventBus(false);
    const handler = vi.fn();
    eventBus.subscribe("SearchExecuted", handler);

    await eventBus.start();
    await eventBus.start();
    const result = {
      document: { id: "test", type: "resource" as const, title: "Test", keywords: [], sourceId: "test" },
      score: 1,
    };
    await eventBus.publish("SearchExecuted", { query: "running", result });
    await eventBus.stop();
    await eventBus.stop();
    await eventBus.publish("SearchExecuted", { query: "suspended", result });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(eventBus.isStarted()).toBe(false);

    await eventBus.start();

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenLastCalledWith({ query: "suspended", result });
    expect(eventBus.isStarted()).toBe(true);
  });
});
