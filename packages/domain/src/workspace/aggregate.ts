import { DomainRuleViolation, Identifier, Label, Timestamp } from "../common";
import type {
  ApplicationId,
  CreateWorkspaceRequest,
  ResourceId,
  UserId,
  WorkspaceDomainEvent,
  WorkspaceLayout,
  WorkspaceLaunchSet,
  WorkspaceLifecycle,
  WorkspaceProps,
} from "./types";
import { cloneLaunchSet, cloneSession, createSession, createWorkspaceLayout, normalizeProps } from "./utils";

export class Workspace {
  private readonly events: WorkspaceDomainEvent[] = [];

  private constructor(private props: WorkspaceProps) {
    this.assertInvariants();
  }

  static create(props: WorkspaceProps): Workspace {
    const workspace = new Workspace(normalizeProps(props));
    workspace.record("WorkspaceCreated", { workspaceId: props.id }, props.createdAt);
    return workspace;
  }

  static rehydrate(props: WorkspaceProps): Workspace {
    return new Workspace(normalizeProps(props));
  }

  static createFromRequest(request: CreateWorkspaceRequest): Workspace {
    const occurredAt = Timestamp.from(request.occurredAt);
    const actorId = request.createdBy ? Identifier.from(request.createdBy, "UserId") : undefined;
    const layout = createWorkspaceLayout(request.layout);

    return Workspace.create({
      id: Identifier.from(request.id, "WorkspaceId"),
      name: Label.from(request.name).value,
      metadata: {
        name: Label.from(request.name).value,
        description: request.description?.trim() || undefined,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        createdBy: actorId,
        updatedBy: actorId,
        templateId: request.templateId ? Identifier.from(request.templateId, "WorkspaceTemplateId") : undefined,
      },
      profileId: Identifier.from(request.profileId, "ProfileId"),
      owner: Identifier.from(request.owner, "OwnerId"),
      resourceRefs: [],
      pinnedApplicationIds: [],
      activeSession: createSession(Identifier.from(request.id, "WorkspaceId"), occurredAt, layout),
      lifecycle: "open",
      state: "open",
      pinned: false,
      favorite: false,
      permissions: { ownerCanEdit: true, sharedWith: [] },
      createdAt: occurredAt,
      updatedAt: occurredAt,
      lastOpenedAt: occurredAt,
    });
  }

