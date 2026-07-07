import type { CalendarEvent, EntityId, RelationshipObjectType, RelationshipType, Resource, ResourceRelationship } from "@karya/types";

export type KaryaRelationshipObject = Resource | CalendarEvent;

export interface RelationshipObjectRef {
  id: EntityId;
  type: RelationshipObjectType;
}

export interface RelationshipCreateRequest {
  source: RelationshipObjectRef;
  target: RelationshipObjectRef;
  type: RelationshipType;
}

export interface RelatedObject {
  ref: RelationshipObjectRef;
  object: KaryaRelationshipObject;
  relationship: ResourceRelationship;
}

export interface RelationshipService {
  createRelationship(request: RelationshipCreateRequest): Promise<{ source: KaryaRelationshipObject; target: KaryaRelationshipObject }>;
  removeRelationship(source: RelationshipObjectRef, relationshipId: EntityId): Promise<{ source: KaryaRelationshipObject; target?: KaryaRelationshipObject }>;
  listRelatedObjects(source: RelationshipObjectRef): Promise<RelatedObject[]>;
  listRelationships(source: RelationshipObjectRef): Promise<ResourceRelationship[]>;
  getObject(ref: RelationshipObjectRef): Promise<KaryaRelationshipObject | undefined>;
}
