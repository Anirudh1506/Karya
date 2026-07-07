import { DomainRuleViolation, Identifier, Label, Tag, type Timestamp } from "../common";
import type { DefaultSpacePlacement, OwnerId, ProfileId, Relationship, ResourceDomainEvent, ResourceLifecycle, ResourceMetadataPatch, ResourceProps, ResourceSnapshot, UserId, WorkspaceId } from "./types";
import { normalizeMetadataPatch, normalizeProps, normalizeRelationship, normalizeRelationshipType, uniqueByValue } from "./utils";

export class Resource {
  private readonly events: ResourceDomainEvent[] = [];

  private constructor(private props: ResourceProps) {
    this.assertInvariants();
  }

  static create(props: ResourceProps): Resource {
    const resource = new Resource(normalizeProps(props));
    resource.record("ResourceCreated", { resourceId: props.id }, props.createdAt);
    return resource;
  }

  static rehydrate(props: ResourceProps): Resource {
    return new Resource(normalizeProps(props));
  }

  rename(title: string, occurredAt: Timestamp, actorId?: UserId): Resource {
    this.assertMutable("rename");
    const nextTitle = Label.from(title).value;
    if (this.props.metadata.title === nextTitle) return this;

    this.props = {
      ...this.props,
      metadata: {
        ...this.props.metadata,
        title: nextTitle,
        updatedAt: occurredAt,
        updatedBy: actorId ?? this.props.metadata.updatedBy,
      },
      updatedAt: occurredAt,
    };
    this.record("ResourceRenamed", { resourceId: this.props.id, title: nextTitle }, occurredAt);
    return this;
  }

