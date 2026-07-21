export interface AuthenticationStateBoundary {
  readonly status: "uninitialized" | "ready";
}

export interface ContextStateBoundary {
  readonly activeProfileId?: string;
  readonly activeWorkspaceId?: string;
}

export interface SynchronizationStateBoundary {
  readonly status: "uninitialized" | "offline" | "ready";
}

export interface ApplicationStateBoundary {
  readonly status: "booting" | "ready";
}
