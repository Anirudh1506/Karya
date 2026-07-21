# ADR-0002: Karya Cloud as Replication Infrastructure

- **Status:** Accepted
- **Date:** 2026-07-13
- **Decision owners:** Karya Platform
- **Supersedes:** None
- **Related:** [ADR-0001: Platform-First Architecture](./ADR-0001-platform-first-architecture.md)

## Context

Karya now has a stable local-first platform: shared Core, local persistence, immutable synchronization operations, deterministic replay, Account identity, trusted Device membership, and a protocol-neutral Remote Transport Engine.

Cross-device continuity requires durable communication when Devices are not simultaneously online. A conventional Cloud application would make a server database authoritative for Resources, Workspaces, Search, Activity, and other product models. That would create two business-logic implementations, weaken offline behavior, couple clients to network availability, and violate ADR-0001.

Karya needs Cloud infrastructure without turning the Cloud into the product runtime or the user's workspace.

## Decision

Karya Cloud will be an identity-aware replication control plane and immutable operation relay.

It will own:

- Karya Account identity continuity;
- authentication identity associations;
- Device registration, trust, revocation, and replica membership;
- durable idempotent storage of immutable synchronization operations;
- upload, download, cursor, acknowledgement, replay-window, and bootstrap coordination;
- infrastructure retention, recovery metadata, authorization, and observability.

It will not own:

- Resources, Workspaces, Profiles, or their business rules;
- Search, Continue Working, Activity, Notifications, Editing, Capture, or Context Resolution;
- client navigation, UI state, or platform behavior;
- deterministic replay or product conflict resolution.

Every Device remains authoritative for its local state. Shared Karya Core remains authoritative for business behavior. The Cloud stores opaque operation payloads and coordinates authorized delivery between trusted replicas.

The architectural relationship is:

```text
Client Composition Root
        ↓
Karya Core and Synchronization Engine
        ↓
Remote Transport Engine
        ↓
Concrete Cloud Transport Provider
        ↓
Karya Cloud identity, membership, coordination, and operation services
```

Authentication proves a principal. Account determines identity ownership. Device membership grants replica access. These remain separate boundaries.

## Protocol invariants

1. Local commits never require Cloud availability.
2. Operations are immutable and accepted idempotently by stable ID.
3. Only trusted, non-revoked Devices may access an Account operation stream.
4. Upload acknowledgement means durable Cloud acceptance, not global convergence.
5. Download progress advances only after successful client replay acknowledgement.
6. Duplicate upload and redelivery are safe.
7. Core owns replay order, receipts, conflicts, and product application.
8. Cloud services do not interpret or mutate product payloads.
9. New transports and Authentication Providers implement existing abstractions rather than changing Core.
10. Retention must preserve bootstrap and authorized replica recovery.

## Logical service boundaries

Karya Cloud defines five logical ownership boundaries:

- **Authentication Service:** verifies provider proofs and produces normalized principals.
- **Account Service:** owns Account lifecycle, authentication associations, and recovery metadata.
- **Device Service:** owns registration, trust, revocation, capabilities, and replica membership.
- **Operation Service:** owns immutable operation durability, idempotency, ordered retrieval, and retention.
- **Synchronization Service:** owns authorized sessions, batches, cursors, acknowledgements, replay windows, backpressure, and bootstrap selection.

These boundaries do not require an initial microservice deployment. A modular monolith is preferred until scale, reliability, or team ownership provides measurable reasons to separate processes.

## Considered alternatives

### Cloud-authoritative product database

Rejected. It would duplicate Core business logic, create server/client behavioral drift, make offline reconciliation subordinate to server CRUD state, and turn Cloud availability into a product dependency.

### Cloud projections of every product entity

Rejected for the base architecture. Server projections would gradually become an accidental second source of truth. Purpose-specific future services must consume explicit capabilities without redefining synchronization ownership.

### Peer-to-peer synchronization only

Rejected as the sole strategy. It cannot reliably bridge Devices that are never online together, complicates recovery and bootstrap, and provides no durable Account or revocation authority. Peer-to-peer transports may still implement the same Transport Provider contract.

### Protocol-specific synchronization engine

Rejected. Coupling Synchronization directly to HTTP, WebSocket, or a Cloud SDK would prevent other transports and violate the existing Transport boundary.

### Cloud-side business replay

Rejected. It requires the server to understand every Core operation version and would make the Cloud another product client with authoritative pressure. Replay remains on trusted Devices.

## Consequences

### Positive

- Offline behavior remains a first-class guarantee.
- Desktop, Mobile, Tablet, SDK, and Karya OS share one protocol and Core.
- Cloud and client teams have explicit ownership boundaries.
- Duplicate delivery and intermittent connectivity are normal, testable conditions.
- New transport and authentication implementations are replaceable adapters.
- Product evolution does not require matching Cloud entity CRUD changes.
- Device revocation and replica bootstrap have a durable coordination authority.

### Costs and tradeoffs

- Eventual consistency is visible between disconnected Devices.
- The operation log, cursor, acknowledgement, bootstrap, and retention models require disciplined design.
- The Cloud cannot answer arbitrary product queries without an explicitly approved derived capability.
- New clients must host compatible Core replay rather than relying on server-rendered product state.
- Conflict-resolution policy remains a Core concern and must evolve independently.
- Future end-to-end encryption and compaction must preserve server opacity and recoverability.

## Security consequences

- Authentication success does not automatically trust a Device.
- Authorization is scoped to Account and replica membership and is deny-by-default.
- Revocation blocks future Cloud access but cannot guarantee deletion of data already present on a lost Device.
- Logs and metrics must not include operation payloads or reusable authentication proofs.
- Recovery and future key rotation require separate decisions and audits.

## Scalability consequences

- Account operation streams are the natural partition boundary.
- APIs and coordinators should remain stateless over shared durable storage.
- Operation reads and writes must be bounded, append-efficient, and cursor-driven.
- Infrastructure workers may process maintenance asynchronously but cannot weaken durable upload acceptance.
- Retention and checkpointing require a later ADR before destructive compaction.

## Constraints on future decisions

Future Cloud, collaboration, enterprise, AI, Web, and public API work must not:

- introduce server-authoritative product CRUD as the base synchronization path;
- require network availability for locally valid work;
- bypass Device trust for operation access;
- embed authentication-provider identity in operation ownership;
- move deterministic product replay or conflict resolution into Cloud infrastructure;
- couple Synchronization Engine to one transport protocol;
- mutate accepted operations or silently skip unavailable history.

Any proposal that changes these constraints must explicitly supersede this ADR and explain how ADR-0001 remains satisfied.

## Follow-up decisions

Separate ADRs are required for:

- concrete Cloud transport and protocol encoding;
- Authentication Providers and Account-linking policy;
- Device pairing and recovery proof;
- operation-store technology and durability guarantees;
- cursor and replay-window semantics;
- retention, compaction, and client-produced bootstrap checkpoints;
- end-to-end encryption and key rotation;
- multi-region deployment and disaster recovery;
- shared Workspace and collaboration authorization.

## Reference specification

The detailed constitutional contract is [Karya Cloud Architecture Specification v1.0](../architecture/KaryaCloudArchitectureSpecification.md).