  addWorkspaceReference(workspaceId: WorkspaceId, occurredAt: Timestamp, makePrimary = false): Resource {
    this.assertMutable("link to workspaces");
    if (this.isReferencedBy(workspaceId)) {
      if (makePrimary) this.movePrimaryWorkspace(workspaceId, occurredAt);
      return this;
    }

    this.props = {
      ...this.props,
      workspaceRefs: [...this.props.workspaceRefs, workspaceId],
      primaryWorkspaceId: this.props.primaryWorkspaceId ?? workspaceId,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("WorkspaceReferenceAdded", { resourceId: this.props.id, workspaceId }, occurredAt);

    if (makePrimary) this.movePrimaryWorkspace(workspaceId, occurredAt);
    return this;
  }

  removeWorkspaceReference(workspaceId: WorkspaceId, occurredAt: Timestamp): Resource {
    this.assertMutable("unlink from workspaces");
    if (!this.isReferencedBy(workspaceId)) return this;

    const workspaceRefs = this.props.workspaceRefs.filter((ref) => !ref.equals(workspaceId));
    const removedPrimary = this.props.primaryWorkspaceId?.equals(workspaceId) ?? false;

    this.props = {
      ...this.props,
      workspaceRefs,
      primaryWorkspaceId: removedPrimary ? workspaceRefs[0] : this.props.primaryWorkspaceId,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.assertPlacementInvariant();
    this.record("WorkspaceReferenceRemoved", { resourceId: this.props.id, workspaceId }, occurredAt);
    return this;
  }

  movePrimaryWorkspace(workspaceId: WorkspaceId, occurredAt: Timestamp): Resource {
    this.assertMutable("move primary workspace");
    if (!this.isReferencedBy(workspaceId)) {
      throw new DomainRuleViolation("Primary workspace must already reference the resource");
    }
    if (this.props.primaryWorkspaceId?.equals(workspaceId)) return this;

    this.props = {
      ...this.props,
      primaryWorkspaceId: workspaceId,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("PrimaryWorkspaceMoved", { resourceId: this.props.id, workspaceId }, occurredAt);
    return this;
  }

  movePlacement(
    placement: {
      owner: OwnerId;
      profileId: ProfileId;
      workspaceRefs: WorkspaceId[];
      primaryWorkspaceId?: WorkspaceId;
      defaultSpace: DefaultSpacePlacement;
    },
    occurredAt: Timestamp,
  ): Resource {
    this.assertMutable("move placement");
    this.props = {
      ...this.props,
      ownership: {
        owner: placement.owner,
        profileId: placement.profileId,
      },
      workspaceRefs: uniqueByValue(placement.workspaceRefs),
      primaryWorkspaceId: placement.primaryWorkspaceId,
      defaultSpace: placement.defaultSpace,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.assertPlacementInvariant();
    this.record("PrimaryWorkspaceMoved", { resourceId: this.props.id, workspaceId: placement.primaryWorkspaceId }, occurredAt);
    return this;
  }

  isReferencedBy(workspaceId: WorkspaceId): boolean {
    return this.props.workspaceRefs.some((ref) => ref.equals(workspaceId));
  }

  archive(occurredAt: Timestamp): Resource {
    this.assertTransition("archived");
    this.props = this.withLifecycle("archived", occurredAt);
    this.record("ResourceArchived", { resourceId: this.props.id }, occurredAt);
    return this;
  }

  restore(occurredAt: Timestamp): Resource {
    this.assertTransition("active");
    this.props = this.withLifecycle("active", occurredAt);
    this.record("ResourceRestored", { resourceId: this.props.id }, occurredAt);
    return this;
  }

  delete(occurredAt: Timestamp): Resource {
    this.assertTransition("deleted");
    this.props = this.withLifecycle("deleted", occurredAt);
    this.record("ResourceDeleted", { resourceId: this.props.id }, occurredAt);
    return this;
  }

  updateMetadata(metadata: ResourceMetadataPatch, occurredAt: Timestamp): Resource {
    this.assertMutable("update metadata");
    const normalized = normalizeMetadataPatch(metadata);
    const keys = Object.keys(normalized);
    if (!keys.length) return this.touch(occurredAt);

    this.props = {
      ...this.props,
      metadata: {
        ...this.props.metadata,
        ...normalized,
        updatedAt: normalized.updatedAt ?? occurredAt,
      },
      updatedAt: occurredAt,
    };
    this.assertInvariants();
    this.record("MetadataUpdated", { resourceId: this.props.id, keys }, occurredAt);
    return this;
  }

  replaceTags(tags: Tag[], occurredAt: Timestamp): Resource {
    this.assertMutable("update tags");
    const uniqueTags = uniqueByValue(tags);
    const current = this.props.tags.map((tag) => tag.value).join(",");
    const next = uniqueTags.map((tag) => tag.value).join(",");
    if (current === next) return this;

    this.props = {
      ...this.props,
      tags: uniqueTags,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("TagsUpdated", { resourceId: this.props.id, tags: uniqueTags.map((tag) => tag.value) }, occurredAt);
    return this;
  }

  addRelationship(relationship: Relationship, occurredAt: Timestamp): Resource {
    this.assertMutable("add relationships");
    if (relationship.targetResourceId.equals(this.props.id)) {
      throw new DomainRuleViolation("A resource cannot relate to itself");
    }
    if (
      this.props.relationships.some(
        (existing) =>
          existing.targetResourceId.equals(relationship.targetResourceId) &&
          normalizeRelationshipType(existing.type) === normalizeRelationshipType(relationship.type),
      )
    ) {
      return this;
    }

    this.props = {
      ...this.props,
      relationships: [...this.props.relationships, normalizeRelationship(relationship)],
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record(
      "RelationshipAdded",
      {
        resourceId: this.props.id,
        targetResourceId: relationship.targetResourceId,
        relationshipType: relationship.type,
      },
      occurredAt,
    );
    return this;
  }

  removeRelationship(relationshipId: Identifier, occurredAt: Timestamp): Resource {
    this.assertMutable("remove relationships");
    if (!this.props.relationships.some((relationship) => relationship.id.equals(relationshipId))) {
      return this;
    }

    this.props = {
      ...this.props,
      relationships: this.props.relationships.filter((relationship) => !relationship.id.equals(relationshipId)),
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    this.record("RelationshipRemoved", { resourceId: this.props.id, relationshipId }, occurredAt);
    return this;
  }

  pullEvents(): ResourceDomainEvent[] {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }

  toSnapshot(): ResourceSnapshot {
    return {
      ...this.props,
      ownership: { ...this.props.ownership },
      workspaceRefs: [...this.props.workspaceRefs],
      tags: [...this.props.tags],
      relationships: this.props.relationships.map((relationship) => ({
        ...relationship,
        metadata: { ...relationship.metadata },
      })),
      permissions: {
        ...this.props.permissions,
        sharedWith: [...this.props.permissions.sharedWith],
      },
      versionInfo: { ...this.props.versionInfo },
      metadata: {
        ...this.props.metadata,
        attributes: { ...this.props.metadata.attributes },
      },
    };
  }

  private touch(occurredAt: Timestamp): Resource {
    this.props = {
      ...this.props,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
    return this;
  }

  private withLifecycle(lifecycle: ResourceLifecycle, occurredAt: Timestamp): ResourceProps {
    return {
      ...this.props,
      status: lifecycle,
      lifecycle,
      updatedAt: occurredAt,
      metadata: { ...this.props.metadata, updatedAt: occurredAt },
    };
  }

  private assertTransition(next: ResourceLifecycle): void {
    const allowed: Record<ResourceLifecycle, ResourceLifecycle[]> = {
      draft: ["active", "archived", "deleted"],
      active: ["archived", "deleted"],
      archived: ["active", "deleted"],
      deleted: [],
    };

    if (this.props.lifecycle === next) return;
    if (!allowed[this.props.lifecycle].includes(next)) {
      throw new DomainRuleViolation(`Invalid resource lifecycle transition: ${this.props.lifecycle} -> ${next}`);
    }
  }

  private assertMutable(action: string): void {
    if (this.props.lifecycle === "deleted") {
      throw new DomainRuleViolation(`Deleted resources cannot ${action}`);
    }
  }

  private record<TName extends ResourceDomainEvent["name"]>(
    name: TName,
    payload: Extract<ResourceDomainEvent, { name: TName }>["payload"],
    occurredAt: Timestamp,
  ): void {
    this.events.push({ name, payload, occurredAt } as ResourceDomainEvent);
  }

  private assertInvariants(): void {
    if (!this.props.id || !this.props.ownership.owner || !this.props.ownership.profileId) {
      throw new DomainRuleViolation("A resource requires an id, owner, and profile");
    }
    if (!this.props.type.trim()) {
      throw new DomainRuleViolation("A resource requires a type");
    }
    if (!this.props.metadata.title.trim()) {
      throw new DomainRuleViolation("A resource requires a display title");
    }
    if (this.props.status !== this.props.lifecycle) {
      throw new DomainRuleViolation("Resource status and lifecycle must match");
    }
    if (this.props.versionInfo.version < 1) {
      throw new DomainRuleViolation("Resource version must be greater than zero");
    }
    if (!this.props.permissions.ownerCanEdit) {
      throw new DomainRuleViolation("The resource owner must retain edit permission");
    }
    this.assertPlacementInvariant();
  }

  private assertPlacementInvariant(): void {
    if (this.props.primaryWorkspaceId && !this.isReferencedBy(this.props.primaryWorkspaceId)) {
      throw new DomainRuleViolation("Primary workspace must be one of the resource workspace references");
    }
    if (this.props.workspaceRefs.length === 0 && this.props.defaultSpace === "none") {
      throw new DomainRuleViolation("A resource must exist in a workspace or default space");
    }
  }
}
