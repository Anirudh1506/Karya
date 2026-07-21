import type { CaptureResourceKind, CaptureSession, CompleteCaptureInput, EntityId, Resource } from "@karya/types";

export interface CaptureService {
  begin(kind?: CaptureResourceKind): Promise<CaptureSession>;
  complete(input: CompleteCaptureInput): Promise<Resource>;
  cancel(captureId: EntityId): Promise<void>;
}

export class CaptureContextError extends Error {
  readonly code = "CAPTURE_CONTEXT_UNAVAILABLE";

  constructor(message = "Quick Capture requires an active Workspace.") {
    super(message);
    this.name = "CaptureContextError";
  }
}
