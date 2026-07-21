import type { EventBus } from "@karya/event-bus";
import type { ProfileService } from "@karya/profile-service";
import type { ResourceService } from "@karya/resource-service";
import type { CaptureResourceKind, CaptureSession, CompleteCaptureInput, EntityId, Resource } from "@karya/types";
import type { WorkspaceService } from "@karya/workspace-service";
import { CaptureContextError, type CaptureService } from "./contracts";

export class DefaultCaptureService implements CaptureService {
  private readonly sessions = new Map<EntityId, CaptureSession>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly profiles: ProfileService,
    private readonly workspaces: WorkspaceService,
    private readonly resources: ResourceService,
  ) {}

  async begin(kind: CaptureResourceKind = "note"): Promise<CaptureSession> {
    const attemptedAt = new Date().toISOString();
    let profile: Awaited<ReturnType<ProfileService["getActiveProfile"]>> | undefined;
    let workspace: Awaited<ReturnType<WorkspaceService["getActiveWorkspace"]>>;
    try {
      [profile, workspace] = await Promise.all([
        this.profiles.getActiveProfile(),
        this.workspaces.getActiveWorkspace(),
      ]);
      if (!profile) throw new CaptureContextError("Quick Capture requires an active Profile.");
      if (!workspace || workspace.lifecycleState === "archived" || workspace.lifecycleState === "deleted") {
        throw new CaptureContextError();
      }
      if (workspace.profileId !== profile.id) {
        throw new CaptureContextError("The active Workspace does not belong to the active Profile.");
      }
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "Quick Capture requires an active Workspace.";
      await this.eventBus.publish("CaptureFailed", { attemptedAt, reason, profileId: profile?.id });
      throw cause;
    }
    if (!profile) throw new CaptureContextError();
    const capture: CaptureSession = {
      id: crypto.randomUUID(),
      kind,
      profileId: profile.id,
      workspaceId: workspace.id,
      startedAt: attemptedAt,
    };
    this.sessions.set(capture.id, capture);
    await this.eventBus.publish("CaptureStarted", { capture });
    return capture;
  }

  async complete(input: CompleteCaptureInput): Promise<Resource> {
    const capture = this.requireSession(input.captureId);
    const name = input.name.trim();
    if (!name) throw new Error("Capture name is required.");
    await this.validateCurrentContext(capture);
    const profile = await this.profiles.getActiveProfile();
    if (!profile) throw new CaptureContextError("Quick Capture requires an active Profile.");
    const resource = await this.resources.create({
      displayTitle: name,
      description: "",
      type: "text/markdown",
      owner: capture.profileId,
      profileId: capture.profileId,
      workspaceRefs: [capture.workspaceId],
      primaryWorkspaceId: capture.workspaceId,
      defaultSpace: capture.workspaceId === profile.defaultSpaceId ? "profile" : "none",
      metadata: { kind: capture.kind, attributes: { captureId: capture.id, captureSource: "quick-capture" } },
      tags: [capture.kind, "captured"],
    });
    this.sessions.delete(capture.id);
    await this.eventBus.publish("CaptureCompleted", { capture, resource });
    return resource;
  }

  async cancel(captureId: EntityId): Promise<void> {
    const capture = this.sessions.get(captureId);
    if (!capture) return;
    this.sessions.delete(captureId);
    await this.eventBus.publish("CaptureCancelled", { capture });
  }

  private requireSession(captureId: EntityId): CaptureSession {
    const capture = this.sessions.get(captureId);
    if (!capture) throw new Error(`Capture is not active: ${captureId}`);
    return capture;
  }

  private async validateCurrentContext(capture: CaptureSession): Promise<void> {
    const [profile, workspace] = await Promise.all([
      this.profiles.getActiveProfile(),
      this.workspaces.getActiveWorkspace(),
    ]);
    if (
      !profile ||
      profile.id !== capture.profileId ||
      workspace?.id !== capture.workspaceId ||
      workspace.lifecycleState === "archived" ||
      workspace.lifecycleState === "deleted"
    ) {
      throw new CaptureContextError("The active context changed. Open Quick Capture again to continue.");
    }
  }
}
