import type { CalendarEventService } from "@karya/event-service";
import type { ResourceService } from "@karya/resource-service";
import type { CalendarEvent, EntityId, RelationshipObjectType, RelationshipType, Resource, ResourceRelationship } from "@karya/types";
import type { KaryaRelationshipObject, RelatedObject, RelationshipCreateRequest, RelationshipObjectRef, RelationshipService } from "./contracts";

const ALLOWED_RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  "relatedTo",
  "dependsOn",
  "references",
  "createdFrom",
  "duplicateOf",
  "attachment",
  "childOf",
  "parentOf",
  "inspiredBy",
  "supports",
  "blocks",
  "custom",
];

export class DefaultRelationshipService implements RelationshipService {
  constructor(
    private readonly resources: ResourceService,
    private readonly events: CalendarEventService,
  ) {}

  async createRelationship(request: RelationshipCreateRequest): Promise<{ source: KaryaRelationshipObject; target: KaryaRelationshipObject }> {
    assertRelationshipType(request.type);
    if (request.source.type === request.target.type && request.source.id === request.target.id) {
      throw new Error("An object cannot relate to itself");
    }

    const [source, target] = await Promise.all([
      this.requireObject(request.source),
      this.requireObject(request.target),
    ]);
    assertAllowedObjectPair(source, target);

    const existing = findRelationship(source, request.target, request.type);
    if (existing) {
      return { source, target };
    }

    const graphEdgeId = crypto.randomUUID();
    const sourceRelationship = createRelationship({
      graphEdgeId,
      source: request.source,
      target: request.target,
      type: request.type,
    });
    const targetRelationship = createRelationship({
      graphEdgeId,
      source: request.target,
      target: request.source,
      type: inverseRelationshipType(request.type),
    });

    const updatedSource = await this.addRelationship(source, sourceRelationship);
    const updatedTarget = await this.addRelationship(target, targetRelationship);
    return { source: updatedSource, target: updatedTarget };
  }

  async removeRelationship(source: RelationshipObjectRef, relationshipId: EntityId): Promise<{ source: KaryaRelationshipObject; target?: KaryaRelationshipObject }> {
    const sourceObject = await this.requireObject(source);
    const relationship = sourceObject.relationships.find((candidate) => candidate.id === relationshipId);
    if (!relationship) return { source: sourceObject };

    const targetRef = relationshipTargetRef(relationship);
    const graphEdgeId = relationship.metadata?.graphEdgeId;
    const targetObject = await this.getObject(targetRef);
    const targetRelationship = targetObject?.relationships.find((candidate) =>
      graphEdgeId
        ? candidate.metadata?.graphEdgeId === graphEdgeId
        : relationshipTargetRef(candidate).id === source.id && relationshipTargetRef(candidate).type === source.type,
    );

    const updatedSource = await this.removeRelationshipFromObject(sourceObject, relationship.id);
    const updatedTarget = targetObject && targetRelationship
      ? await this.removeRelationshipFromObject(targetObject, targetRelationship.id)
      : targetObject;

    return { source: updatedSource, target: updatedTarget };
  }

  async listRelatedObjects(source: RelationshipObjectRef): Promise<RelatedObject[]> {
    const object = await this.requireObject(source);
    const related = await Promise.all(
      object.relationships.map(async (relationship): Promise<RelatedObject | undefined> => {
        const ref = relationshipTargetRef(relationship);
        const target = await this.getObject(ref);
        if (!target || target.lifecycleState === "deleted") return undefined;
        return { ref, object: target, relationship };
      }),
    );
    return related.filter((item): item is RelatedObject => Boolean(item));
  }

  async listRelationships(source: RelationshipObjectRef): Promise<ResourceRelationship[]> {
    return (await this.requireObject(source)).relationships;
  }

  async getObject(ref: RelationshipObjectRef): Promise<KaryaRelationshipObject | undefined> {
    return ref.type === "event"
      ? this.events.getEvent(ref.id)
      : this.resources.getResource(ref.id);
  }

