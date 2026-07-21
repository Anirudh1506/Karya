import { describe, expect, it, vi } from "vitest";
import type { ShellApi } from "@karya/core";
import { activateWorkspace, archiveWorkspace, createWorkspace, restoreWorkspace } from "./workspace-interactions";

describe("Mobile workspace interactions", () => {
  it("creates a real Core workspace with optional presentation metadata", async () => {
    const shell = { createWorkspace: vi.fn().mockResolvedValue({ id: "workspace-new" }) } as unknown as ShellApi;
    const id = await createWorkspace(shell, {
      name: " Research ",
      description: " Papers ",
      icon: " R ",
      color: "#7C3AED",
    });
    expect(id).toBe("workspace-new");
    expect(shell.createWorkspace).toHaveBeenCalledWith("Research", "Papers", undefined, {
      icon: "R",
      color: "#7C3AED",
    });
  });

  it("routes activation, archive, and restoration only through Core", async () => {
    const shell = {
      openWorkspace: vi.fn().mockResolvedValue({}),
      archiveWorkspace: vi.fn().mockResolvedValue({}),
      restoreWorkspace: vi.fn().mockResolvedValue({}),
    } as unknown as ShellApi;
    await activateWorkspace(shell, "workspace-one");
    await archiveWorkspace(shell, "workspace-two");
    await restoreWorkspace(shell, "workspace-three");
    expect(shell.openWorkspace).toHaveBeenCalledWith("workspace-one");
    expect(shell.archiveWorkspace).toHaveBeenCalledWith("workspace-two");
    expect(shell.restoreWorkspace).toHaveBeenCalledWith("workspace-three");
  });
});
