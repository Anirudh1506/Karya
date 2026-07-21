import type { ShellApi } from "@karya/core";
import type { CaptureSession, EntityId } from "@karya/types";

type CaptureShell = Pick<ShellApi, "beginCapture" | "cancelCapture" | "completeCapture">;

export function beginCapture(shell: CaptureShell): Promise<CaptureSession> {
  return shell.beginCapture();
}

export async function completeCapture(shell: CaptureShell, captureId: EntityId, name: string): Promise<EntityId> {
  const resource = await shell.completeCapture(captureId, name.trim());
  return resource.id;
}

export function cancelCapture(shell: CaptureShell, captureId: EntityId): Promise<void> {
  return shell.cancelCapture(captureId);
}