  open(occurredAt: Timestamp, sessionId: Identifier): Workspace {
    this.assertTransition("open");
    const session = {
      ...(this.props.preservedSession ?? createSession(this.props.id, occurredAt, this.props.activeSession?.layout)),
      id: sessionId,
      workspaceId: this.props.id,
      openedAt: occurredAt,
      lastActiveAt: occurredAt,
      closedAt: undefined,
    };

    this.props = {
      ...this.props,
      activeSession: session,
      preservedSession: undefined,
      lifecycle: "open",
      state: "open",
      updatedAt: occurredAt,
      lastOpenedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceOpened", { workspaceId: this.props.id, sessionId }, occurredAt);
    return this;
  }

  close(occurredAt: Timestamp): Workspace {
    this.assertMutable("close");
    if (this.props.lifecycle === "closed") return this;
    const preservedSession = this.props.activeSession
      ? { ...this.props.activeSession, closedAt: occurredAt, lastActiveAt: occurredAt }
      : this.props.preservedSession;

    this.props = {
      ...this.props,
      activeSession: undefined,
      preservedSession,
      lifecycle: "closed",
      state: "closed",
      updatedAt: occurredAt,
      lastClosedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceClosed", { workspaceId: this.props.id, sessionId: preservedSession?.id }, occurredAt);
    return this;
  }

  rename(name: string, occurredAt: Timestamp, actorId?: UserId): Workspace {
    this.assertMutable("rename");
    const nextName = Label.from(name).value;
    if (nextName === this.props.name) return this;
    this.props = {
      ...this.props,
      name: nextName,
      metadata: {
        ...this.props.metadata,
        name: nextName,
        updatedAt: occurredAt,
        updatedBy: actorId ?? this.props.metadata.updatedBy,
      },
      updatedAt: occurredAt,
    };
    this.record("WorkspaceRenamed", { workspaceId: this.props.id, name: nextName }, occurredAt);
    return this;
  }

  archive(occurredAt: Timestamp): Workspace {
    this.assertTransition("archived");
    this.props = {
      ...this.props,
      activeSession: undefined,
      preservedSession: this.props.activeSession
        ? { ...this.props.activeSession, closedAt: occurredAt, lastActiveAt: occurredAt }
        : this.props.preservedSession,
      lifecycle: "archived",
      state: "archived",
      archivedAt: occurredAt,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceArchived", { workspaceId: this.props.id }, occurredAt);
    return this;
  }

  restore(occurredAt: Timestamp, sessionId: Identifier): Workspace {
    this.assertTransition("open");
    this.props = {
      ...this.props,
      archivedAt: undefined,
      restoredAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.open(occurredAt, sessionId);
    this.record("WorkspaceRestored", { workspaceId: this.props.id }, occurredAt);
    return this;
  }

  delete(occurredAt: Timestamp): Workspace {
    this.assertTransition("deleted");
    this.props = {
      ...this.props,
      activeSession: undefined,
      lifecycle: "deleted",
      state: "deleted",
      deletedAt: occurredAt,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceDeleted", { workspaceId: this.props.id }, occurredAt);
    return this;
  }

  pin(occurredAt: Timestamp): Workspace {
    return this.setPinned(true, occurredAt);
  }

  unpin(occurredAt: Timestamp): Workspace {
    return this.setPinned(false, occurredAt);
  }

  favorite(occurredAt: Timestamp): Workspace {
    return this.setFavorite(true, occurredAt);
  }

  unfavorite(occurredAt: Timestamp): Workspace {
    return this.setFavorite(false, occurredAt);
  }

  addResourceReference(resourceId: ResourceId, occurredAt: Timestamp): Workspace {
    this.assertMutable("add resource references");
    if (this.props.resourceRefs.some((ref) => ref.equals(resourceId))) return this;
    this.props = {
      ...this.props,
      resourceRefs: [...this.props.resourceRefs, resourceId],
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceResourceReferenceAdded", { workspaceId: this.props.id, resourceId }, occurredAt);
    return this;
  }

  removeResourceReference(resourceId: ResourceId, occurredAt: Timestamp): Workspace {
    this.assertMutable("remove resource references");
    if (!this.props.resourceRefs.some((ref) => ref.equals(resourceId))) return this;
    this.props = {
      ...this.props,
      resourceRefs: this.props.resourceRefs.filter((ref) => !ref.equals(resourceId)),
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceResourceReferenceRemoved", { workspaceId: this.props.id, resourceId }, occurredAt);
    return this;
  }

  updateLayout(layout: Partial<WorkspaceLayout>, occurredAt: Timestamp): Workspace {
    this.assertMutable("update layout");
    const nextLayout = createWorkspaceLayout({ ...(this.props.activeSession?.layout ?? {}), ...layout });
    const activeSession = this.props.activeSession
      ? { ...this.props.activeSession, layout: nextLayout, lastActiveAt: occurredAt }
      : undefined;
    this.props = {
      ...this.props,
      activeSession,
      preservedSession: activeSession ? this.props.preservedSession : this.props.preservedSession
        ? { ...this.props.preservedSession, layout: nextLayout }
        : undefined,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceLayoutUpdated", { workspaceId: this.props.id }, occurredAt);
    return this;
  }

  updateLaunchSet(launchSet: WorkspaceLaunchSet | undefined, occurredAt: Timestamp): Workspace {
    this.assertMutable("update launch set");
    this.props = {
      ...this.props,
      launchSet,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceLaunchSetUpdated", { workspaceId: this.props.id }, occurredAt);
    return this;
  }

  pinApplication(applicationId: ApplicationId, occurredAt: Timestamp): Workspace {
    this.assertMutable("pin applications");
    if (this.props.pinnedApplicationIds.some((id) => id.equals(applicationId))) return this;
    this.props = {
      ...this.props,
      pinnedApplicationIds: [...this.props.pinnedApplicationIds, applicationId],
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceApplicationPinned", { workspaceId: this.props.id, applicationId }, occurredAt);
    return this;
  }

  unpinApplication(applicationId: ApplicationId, occurredAt: Timestamp): Workspace {
    this.assertMutable("unpin applications");
    if (!this.props.pinnedApplicationIds.some((id) => id.equals(applicationId))) return this;
    this.props = {
      ...this.props,
      pinnedApplicationIds: this.props.pinnedApplicationIds.filter((id) => !id.equals(applicationId)),
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceApplicationUnpinned", { workspaceId: this.props.id, applicationId }, occurredAt);
    return this;
  }

  pullEvents(): WorkspaceDomainEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }

  toSnapshot(): WorkspaceProps {
    return {
      ...this.props,
      metadata: { ...this.props.metadata },
      resourceRefs: [...this.props.resourceRefs],
      pinnedApplicationIds: [...this.props.pinnedApplicationIds],
      launchSet: this.props.launchSet ? cloneLaunchSet(this.props.launchSet) : undefined,
      activeSession: this.props.activeSession ? cloneSession(this.props.activeSession) : undefined,
      preservedSession: this.props.preservedSession ? cloneSession(this.props.preservedSession) : undefined,
      permissions: {
        ...this.props.permissions,
        sharedWith: [...this.props.permissions.sharedWith],
      },
    };
  }

  private setPinned(pinned: boolean, occurredAt: Timestamp): Workspace {
    this.assertMutable("update pinned state");
    if (this.props.pinned === pinned) return this;
    this.props = {
      ...this.props,
      pinned,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspacePinned", { workspaceId: this.props.id, pinned }, occurredAt);
    return this;
  }

  private setFavorite(favorite: boolean, occurredAt: Timestamp): Workspace {
    this.assertMutable("update favorite state");
    if (this.props.favorite === favorite) return this;
    this.props = {
      ...this.props,
      favorite,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceFavorited", { workspaceId: this.props.id, favorite }, occurredAt);
    return this;
  }

  private assertTransition(next: WorkspaceLifecycle): void {
    const allowed: Record<WorkspaceLifecycle, WorkspaceLifecycle[]> = {
      draft: ["open", "archived", "deleted"],
      open: ["closed", "archived", "deleted"],
      closed: ["open", "archived", "deleted"],
      archived: ["open", "deleted"],
      deleted: [],
    };
    if (this.props.lifecycle === next) return;
    if (!allowed[this.props.lifecycle].includes(next)) {
      throw new DomainRuleViolation(`Invalid workspace lifecycle transition: ${this.props.lifecycle} -> ${next}`);
    }
  }

  private assertMutable(action: string): void {
    if (this.props.lifecycle === "deleted") {
      throw new DomainRuleViolation(`Deleted workspaces cannot ${action}`);
    }
  }

  private record<TName extends WorkspaceDomainEvent["name"]>(
    name: TName,
    payload: Extract<WorkspaceDomainEvent, { name: TName }>["payload"],
    occurredAt: Timestamp,
  ): void {
    this.events.push({ name, payload, occurredAt } as WorkspaceDomainEvent);
  }

  private assertInvariants(): void {
    if (!this.props.id || !this.props.profileId || !this.props.owner) {
      throw new DomainRuleViolation("A workspace requires an id, profile, and owner");
    }
    if (!this.props.name.trim() || !this.props.metadata.name.trim()) {
      throw new DomainRuleViolation("Workspace name cannot be empty");
    }
    if (this.props.state !== this.props.lifecycle) {
      throw new DomainRuleViolation("Workspace state and lifecycle must match");
    }
    if (!this.props.permissions.ownerCanEdit) {
      throw new DomainRuleViolation("The workspace owner must retain edit permission");
    }
    if (this.props.activeSession && !this.props.activeSession.workspaceId.equals(this.props.id)) {
      throw new DomainRuleViolation("Workspace active session must belong to the workspace");
    }
  }
}
