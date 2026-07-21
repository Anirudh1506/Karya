# Karya Account Engine

## Purpose

The Account Engine is Karya's transport-independent identity and trust boundary. It answers who owns local work and which device replicas may participate in synchronization. It does not authenticate users, perform network requests, or move synchronization operations.

## Identity hierarchy

```text
Karya Account
  └─ Trusted Devices / Replica Membership
  └─ Profiles
       └─ Workspaces
            └─ Resources
```

Existing Profile, Workspace, and Resource ownership fields remain backward-compatible. The Account records `profileIds`, which makes ultimate ownership derivable without rewriting existing service APIs or persisted entities.

## Account model

An Account contains an immutable UUID, display name, optional email, creation/update timestamps, monotonically increasing version, active/archive status, Profile membership, and recovery metadata. Archive is modeled; deletion is intentionally unavailable.

Recovery metadata reserves a stable recovery ID, recovery schema version, Account generation, and opaque backup metadata. No recovery workflow or cryptography exists in this slice.

## Device model

The installation UUID previously established by synchronization remains authoritative. Account startup reads or creates the shared `local-device` state and registers that UUID as the current Trusted Device.

Each device records:

- Stable Device ID
- Account ID
- User-facing name
- Platform and version
- Registration and last-seen timestamps
- `trusted`, `untrusted`, or `revoked` state
- Public-key placeholder
- Operation, content, and background sync capability flags

Device lookup uses repository primary keys. Account and Device records persist in indexed SQLite storage on Desktop and the indexed typed-entity store on Mobile.

## Lifecycle

```text
Core boot
  → Device identity restored/generated
  → Account restored or local Account created
  → Current device registered if missing
  → Profile membership restored
  → Synchronization starts with Account authorization
```

Supported operations are Account creation, rename, archive placeholder, current-device registration, arbitrary device registration, rename, trust change, removal, metadata export/import, recovery metadata update, and Profile attachment.

Account and Device UUIDs remain immutable during updates. Account version advances on every Account mutation.

## Replica membership and synchronization

The Account Engine exposes membership and authorization queries. A replica is authorized only when:

1. The Account is active.
2. The Device belongs to the current Account.
3. Device trust is `trusted`.
4. Operation synchronization capability is enabled.

Synchronization consumes this provider before applying operations from another Device. Local operations remain available offline. Account never queues, transports, acknowledges, or replays synchronization operations.

## Authentication boundary

`AuthenticationProvider` returns an identity proof consisting of provider ID, subject, timestamps, and optional claims. No provider implementation is included. Future Email, Passkey, Apple, Google, or enterprise providers prove identity without changing Account Engine ownership or trust APIs.

## Events and Activity

The engine publishes:

- `AccountCreated`
- `AccountUpdated`
- `DeviceRegistered`
- `DeviceRenamed`
- `DeviceRemoved`
- `DeviceTrustChanged`
- `RecoveryMetadataUpdated`

Activity Timeline consumes these events. Notification rules remain unchanged, so routine identity changes do not generate notifications.

## Client integration

Core's Shell API exposes current Account, trusted/current Device, Account and Device rename, Device removal, replica membership, and metadata import/export. Desktop exposes the query and mutation surface through its Shell adapter and IPC bridge.

Mobile provides an Account screen showing Account name/ID, current Device identity/trust, and Trusted Devices. React owns form state and presentation only.

## Persistence and migration

Desktop schema version 6 adds `accounts` and `trusted_devices`. Mobile migration version 4 records the Account capability while reusing its typed entity table. Both share the same Account service contracts.

## Deferred to Remote Transport

- Authentication provider implementations
- Cryptographic device keys and proof verification
- Remote device registration approval
- HTTP/WebSocket or cloud transport
- Server acknowledgements and cursors
- Cross-device metadata exchange
- Recovery execution
- Shared ownership, collaboration, teams, billing, and organizations
