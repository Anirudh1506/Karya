import type { ShellApi } from "@karya/core";
import type { EntityId } from "@karya/types";

type ProfileShell = Pick<ShellApi, "archiveProfile" | "createProfile" | "restoreProfile" | "switchProfile">;

export async function createAndActivateProfile(
  shell: ProfileShell,
  input: { name: string; icon?: string; accentColor?: string },
): Promise<EntityId> {
  const profile = await shell.createProfile(input.name.trim(), {
    icon: input.icon?.trim() || undefined,
    accentColor: input.accentColor,
  });
  return profile.id;
}

export function switchProfile(shell: ProfileShell, profileId: EntityId) {
  return shell.switchProfile(profileId);
}

export function archiveProfile(shell: ProfileShell, profileId: EntityId) {
  return shell.archiveProfile(profileId);
}

export function restoreProfile(shell: ProfileShell, profileId: EntityId) {
  return shell.restoreProfile(profileId);
}
