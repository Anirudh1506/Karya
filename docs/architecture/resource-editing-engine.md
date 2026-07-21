# Resource Editing Engine

## Architecture

Resource editing is a Core capability implemented by `@karya/editing-service`. Clients open an edit session and submit plain-text changes through the Shell API. They do not write Resource metadata or SQLite directly.

```text
Mobile / Desktop presentation
        ↓ Shell API
Resource Editing Service
        ├─ Resource Service (ownership and metadata timestamp)
        ├─ Event Bus (editing lifecycle)
        └─ Persistence contracts
             ├─ editable content
             ├─ edit sessions / recovery state
             └─ checkpoints
```

The existing `updateNoteContent` API remains available for Desktop compatibility, but now opens a Core edit session, applies the change, and flushes it through the same engine.

## Editing lifecycle

1. `openEditSession` validates that the Resource exists and is an editable Note.
2. Core restores an existing open session or creates a stable session record.
3. The first change creates a `first-edit` checkpoint and persists recovery content immediately.
4. Further changes mark the session dirty and reset a 900 ms inactivity timer.
5. Autosave updates the Resource summary and modification timestamp through Resource Service.
6. Leaving the editor flushes pending work and creates a `session-end` checkpoint.

Backgrounding and Core suspension flush dirty sessions before persistence closes. Open session and recovery records remain available after restart.

## Events

```text
EditSessionStarted
        ↓
ResourceContentChanged (per local change)
        ↓
AutosaveStarted
        ↓
AutosaveCompleted
        ↓
EditSessionEnded (explicit editor close)
```

Activity Timeline records completed autosaves, avoiding an activity entry for every keystroke. Resource metadata updates continue to drive Continue Working, Home, and metadata-only Search through their existing Event Bus subscriptions.

## Persistence

SQLite is authoritative. Desktop schema version 4 adds `editable_contents`, `edit_sessions`, and `edit_checkpoints`. Mobile stores the same records in its existing typed entity store. Content is UTF-8 plain text with a monotonic revision. Results are never stored in React state alone.

The first implementation stores a complete recovery draft after each change. This is intentionally separate from Resource metadata and guarantees crash recovery. A future large-document storage strategy can introduce deltas behind the unchanged persistence contract.

## Mobile UI

Resource Detail presents a multiline, keyboard-aware Note editor and a passive autosave status (`Unsaved changes`, `Saving…`, `Saved`, or failure). There is no Save action. Rename, metadata, and move behavior remain available and unchanged.

## Deferred work

- Rich text and block editing
- Collaboration and conflict resolution
- Attachments, comments, and mentions
- Cross-device synchronization
- Checkpoint browsing and restore UI
- Large-document delta storage
