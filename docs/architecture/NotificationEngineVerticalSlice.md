# Notification Engine — Experience Slice 05

## Architecture

The Notification Engine is a Core awareness capability. `ActivityService` is its only generation input: Activity records canonical history, and Notification rules select the small subset requiring attention. The engine never subscribes to product events and the Mobile client never creates Notifications.

```text
Product event → Activity Timeline → Notification rules → Notification repository
                                                       ↓
                                      Core state and query APIs → clients
```

`ActivityService.subscribe` is an in-process Core contract rather than another Event Bus path. It is invoked only after the Activity has been appended successfully, ensuring notifications cannot precede their source Activity.

## Rule mapping

| Activity                           | Condition                           | Notification                      |
| ---------------------------------- | ----------------------------------- | --------------------------------- |
| `WorkspaceArchived`                | Workspace was active when archived  | High-severity Workspace attention |
| `ResourceMoved`                    | Resource left the active Workspace  | Resource-moved attention          |
| `CaptureFailed`                    | Capture had no valid active context | Missing-context attention         |
| `SynchronizationAttentionRequired` | Reserved future Activity            | System attention placeholder      |
| `PermissionAttentionRequired`      | Reserved future Activity            | Permission attention placeholder  |

Resource opens and renames, searches, context switching, Continue Working updates, and successful captures produce no Notification.

## Schema and persistence

Notifications contain a deterministic ID derived from the Activity ID, their canonical Activity ID, type, timestamp, title, description, severity (`priority`), state, and related Profile, Workspace, and optional Resource. A unique Activity ID constraint provides storage-level deduplication.

Desktop and Mobile use dedicated SQLite Notification tables. Creation is append-only (`INSERT OR IGNORE`); read and dismissed state update the existing Notification record, and records are never physically deleted. Timestamp, Profile/status, and Workspace indexes support recent lists, context queries, and unread counts without scans.

## Query and context API

Core exposes unread, recent, by-Profile, by-Workspace, count, and latest queries. An omitted Profile resolves to the active Profile inside Core. Mobile filters its live snapshot to the active Profile as an additional presentation boundary.

## Navigation

Selection calls `openNotification` in Core. Core marks the Notification read, restores the related Profile and Workspace where valid, then opens the Resource. The client only presents the resulting destination.

## Mobile experience

The minimal Notification Center shows title, description, timestamp, and unread state. It supports mark-all-read and dismissal. Home displays the active Profile's unread count. State updates arrive through existing Core state subscriptions; there is no polling or manual refresh.

## Performance

- Incremental evaluation of one newly persisted Activity
- Deterministic ID plus unique Activity index for deduplication
- Indexed SQLite queries and `COUNT(*)` for unread badges
- No startup rebuild and no polling
- No OS notification delivery in this slice

## Remaining before Synchronization

Synchronization can introduce canonical `SynchronizationAttentionRequired` Activities and consume the existing placeholder rule. Push transport, cross-device state convergence, scheduled delivery, sounds, vibration, actions, and AI prioritization remain intentionally deferred.
