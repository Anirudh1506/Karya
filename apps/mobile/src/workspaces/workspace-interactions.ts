import type { ShellApi } from "@karya/core";
import type { EntityId } from "@karya/types";

type WorkspaceShell = Pick<ShellApi, "archiveWorkspace" | "createWorkspace" | "openWorkspace" | "restoreWorkspace">;

export async function createWorkspace(
  shell: WorkspaceShell,
  input: { name: string; description?: string; icon?: string; color?: string },
): Promise<EntityId> {
  const workspace = await shell.createWorkspace(input.name.trim(), input.description?.trim() || undefined, undefined, {
    icon: input.icon?.trim() || undefined,
    color: input.color,
  });
  return workspace.id;
}

export function activateWorkspace(shell: WorkspaceShell, workspaceId: EntityId) {
  return shell.openWorkspace(workspaceId);
}

export function archiveWorkspace(shell: WorkspaceShell, workspaceId: EntityId) {
  return shell.archiveWorkspace(workspaceId);
}

export function restoreWorkspace(shell: WorkspaceShell, workspaceId: EntityId) {
  return shell.restoreWorkspace(workspaceId);
}
