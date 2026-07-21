# Remote Transport Engine

## Responsibility

Remote Transport moves immutable synchronization operations between replicas. It does not create operations, interpret their payloads, resolve conflicts, decide device trust, or implement authentication.

```text
SynchronizationEngine
  pending / replay / acknowledge / deviceId
                │
                ▼
RemoteTransportEngine
  sessions / batches / retry / cursor / lifecycle
                │
                ▼
TransportProvider
  connect / upload / download / acknowledge / disconnect
```

The dependency direction is one-way. Synchronization exposes a narrow port to Transport. Transport providers never import Synchronization, Account, Resource, Workspace, Profile, React, Expo, Electron, or SQLite.

## Provider contract

`TransportProvider` owns protocol behavior:

- `connect` receives the local replica ID and an optional authentication proof.
- `upload` accepts one immutable ordered batch and returns operation-level acknowledgements.
- `download` returns batches after a provider-owned cursor.
- `acknowledge` confirms successful local replay of an incoming batch.
- `disconnect` ends the provider session.

Future HTTP, WebSocket, LAN, Bluetooth, USB, or Cloud implementations can implement this contract without changing Synchronization or Account.

## Loopback provider

`LoopbackTransportProvider` is the reference implementation. Multiple providers share a `LoopbackTransportHub`, which stores operations once by stable operation ID and exposes them to every other logical replica. It supports deterministic simulated upload failures, offline transitions, and partial acknowledgements for tests. It contains no network code.

## Session lifecycle

```text
start → idle → connecting → connected
                         ↙     │
                reconnecting   ├─ suspend → suspended → resume
                         ↘     │
                    failed     └─ disconnect → offline
```

The persisted record contains the download cursor, retry count, last successful synchronization, and update timestamp. A process restart restores durable progress but normalizes the connection to `idle`; live sockets or provider handles are never assumed to survive a process boundary.

Core lifecycle suspension disconnects the provider and marks Transport suspended. Resume reconnects without rebuilding the synchronization queue.

## Upload pipeline

1. Read pending operations from Synchronization.
2. Sort by timestamp, Device ID, logical sequence, and stable operation ID.
3. Split into deterministic configurable batches; default size is 50.
4. Upload one batch through the provider.
5. Validate acknowledgements against that batch.
6. Pass acknowledged IDs to Synchronization.
7. Rebuild only the unfinished remainder and retry it.

Transport never mutates operations. Synchronization remains responsible for persisted acknowledgement state.

## Download pipeline

1. Request batches after the persisted cursor.
2. Deterministically order each batch.
3. Pass operations to `SynchronizationEngine.replay`.
4. Acknowledge the incoming batch only after replay succeeds.
5. Persist the new cursor.

Synchronization replay receipts make repeated delivery idempotent. Account-backed replay authorization rejects operations from untrusted Devices before entity state changes.

## Retry strategy

Provider failures use bounded exponential backoff:

```text
delay = initialBackoff × 2^(attempt - 1)
```

The defaults are 250 ms and three retries. Retry scheduling is injected, making failure tests deterministic and allowing a future platform scheduler without changing the engine. Exhaustion moves the session to `failed`; operations remain pending in SQLite.

## Persistence

SQLite remains authoritative for synchronization operations and Transport session progress:

- Desktop schema version 7 adds `transport_sessions`.
- Mobile stores the same logical record in its typed JSON entity table.
- Pending batches are derived from pending operations after restart rather than duplicated in another queue.
- Download cursors and successful synchronization timestamps survive process restart.

## Authentication boundary

Transport optionally receives the existing `AuthenticationProvider`. It asks for an `AuthenticationProof` while connecting or reconnecting and passes that opaque proof to the provider. This slice supplies no Authentication implementation and does not inspect claims.

## Client integration

Mobile presents a read-only Transport Status screen showing connection state, provider, queue size, pending batch count, retry count, and last successful synchronization. React owns only presentation.

Desktop exposes status and lifecycle operations through the existing Shell API and IPC adapter. Existing Desktop behavior remains unchanged because Transport starts idle and never uploads until explicitly connected and synchronized.

## Verification scope

Tests cover lifecycle, deterministic batching, operation ordering, partial acknowledgements, exponential retry, reconnect, durable restoration, and two logical replicas exchanging and replaying an operation exactly once through the shared loopback hub.

## Deferred

- Authentication providers and login
- HTTP, WebSocket, Cloud, LAN, Bluetooth, and USB providers
- Encryption and compression
- Background connectivity APIs
- Server-side cursors and retention policy
- Conflict-resolution policy and collaboration