  private async requireObject(ref: RelationshipObjectRef): Promise<KaryaRelationshipObject> {
    const object = await this.getObject(ref);
    if (!object) {
      throw new Error(`Relationship object not found: ${ref.type}:${ref.id}`);
    }
    return object;
  }

  private async addRelationship(object: KaryaRelationshipObject, relationship: ResourceRelationship): Promise<KaryaRelationshipObject> {
    if (findRelationship(object, relationshipTargetRef(relationship), relationship.type)) {
      return object;
    }

    if (isCalendarEvent(object)) {
      return this.events.update({
        id: object.id,
        relationships: [...object.relationships, relationship],
      });
    }

    return this.resources.addRelationship(
      object.id,
      relationship.targetResourceId,
      relationship.type,
      relationship.metadata,
    );
  }

  private async removeRelationshipFromObject(object: KaryaRelationshipObject, relationshipId: EntityId): Promise<KaryaRelationshipObject> {
    if (isCalendarEvent(object)) {
      return this.events.update({
        id: object.id,
        relationships: object.relationships.filter((relationship) => relationship.id !== relationshipId),
      });
    }

    return this.resources.removeRelationship(object.id, relationshipId);
  }
}

function createRelationship(input: {
  graphEdgeId: EntityId;
  source: RelationshipObjectRef;
  target: RelationshipObjectRef;
  type: RelationshipType;
}): ResourceRelationship {
  return {
    id: crypto.randomUUID(),
    targetResourceId: input.target.id,
    targetObjectId: input.target.id,
    targetObjectType: input.target.type,
    type: input.type,
    metadata: {
      graphEdgeId: input.graphEdgeId,
      sourceObjectType: input.source.type,
      targetObjectId: input.target.id,
      targetObjectType: input.target.type,
    },
  };
}

function relationshipTargetRef(relationship: ResourceRelationship): RelationshipObjectRef {
  return {
    id: relationship.targetObjectId ?? relationship.metadata?.targetObjectId ?? relationship.targetResourceId,
    type: readObjectType(relationship.targetObjectType ?? relationship.metadata?.targetObjectType),
  };
}

function readObjectType(value: string | undefined): RelationshipObjectType {
  return value === "event" ? "event" : "resource";
}

function findRelationship(object: KaryaRelationshipObject, target: RelationshipObjectRef, type: RelationshipType): ResourceRelationship | undefined {
  return object.relationships.find((relationship) => {
    const ref = relationshipTargetRef(relationship);
    return ref.id === target.id && ref.type === target.type && relationship.type === type;
  });
}

function inverseRelationshipType(type: RelationshipType): RelationshipType {
  if (type === "childOf") return "parentOf";
  if (type === "parentOf") return "childOf";
  return type;
}

function assertRelationshipType(type: RelationshipType): void {
  if (!ALLOWED_RELATIONSHIP_TYPES.includes(type)) {
    throw new Error(`Unsupported relationship type: ${type}`);
  }
}

function assertAllowedObjectPair(source: KaryaRelationshipObject, target: KaryaRelationshipObject): void {
  if (!isResource(source) || !isResource(target)) return;
  if (isFolderChildPair(source, target) || isFolderChildPair(target, source)) {
    throw new Error("Folders cannot be related to direct file contents inside the same folder");
  }
}

function isFolderChildPair(folder: Resource, candidateChild: Resource): boolean {
  return isFolderResource(folder)
    && !isFolderResource(candidateChild)
    && readStringAttribute(candidateChild, "folderParentId") === folder.id;
}

function isResource(object: KaryaRelationshipObject): object is Resource {
  return !isCalendarEvent(object);
}

function isFolderResource(resource: Resource): boolean {
  return resource.type === "inode/directory" || resource.metadata.kind === "folder";
}

function readStringAttribute(resource: Resource, key: string): string | undefined {
  const value = resource.metadata.attributes?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isCalendarEvent(object: KaryaRelationshipObject): object is CalendarEvent {
  return "eventType" in object && object.eventType === "calendar-event";
}
