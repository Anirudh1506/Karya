import type { ContinuitySession, EntityId, LayoutState, ResumeContext, WorkspaceActivityType, WorkspaceNavigationContext } from "@karya/types";

export interface ContinuityService {
  subscribeToEvents(): () => void;
  resumeContext(context: Omit<ResumeContext, "capturedAt">): Promise<ContinuitySession>;
  getCurrentSession(): Promise<ContinuitySession>;
  setActiveProfile(profileId: EntityId): Promise<ContinuitySession>;
  setActiveWorkspace(workspaceId: EntityId): Promise<ContinuitySession>;
  preserveWorkspaceSession(workspaceId: EntityId): Promise<ContinuitySession>;
  openWorkspaceSession(workspaceId: EntityId, profileId: EntityId): Promise<ContinuitySession>;
  resumeWorkspaceSession(workspaceId: EntityId, profileId: EntityId): Promise<ContinuitySession>;
  updateWorkspaceNavigation(context: WorkspaceNavigationContext & { profileId: EntityId }): Promise<ContinuitySession>;
  recordWorkspaceResourceActivity(input: { workspaceId?: EntityId; profileId: EntityId; resourceId: EntityId; title: string; type: WorkspaceActivityType }): Promise<ContinuitySession>;
  recordWorkspaceApplicationLaunch(input: { workspaceId?: EntityId; profileId: EntityId; applicationId: EntityId; title: string }): Promise<ContinuitySession>;
  addRecentResource(resourceId: EntityId): Promise<ContinuitySession>;
  removeRecentResource(resourceId: EntityId): Promise<ContinuitySession>;
  addRecentApplication(applicationId: EntityId): Promise<ContinuitySession>;
  captureResumeContext(context: Omit<ResumeContext, "capturedAt">): Promise<ContinuitySession>;
  persistLayout(layout: Partial<LayoutState>): Promise<ContinuitySession>;
}
