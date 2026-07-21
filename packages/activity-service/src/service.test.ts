import { describe, expect, it } from "vitest";
import { InMemoryEventBus } from "@karya/event-bus";
import { InMemoryActivityService } from "./service";

describe("Activity Timeline Engine", () => {
  it("records immutable, deterministically ordered entries and filters inside Core", async () => {
    const service = new InMemoryActivityService(new InMemoryEventBus(), [], undefined, { queryLimit: 100 });
    const base = {
      category: "resource" as const,
      object: { id: "resource-1", type: "resource" as const, title: "Plan" },
      profileId: "profile-1",
      workspaceId: "workspace-1",
      source: "resources",
    };
    const created = await service.record({
      ...base,
      eventType: "ResourceCreated",
      verb: "created",
      title: "Created Plan",
      occurredAt: "2026-07-12T10:00:00.000Z",
    });
    const renamed = await service.record({
      ...base,
      eventType: "ResourceRenamed",
      verb: "renamed",
      title: "Renamed Plan",
      occurredAt: "2026-07-12T11:00:00.000Z",
    });

    expect((await service.recent()).map((activity) => activity.id)).toEqual([renamed.id, created.id]);
    expect(await service.byProfile("profile-1")).toHaveLength(2);
    expect(await service.byWorkspace("workspace-1")).toHaveLength(2);
    expect(await service.byResource("resource-1")).toHaveLength(2);
    expect((await service.byEventType("ResourceRenamed"))[0]?.id).toBe(renamed.id);
    expect((await service.latest())?.id).toBe(renamed.id);
    expect(service.getRetentionPolicy()).toEqual({ mode: "retain-all", queryLimit: 100 });
  });
});
