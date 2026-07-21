# Workspace Management — Vertical Slice 02

## Architecture Summary

Workspace Management is the second user-facing Karya Mobile vertical slice. A Workspace belongs to exactly one Profile, SQLite remains authoritative, and Core owns the active working context.

```text
WorkspaceListScreen / CreateWorkspaceScreen
  -> Mobile workspace interaction adapter
  -> Kernel ShellApi
  -> CommandBus
  -> WorkspaceService
  -> Workspace aggregate
  -> WorkspaceRepository
  -> ExpoSqliteStore

Workspace aggregate
  -> domain events
  -> EventBus
  -> ContinuityService + StateEngine
  -> synchronous Shell snapshot
  -> Mobile render
```

React owns navigation, form input, pending indicators, confirmation dialogs, and surfaced errors. It does not retain Profile, Workspace, or active-context business state.

## Workspace Lifecycle

```text
Nonexistent
    |
    | create
    v
  Active (open) <------ restore ------ Archived
    |   ^                               ^
    |   | activate                     |
    |   |                              | archive
    v   |                              |
  Inactive (closed) -------------------+
          archive
```

`deleted` remains supported by the shared aggregate for existing Desktop compatibility, but Mobile never exposes permanent deletion.

## Domain Changes

The existing Workspace aggregate remains authoritative. Its creation request now accepts optional `color` and `icon` values already represented by Workspace metadata. Existing create, rename, open, close, archive, restore, and persistence behavior was reused.

## Repository and Persistence

No repository contract was added. Mobile continues to adapt the existing domain `WorkspaceRepository` to the JSON-backed Expo SQLite store.

Persisted data includes:

- Profile ownership;
- lifecycle state;
- name, description, icon, and color;
- timestamps used for deterministic recent ordering;
- active and preserved Workspace sessions;
- the continuity session's active Profile and Workspace identifiers.

## Context Flow

```text
User activates Workspace
  -> OpenWorkspaceCommand validates active-Profile ownership
  -> Workspace aggregate opens
  -> WorkspaceOpened + ActiveWorkspaceChanged
  -> ContinuityService persists active Profile/Workspace session
  -> StateEngine derives active Workspace and shell context
  -> Mobile subscription receives the committed Kernel snapshot
```

Changing Profile clears a foreign active Workspace and restores the most recently active valid Workspace owned by the selected Profile. If no previous session exists, Core resolves the Profile's default Workspace, then its most recently opened valid Workspace.

Archived or deleted Workspace identifiers are never restored as active. A deep link cannot activate a Workspace owned by a different Profile.

## UI and Deep Links

- Selecting a Profile opens its Workspace list.
- `karya://workspaces` opens Workspaces for the active Profile.
- `karya://workspaces/:workspaceId` routes and activates an owned, available Workspace.
- `karya://workspaces/new` opens Workspace creation.
- Active, available, and archived Workspaces are presented separately.
- Creation requires a name and optionally accepts description, icon, and color.
- Archive is explicit and recoverable; selecting an archived Workspace restores it.

## Restoration Flow

```text
SQLite opens
  -> Profile and Workspace repositories load
  -> persisted ContinuitySession loads
  -> active Profile restores
  -> Profile context resolver activates its persisted Workspace
  -> StateEngine hydrates with matching Profile and Workspace context
  -> Mobile renders the restored Workspace without user action
```

## Events

The slice uses the existing Event Bus and Workspace domain events:

- `WorkspaceCreated`
- `WorkspaceUpdated`
- `WorkspaceOpened`
- `WorkspaceClosed`
- `WorkspaceRenamed`
- `WorkspaceArchived`
- `WorkspaceRestored`
- `ActiveWorkspaceChanged`

Continuity updates flow through one canonical event path. Redundant command-level Workspace-open persistence was removed.

## Testing

Automated coverage verifies:

- Mobile command routing without client-side business behavior;
- optional Workspace metadata mapping;
- create, rename, open, close, archive, and restore behavior;
- Profile ownership enforcement;
- domain event publication and State Engine handling;
- active shell and continuity context updates;
- SQLite Workspace and session persistence across closure and reopening;
- same-Profile and same-Workspace restoration across complete Core restart;
- offline operation with no cloud or synchronization dependency.

## Remaining Work Before Resources

The Resource slice can rely on stable `activeProfileId` and `activeWorkspaceId` values from Core. It should add Resource ownership and persistence through the existing repository boundaries, use Workspace context for destination resolution, and avoid introducing Home, Search, Capture, synchronization, or cloud behavior prematurely.
