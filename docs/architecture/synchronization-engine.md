# Synchronization Engine

## Architecture

Synchronization is a Core replication capability. It records immutable operations from existing Core events and never reads database rows as a synchronization source.

```text
Core capability changes
        ↓ Event Bus
Synchronization Engine
        ├─ persistent Device Identity
        ├─ append-only Operation Log
        ├─ pending / acknowledged Queue
        ├─ deterministic Replay Engine
        ├─ Replay Receipts
        ├─ Conflict Hooks
        └─ SyncTransport boundary (unused in this slice)
```

There is no network, account, device pairing, cloud storage, or remote device implementation in this slice.

## Operation schema

Every operation contains a permanent UUID, persistent Device ID, device-local logical sequence, timestamp, entity type and ID, operation type, serialized snapshot payload, optional operation dependencies, and acknowledgement state.

Payload and identity are immutable after append. Acknowledgement state is maintained as queue metadata without altering the operation's identity or serialized change.

Initially recorded changes include Profile, Workspace, Resource and Resource Content changes, completed Captures, and Notification read state.

## Operation lifecycle

```text
Core event
  → Operation created
  → Append to SQLite operation log
  → SyncQueued
  → Pending queue
  → Future transport receives batch
  → Acknowledgement recorded
  → SyncAcknowledged
```

Failures publish `SyncFailed`. No transport-specific events are part of the public API.

## Replay

Replay sorts operations by timestamp, Device ID, logical sequence, and permanent operation ID. A replay receipt is persisted after each successful application. Existing receipts make duplicate replay a no-op.

Replicated snapshots are applied through their owning Core services. Recording is suppressed during replay, preventing operation feedback loops. This preserves Profile, Workspace, Resource, Editing, and Notification ownership boundaries.

## Conflict hooks

Conflict detection is intentionally non-resolving. The engine records structured conflict hooks for missing operation dependencies, unsupported operations, and local state newer than the incoming operation. Records contain both timestamps and remain unresolved for a future policy or UI.

## Transport boundary

`SyncTransport` exposes only `push` and cursor-based `pull`. Future Cloud, local-network, Bluetooth, peer-to-peer, iCloud, or Drive adapters implement this contract outside Core. The engine has no dependency on any transport implementation.

## Device identity

Each installation generates one UUID on first startup. It is stored locally as `local-device` and survives application and Core restarts. No user identity is implied.

## Persistence

Desktop schema version 5 adds indexed operation, device-state, replay-receipt, and conflict tables. Mobile uses the existing SQLite entity store for the same contracts. Pending and acknowledged queues are restored incrementally without rebuilding the operation log.

## Mobile status

The Sync Status screen displays the Device ID, pending count, queue size, acknowledged count, and last replay. It is presentation-only and updates from the Core synchronization status subscription.

## Deferred connectivity work

- Karya Account and authentication
- Device registration and pairing
- Concrete transports and remote cursors
- Encryption and key management
- Conflict resolution policies and UI
- Collaboration, presence, and shared Workspaces
