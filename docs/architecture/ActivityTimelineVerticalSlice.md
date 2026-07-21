# Activity Timeline Vertical Slice

## Architecture

The existing `@karya/activity-service` is now Karya's canonical historical-memory engine. It subscribes to meaningful domain events, translates them to structured Activities, appends them through the shared persistence contract, publishes `ActivityRecorded`, and exposes context-aware queries through Core.

```text
Domain event -> Event Bus -> ActivityService -> ActivityRepository -> SQLite
                                  |
                                  +-> ActivityRecorded -> State Engine -> Timeline UI
```

Clients never create Activities. Desktop, Mobile, future Notifications, AI, Sync, and SDK consumers use the same service and Shell API.

## Activity schema

Each Activity contains a deterministic ID, source event type, timestamp, category and verb, Profile and Workspace ownership, optional Resource reference, local actor, human-readable title and description, related objects, and structured metadata. Records are append-only; repeated deterministic IDs are ignored rather than overwritten.

## Event mapping

The foundational mapping includes:

- `ProfileCreated`, `ProfileUpdated`, `ActiveProfileChanged`
- `WorkspaceCreated`, `WorkspaceUpdated`, `ActiveWorkspaceChanged`
- `ResourceCreated`, `ResourceOpened`, `ResourceRenamed`, `ResourceMoved`
- `ResourceArchived`, `ResourceRestored`, `ResourceDeleted`
- `CaptureCompleted`

Existing meaningful Calendar, import, application, relationship, and Workspace lifecycle mappings remain supported. Generic low-level events are not recorded.

## Persistence and performance

Desktop and Mobile SQLite use dedicated Activity tables with indexes for timestamp, Profile, Workspace, Resource, and event type. Writes are incremental and append-only; the timeline is restored during Kernel hydration without rebuilding historical events.

The retention policy is explicit and currently `retain-all`. It caps individual query results but performs no deletion in this slice.

## Query API

Core exposes recent Activities, latest Activity, and Activities by Profile, Workspace, Resource, or event type. Sorting is deterministic: descending occurrence timestamp followed by stable Activity ID.

## Navigation

Timeline selection calls `openActivity()` through Core. Resource entries restore their current Profile and Workspace before opening; Workspace and Profile entries activate their context before Mobile presents the related screen.

## Mobile validation UI

The minimal Timeline screen displays an icon, summary, timestamp, and resolved Workspace/Profile names. It provides no grouping, filters, search, editing, notifications, analytics, or AI behavior.

## Remaining work before Notifications

- Device-level accessibility and long-list performance validation.
- Introduce pagination when timeline volume requires it without changing the public query categories.
- Notifications should consume `ActivityRecorded`; they must not create a parallel event history.
