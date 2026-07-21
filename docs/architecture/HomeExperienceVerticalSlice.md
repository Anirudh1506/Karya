# Home Experience — Experience Slice 01

## Purpose

Home is Karya Mobile's default launch experience. It composes restored Core state so the user can identify their context and resume work without navigating through the application structure. Home is not a repository, service, ranking engine, or restoration coordinator.

## Architecture

```text
Mobile Composition Root
          |
          v
     Core snapshot
     /     |      \
Context  Continue   Recent Resources
         Working    by Workspace
     \     |      /
          v
      useHome()
          |
          v
      HomeScreen
```

`HomeScreen` subscribes once to the existing immutable Core snapshot. `useHome` selects references from that snapshot without copying them into React state. Continue Working remains ordered by `ContinueWorkingService`; recent Resources are ordered inside the State Engine.

The only new Core projection is `ResourceState.recentModifiedByWorkspace`. It groups active, top-level Resources by Workspace, orders them by modification timestamp with Resource ID as a deterministic tie-breaker, and caps each group at eight. This keeps filtering and ordering out of Mobile while avoiding a new model or persistence layer.

## Component hierarchy

```text
HomeScreen
├── Context bar
│   ├── Active Profile action
│   └── Active Workspace action
├── Continue Working section
│   └── Highest-priority Core item
├── Recent Resources section
│   └── Core-ordered Resource rows
├── Workspace empty state
└── Quick Actions
    ├── New Note
    ├── Switch Workspace
    └── Switch Profile
```

The hierarchy contains no decorative widgets, metrics, analytics, or placeholder content.

## State ownership

| State                                 | Owner                       | Home behavior                                      |
| ------------------------------------- | --------------------------- | -------------------------------------------------- |
| Active Profile and Workspace          | Core context and continuity | Reads and displays                                 |
| Continue Working order                | Continue Working engine     | Displays the first item unchanged                  |
| Recent Resource order                 | State Engine                | Displays the active Workspace collection unchanged |
| Resources and metadata                | Resource capability         | Reads names, types, and timestamps                 |
| Restoration                           | Kernel lifecycle            | Waits for ready Core state                         |
| Navigation and pending/error feedback | React                       | Keeps transient presentation state only            |

## Event flow

```text
Profile / Workspace / Resource command
                 |
              Event Bus
                 |
       Core services + State Engine
                 |
       immutable snapshot commit
                 |
       useSyncExternalStore notification
                 |
             Home render
```

Profile changes, Workspace changes, Resource creation/update/archive, and Continue Working updates all reach Home through the existing Core snapshot subscription. Home does not subscribe to a second event channel, poll, or manually refresh.

## Navigation

- Application launch → Home.
- Continue Working item → existing Resource Detail route.
- Recent Resource → existing Resource Detail route.
- Profile context or quick action → existing Profile List, returning to Home after selection.
- Workspace context or quick action → existing Workspace List, returning to Home after selection.
- New Note → existing Create Resource route, returning to Home after creation.

Existing deep links remain authoritative. Home introduces no deep-link contract.

## Rendering and performance

- The Kernel restores Profile, Workspace, Resources, and Continue Working before it reports ready.
- Home consumes the restored local snapshot immediately and never performs restoration itself.
- Continue Working is not recomputed during React rendering.
- Recent Resources are projected once per Core Resource-state change, not sorted on every Home render.
- Snapshot arrays are passed through by reference, avoiding mirrored state and unnecessary queries.
- The screen renders only one Continue Working card and at most eight recent Resource rows.

## Verification

Automated coverage verifies empty restored state, Profile and Workspace context projection, Resource creation and archive propagation, Continue Working integration, Core-owned recent ordering, reference preservation as a performance sanity check, and preservation of existing navigation/deep-link routes. Existing lifecycle tests cover restart restoration.

## Remaining work before Universal Search

- Define Universal Search as a separate Core-backed experience and preserve Home's composition-only boundary.
- Add Search entry affordances only when the Search slice owns its query, results, and navigation contracts.
- Add device-level accessibility and navigation-return tests as the Mobile UI test harness evolves.
- Keep Search suggestions, analytics, and smart recommendations out of Home unless separately specified.
