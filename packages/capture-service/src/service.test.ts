import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "@karya/event-bus";
import type { CreateResourceRequest } from "@karya/resource-service";
import { CaptureContextError } from "./contracts";
import { DefaultCaptureService } from "./service";

describe("DefaultCaptureService", () => {
  it("derives placement from context and publishes lifecycle events", async () => {
    const eventBus = new InMemoryEventBus();
    const events: string[] = [];
    eventBus.subscribe("CaptureStarted", () => {
      events.push("started");
    });
    eventBus.subscribe("CaptureCompleted", () => {
      events.push("completed");
    });
    const create = vi.fn(async (input: CreateResourceRequest) => ({
      ...input,
      id: "resource-1",
      tags: input.tags ?? [],
      relationships: [],
      status: "active" as const,
      lifecycleState: "active" as const,
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:00:00.000Z",
      metadata: {
        title: input.displayTitle ?? "Untitled",
        description: input.description ?? "",
        kind: "note",
        createdAt: "2026-07-12T00:00:00.000Z",
        updatedAt: "2026-07-12T00:00:00.000Z",
        attributes: input.metadata?.attributes ?? {},
      },
    }));
    const service = new DefaultCaptureService(
      eventBus,
      { getActiveProfile: vi.fn().mockResolvedValue({ id: "profile-1", defaultSpaceId: "workspace-1" }) } as never,
      {
        getActiveWorkspace: vi
          .fn()
          .mockResolvedValue({ id: "workspace-1", profileId: "profile-1", lifecycleState: "open" }),
      } as never,
      { create } as never,
    );

    const capture = await service.begin();
    const resource = await service.complete({ captureId: capture.id, name: "  Inbox thought  " });

    expect(events).toEqual(["started", "completed"]);
    expect(resource.metadata.title).toBe("Inbox thought");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "profile-1",
        primaryWorkspaceId: "workspace-1",
        workspaceRefs: ["workspace-1"],
        defaultSpace: "profile",
      }),
    );
  });

  it("rejects initiation without an active Workspace", async () => {
    const service = new DefaultCaptureService(
      new InMemoryEventBus(),
      { getActiveProfile: vi.fn().mockResolvedValue({ id: "profile-1" }) } as never,
      { getActiveWorkspace: vi.fn().mockResolvedValue(undefined) } as never,
      { create: vi.fn() } as never,
    );

    await expect(service.begin()).rejects.toBeInstanceOf(CaptureContextError);
  });
});
