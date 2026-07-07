import { DomainRuleViolation, Identifier, Timestamp } from "../common";
import type { ResumeContext } from "../continuity";

export type SessionId = Identifier;
export type ProfileId = Identifier;
export type WorkspaceId = Identifier;
export type ResourceId = Identifier;

export interface SessionProps {
  id: SessionId;
  activeProfileId: ProfileId;
  activeWorkspaceId?: WorkspaceId;
  recentResourceIds: ResourceId[];
  resumeContext?: ResumeContext;
  startedAt: Timestamp;
  updatedAt: Timestamp;
}

export class Session {
  private constructor(private props: SessionProps) {
    if (!props.activeProfileId) {
      throw new DomainRuleViolation("A session requires an active profile");
    }
  }

  static start(props: SessionProps): Session {
    return new Session(props);
  }

  addRecentResource(resourceId: ResourceId, occurredAt: Timestamp): Session {
    this.props = {
      ...this.props,
      recentResourceIds: [
        resourceId,
        ...this.props.recentResourceIds.filter((id) => !id.equals(resourceId)),
      ].slice(0, 8),
      updatedAt: occurredAt,
    };
    return this;
  }

  toSnapshot(): SessionProps {
    return {
      ...this.props,
      recentResourceIds: [...this.props.recentResourceIds],
      resumeContext: this.props.resumeContext
        ? { ...this.props.resumeContext, resourceIds: [...this.props.resumeContext.resourceIds] }
        : undefined,
    };
  }
}
