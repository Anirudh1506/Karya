import type { ShellApi } from "@karya/core";
import type { EntityId } from "@karya/types";

type ResourceShell = Pick<
  ShellApi,
  "archiveResource" | "createNote" | "moveResource" | "openResource" | "renameResource" | "restoreResource"
>;

export async function createNoteResource(shell: ResourceShell, name: string): Promise<EntityId> {
  const resource = await shell.createNote(undefined, name.trim(), "");
  return resource.id;
}

export function openResource(shell: ResourceShell, resourceId: EntityId) {
  return shell.openResource(resourceId);
}
export function renameResource(shell: ResourceShell, resourceId: EntityId, name: string) {
  return shell.renameResource(resourceId, name.trim());
}
export function moveResource(shell: ResourceShell, resourceId: EntityId, workspaceId: EntityId) {
  return shell.moveResource(resourceId, { workspaceId });
}
export function archiveResource(shell: ResourceShell, resourceId: EntityId) {
  return shell.archiveResource(resourceId);
}
export function restoreResource(shell: ResourceShell, resourceId: EntityId) {
  return shell.restoreResource(resourceId);
}
