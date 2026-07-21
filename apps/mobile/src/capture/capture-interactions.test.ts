import { describe, expect, it, vi } from "vitest";
import { beginCapture, cancelCapture, completeCapture } from "./capture-interactions";

describe("mobile Quick Capture interactions", () => {
  it("delegates the complete lifecycle to Core", async () => {
    const capture = {
      id: "capture-1",
      kind: "note" as const,
      profileId: "profile-1",
      workspaceId: "workspace-1",
      startedAt: "2026-07-12T00:00:00.000Z",
    };
    const shell = {
      beginCapture: vi.fn().mockResolvedValue(capture),
      completeCapture: vi.fn().mockResolvedValue({ id: "resource-1" }),
      cancelCapture: vi.fn().mockResolvedValue(undefined),
    };

    expect(await beginCapture(shell)).toEqual(capture);
    expect(await completeCapture(shell, capture.id, "  Captured note  ")).toBe("resource-1");
    expect(shell.completeCapture).toHaveBeenCalledWith(capture.id, "Captured note");
    await cancelCapture(shell, capture.id);
    expect(shell.cancelCapture).toHaveBeenCalledWith(capture.id);
  });
});
