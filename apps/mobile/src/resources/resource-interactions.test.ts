import { describe, expect, it, vi } from "vitest";
import type { ShellApi } from "@karya/core";
import {
  archiveResource,
  createNoteResource,
  moveResource,
  openResource,
  renameResource,
  restoreResource,
} from "./resource-interactions";

describe("Mobile Resource interactions", () => {
  it("creates the initial Note type without content editing", async () => {
    const shell = { createNote: vi.fn().mockResolvedValue({ id: "resource-stable" }) } as unknown as ShellApi;
    expect(await createNoteResource(shell, " Research note ")).toBe("resource-stable");
    expect(shell.createNote).toHaveBeenCalledWith(undefined, "Research note", "");
  });

  it("routes lifecycle and move behavior only through Core", async () => {
    const shell = {
      openResource: vi.fn().mockResolvedValue({}),
      renameResource: vi.fn().mockResolvedValue({}),
      moveResource: vi.fn().mockResolvedValue({}),
      archiveResource: vi.fn().mockResolvedValue(undefined),
      restoreResource: vi.fn().mockResolvedValue({}),
    } as unknown as ShellApi;
    await openResource(shell, "resource-one");
    await renameResource(shell, "resource-one", " Renamed ");
    await moveResource(shell, "resource-one", "workspace-two");
    await archiveResource(shell, "resource-two");
    await restoreResource(shell, "resource-three");
    expect(shell.renameResource).toHaveBeenCalledWith("resource-one", "Renamed");
    expect(shell.moveResource).toHaveBeenCalledWith("resource-one", { workspaceId: "workspace-two" });
  });
});
