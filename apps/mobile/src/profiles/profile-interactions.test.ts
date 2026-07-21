import { describe, expect, it, vi } from "vitest";
import type { ShellApi } from "@karya/core";
import { archiveProfile, createAndActivateProfile, restoreProfile, switchProfile } from "./profile-interactions";

describe("Mobile profile interactions", () => {
  it("creates a Profile through the Core command that owns activation", async () => {
    const calls: string[] = [];
    const shell = {
      createProfile: vi.fn(async () => {
        calls.push("create");
        return { id: "profile-new" };
      }),
      switchProfile: vi.fn(async () => {
        calls.push("switch");
        return {};
      }),
    } as unknown as ShellApi;

    const id = await createAndActivateProfile(shell, { name: " Studio ", icon: " S ", accentColor: "#2563EB" });

    expect(id).toBe("profile-new");
    expect(calls).toEqual(["create"]);
    expect(shell.createProfile).toHaveBeenCalledWith("Studio", { icon: "S", accentColor: "#2563EB" });
  });

  it("routes switch, archive, and restore without client-side behavior", async () => {
    const shell = {
      switchProfile: vi.fn().mockResolvedValue({}),
      archiveProfile: vi.fn().mockResolvedValue({}),
      restoreProfile: vi.fn().mockResolvedValue({}),
    } as unknown as ShellApi;

    await switchProfile(shell, "profile-one");
    await archiveProfile(shell, "profile-two");
    await restoreProfile(shell, "profile-three");

    expect(shell.switchProfile).toHaveBeenCalledWith("profile-one");
    expect(shell.archiveProfile).toHaveBeenCalledWith("profile-two");
    expect(shell.restoreProfile).toHaveBeenCalledWith("profile-three");
  });
});
