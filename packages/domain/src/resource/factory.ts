import { Color, DomainRuleViolation, Identifier, Label, Tag, Timestamp } from "../common";
import { Resource } from "./aggregate";
import type { CreateResourceRequest } from "./types";
import { uniqueByValue, uniqueIdentifiers } from "./utils";

export class ResourceFactory {
  static create(request: CreateResourceRequest): Resource {
    const occurredAt = Timestamp.from(request.occurredAt);
    const type = request.type.trim();

    if (!type) {
      throw new DomainRuleViolation("Resource type cannot be empty");
    }

    const workspaceRefs = uniqueIdentifiers(request.workspaceRefs ?? [], "WorkspaceId");
    const primaryWorkspaceId = request.primaryWorkspaceId
      ? Identifier.from(request.primaryWorkspaceId, "WorkspaceId")
      : workspaceRefs[0];
    const defaultSpace = request.defaultSpace ?? (workspaceRefs.length ? "none" : "profile");
    const actorId = request.createdBy ? Identifier.from(request.createdBy, "UserId") : undefined;
    const lifecycle = request.lifecycle ?? "active";

    return Resource.create({
      id: Identifier.from(request.id, "ResourceId"),
      type,
      metadata: {
        title: Label.from(request.title?.trim() || "Untitled Resource").value,
        description: request.description?.trim() || undefined,
        kind: request.kind?.trim() || type,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        createdBy: actorId,
        updatedBy: actorId,
        importance: request.importance ?? "normal",
        color: request.color ? Color.from(request.color) : undefined,
        attributes: { ...(request.attributes ?? {}) },
      },
      ownership: {
        owner: Identifier.from(request.owner, "OwnerId"),
        profileId: Identifier.from(request.profileId, "ProfileId"),
      },
      workspaceRefs,
      primaryWorkspaceId,
      defaultSpace,
      tags: uniqueByValue((request.tags ?? []).map(Tag.from)),
      relationships: [],
      permissions: {
        ownerCanEdit: true,
        sharedWith: [],
      },
      versionInfo: {
        version: 1,
      },
      status: lifecycle,
      lifecycle,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    });
  }
}
