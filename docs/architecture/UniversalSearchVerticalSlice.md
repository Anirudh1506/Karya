# Universal Search — Experience Slice 02

## Architecture

Universal Search extends the existing `search-service`; it does not introduce a Mobile-specific engine. `ShellApi.search` and `QueryService.search` both delegate to the same service.

```text
Authoritative repositories
          |
     boot rebuild
          v
 Universal Search index <--- Event Bus incremental updates
          |
 matching + context + deterministic ranking
          |
     SearchCompleted
          |
 immutable Core snapshot
          |
 Mobile / Desktop / future consumers
```

Mobile owns the query text, keyboard focus, transient errors, and rendering. Core owns indexed documents, candidates, match classification, highlight ranges, ranking, context restoration, and recent-search persistence.

## Index structure

The in-memory index contains:

- A document map keyed by stable document ID.
- A normalized term-to-document inverted map.
- A reverse document-to-terms map for constant-scope incremental removal.
- Persisted `SearchDocument` records in the existing Search repository.

At boot, persisted documents can be loaded immediately, then the index is deterministically rebuilt from authoritative Profile, Workspace, and Resource state. Search results are never persisted.

Only metadata is indexed for Universal Search:

- Profile name.
- Workspace name and description.
- Resource name, description, type, tags, relationships, and non-content metadata attributes.

Resource content and content-derived attributes are deliberately excluded.

## Ranking

Matching and ranking are deterministic:

1. Exact match.
2. Prefix match.
3. Word-boundary match.
4. Contains match.
5. Active-Workspace Resource boost.
6. Recent Resource position.
7. Last opened timestamp.
8. Last modified or created timestamp.
9. Alphabetical title.
10. Stable document ID.

The engine returns match field, classification, start, and length. Consumers can highlight text without implementing their own matcher.

Global presentation groups results as Profiles, Workspaces, then Resources. Grouping does not alter ranking inside each type.

## Event flow

The engine incrementally handles Profile create/update/archive/restore/delete, Workspace create/update/rename/archive/restore/delete, and Resource create/update/rename/move/archive/restore/delete events. Each event replaces or removes one stable document and updates only that document's inverted terms. There is no polling.

## Navigation

Result navigation is a Core operation:

```text
Profile result  -> switch Profile
Workspace result -> switch owning Profile -> open Workspace
Resource result -> switch owning Profile -> open owning Workspace -> open Resource
```

Mobile waits for this sequence before navigating to Home or Resource Detail. It never changes context directly.

## Persistence

Search documents use the existing Search repository and rebuild from Core on launch. Recent searches are stored on the persisted continuity session as a case-insensitive, deduplicated list capped at ten entries. Clearing history persists an empty list. Search results remain ephemeral.

## Performance

- Queries retrieve candidates from normalized inverted terms instead of scanning every document field.
- Event maintenance is incremental and asynchronous through the Event Bus.
- Mobile uses the Search results already published in the immutable Core snapshot.
- Query/result identity prevents an older asynchronous response from flashing for a newer query.
- No SQLite query occurs for each keystroke.

## Mobile flow

Home opens a dedicated Search experience with immediate keyboard focus. Typing triggers Core search. Results appear live, grouped by entity type, with Core-provided title highlights. The screen supports explicit query clearing, empty states, recent-search replay, and history clearing.

## Verification

Automated coverage verifies metadata index creation, exact/prefix/word-boundary matching, active-context ranking, event-driven rename/archive/restore updates, Profile and Workspace index lifecycle, metadata descriptions, context-safe Resource navigation, recent-search deduplication, clearing, and restart persistence. Existing Core lifecycle coverage verifies index startup and shutdown boundaries.

## Remaining work before Quick Capture

- Add the Quick Capture capability as an independent Core command surface.
- Reuse existing Profile and Workspace context rather than coupling Capture to Search UI.
- Preserve the Search API extension points for future content and semantic providers without enabling them in this slice.
- Add device-level Search accessibility tests when the native UI test harness is introduced.
