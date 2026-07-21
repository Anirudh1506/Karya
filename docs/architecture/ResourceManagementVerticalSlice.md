# Resource Management — Vertical Slice 03

## Architecture Summary

Resource Management is the first Karya Mobile slice representing user work. The initial creatable type is an empty Note Resource; there is no editor or content viewer.

```text
Resource Mobile screens
  -> Mobile interaction adapter
  -> Kernel ShellApi
  -> CommandBus ownership guards
  -> ResourceService
  -> Resource aggregate
  -> ResourceRepository
  -> ExpoSqliteStore

Resource aggregate
  -> domain events
  -> EventBus
  -> StateEngine + ContinuityService
  -> synchronous Shell snapshot
  -> Mobile projection
```

React owns sorting choice, navigation, form input, pending indicators, dialogs, and surfaced errors. Resource identity, metadata, lifecycle, placement, and selection remain in Core.

## Resource Lifecycle

```text
Nonexistent
    |
    | create Note
    v
  Active ---------------------> Active
    |        rename / metadata / move
    |
    | archive
    v
  Archived
    |
    | restore
    v
  Active
```

Moving changes the single owning Workspace without changing Resource identity. Permanent deletion is not exposed by Mobile.

## Dependency and Context Flow

```text
Active Profile
  -> Active Workspace
      -> Resource command ownership guard
          -> Resource aggregate transition
              -> Repository transaction
                  -> Event Bus
                      -> Kernel snapshot
```

Every Mobile Resource command requires a valid active Workspace owned by the active Profile. Create always uses that Workspace. Open, rename, metadata update, archive, and restore reject Resources not referenced by it. Move requires the source Resource to belong to the active Workspace and the destination Workspace to belong to the same Profile.

## Domain and Repository

The existing aggregate, UUID generation, repository contract, relationship representation, metadata model, and lifecycle transitions were reused. A partial-metadata normalization defect was corrected so omitted fields can no longer overwrite required metadata such as title.

No repository or database abstraction was added. Expo SQLite continues storing aggregate DTOs through the existing Resource repository adapter.

The legacy shared DTO retains `profileId` for Desktop compatibility. For Mobile operations it is never accepted as independent UI ownership: Core derives and validates it from the owning Workspace. New Mobile Resources always have exactly one `workspaceRefs` entry and the same `primaryWorkspaceId`.

## Events

The slice uses the existing Event Bus events:

- `ResourceCreated`
- `ResourceOpened`
- `ResourceRenamed`
- `MetadataUpdated`
- `ResourceMoved`
- `ResourceArchived`
- `ResourceRestored`
- `ResourceUpdated`

Resource relationships remain stable and ID-based. Relationship editing is intentionally absent.

## Mobile UI Flow

- Selecting a Workspace opens its Resource list.
- Active and archived Resources are grouped separately.
- Active Resources sort by recently modified or name.
- Note creation requires only a display name.
- Resource detail displays name, type, Workspace, creation time, and modification time.
- Detail supports rename and same-Profile Workspace movement.
- Archive is explicit and recoverable; selecting an archived Resource restores it.

Deep links:

- `karya://resources`
- `karya://resources/new`
- `karya://resources/:resourceId`

Deep-linked Resources still pass Core ownership validation.

## Persistence and Restoration

SQLite persists stable UUID, metadata, timestamps, lifecycle, relationships, and Workspace placement. Kernel startup restores Profile and Workspace context first, then hydrates all Resources. Mobile projects only Resources owned by the restored active Workspace.

```text
SQLite opens
  -> Profile restores
  -> Workspace restores
  -> Resource repository loads
  -> StateEngine hydrates Workspace-scoped selection
  -> Resource list renders without recovery input
```

## Resource Invariants

- Resource IDs are stable UUIDs and never derive from paths, filenames, or list indices.
- Every Mobile-created Resource has exactly one authoritative Workspace.
- The owning Workspace belongs to exactly one Profile.
- Profile ownership is derived and validated through Workspace context.
- Resource metadata and lifecycle belong to Core.
- Archived Resources retain identity, metadata, placement, and relationships.
- Resource selection cannot leak across Workspace context changes.
- Operations remain local and asynchronous with no network dependency.

## Testing

Coverage verifies:

- creation of the initial Note Resource type;
- UUID stability through rename, metadata update, move, archive, restore, and restart;
- aggregate lifecycle and metadata behavior;
- Event Bus publication and State Engine handling;
- active-Workspace ownership enforcement;
- cross-Profile move rejection;
- selection clearing after movement out of the active Workspace;
- SQLite identity, metadata, placement, and archive persistence;
- complete Core restart restoration;
- Mobile command routing without duplicated business behavior.

## Remaining Work Before Home

The Home slice can consume the stable Profile → Workspace → Resource hierarchy and existing recent-resource continuity data. It should remain a projection over Core state and should not introduce Resource editing, Search UI, Capture, synchronization, cloud, or AI behavior.
