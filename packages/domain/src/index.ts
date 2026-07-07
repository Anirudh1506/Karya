export * as ApplicationDomain from "./application";
export * as ContinuityDomain from "./continuity";
export * as ProfileDomain from "./profile";
export * as ResourceDomain from "./resource";
export * as SearchDomain from "./search";
export * as SessionDomain from "./session";
export * as WorkspaceDomain from "./workspace";

export * from "./common";
export {
  ApplicationAggregate,
  normalizeApplication,
  type ApplicationId,
  type ApplicationLaunchRecord,
} from "./application";
export {
  Resource,
  ResourceFactory,
  type AddWorkspaceReferenceCommand,
  type ArchiveResourceCommand,
  type CreateResourceCommand,
  type CreateResourceRequest,
  type DefaultSpacePlacement,
  type DeleteResourceCommand,
  type OwnerId,
  type ProfileId,
  type Relationship,
  type RelationshipType,
  type RemoveWorkspaceReferenceCommand,
  type RenameResourceCommand,
  type ResourceCommand,
  type ResourceDomainEvent,
  type ResourceLifecycle,
  type ResourceMetadata,
  type ResourceMetadataPatch,
  type ResourceOwnership,
  type ResourcePermissions,
  type ResourceProps,
  type ResourceRepository,
  type ResourceReference,
  type ResourceSnapshot,
  type ResourceStatus,
  type ResourceType,
  type RestoreResourceCommand,
  type UpdateMetadataCommand,
  type UserId,
  type VersionInfo,
  type WorkspaceId,
} from "./resource";
export {
  Workspace,
  type CreateWorkspaceRequest,
  type WorkspaceDomainEvent,
  type WorkspaceContext,
  type WorkspaceLifecycle,
  type WorkspaceLayout,
  type WorkspaceLaunchApplicationBehavior,
  type WorkspaceLaunchApplicationItem,
  type WorkspaceLaunchResourceBehavior,
  type WorkspaceLaunchResourceItem,
  type WorkspaceLaunchSet,
  type WorkspaceLaunchSetItem,
  type WorkspaceMetadata,
  type WorkspacePermissions,
  type WorkspaceProps,
  type WorkspaceRepository,
  type WorkspaceReference,
  type WorkspaceSession,
  type WorkspaceState,
} from "./workspace";
