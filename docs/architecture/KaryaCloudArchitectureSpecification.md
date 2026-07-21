# Karya Cloud Architecture Specification

- **Version:** 1.0
- **Status:** Architectural contract
- **Date:** 2026-07-13
- **Decision record:** [ADR-0002: Karya Cloud as Replication Infrastructure](../adr/ADR-0002-karya-cloud-replication-infrastructure.md)

## 1. Vision

Karya Cloud connects trusted Karya replicas. It preserves Account identity, authorizes Device membership, relays immutable synchronization operations, and helps a new Device reconstruct a local replica.

Karya Cloud is not the user's workspace and is not the source of truth for product state. Each Device owns an authoritative local database and continues to create, edit, search, navigate, and restore work without the Cloud. The Cloud makes independently useful local replicas converge when connectivity returns.

The constitutional rule is:

> The Cloud serves the Karya Platform; it does not replace it.

## 2. Goals

Karya Cloud exists to provide:

- durable relay of immutable synchronization operations;
- Account identity continuity across installations;
- registration, trust, revocation, and membership of Devices;
- incremental upload, download, cursor, and acknowledgement coordination;
- deterministic bootstrap of a new local replica;
- bounded recovery metadata for restoring Account access;
- a stable protocol shared by Desktop, Mobile, Tablet, SDK, Karya OS, and future clients;
- operational reliability when Devices connect intermittently or the Cloud is temporarily unavailable.

## 3. Non-goals

Karya Cloud does not own or execute:

- Resource, Workspace, or Profile business rules;
- Continue Working ranking;
- Universal Search indexing or ranking;
- Activity Timeline generation;
- Notification selection or presentation;
- Resource editing, autosave, or edit-session behavior;
- capture behavior;
- context resolution or navigation;
- conflict-resolution algorithms;
- collaborative presence or remote cursors;
- AI reasoning or categorization;
- client UI state;
- local file content access;
- client platform capabilities.

The Cloud may retain opaque operation payloads that describe these capabilities, but it must not interpret those payloads to recreate their business logic.

## 4. Governing principles

### 4.1 Local-first by default

A locally valid action commits locally before network participation. Cloud availability must never be required to create or modify local work after a Device has a usable replica.

### 4.2 Offline-first operation

Devices queue immutable operations while offline. Reconnection resumes from durable local and Cloud cursors instead of rebuilding state or blocking the user.

### 4.3 Immutable synchronization operations

An accepted operation is never edited in place. Corrections are expressed as later operations. Stable operation identity enables idempotency, auditability, retry, and deterministic replay.

### 4.4 Cloud as replication infrastructure

The Cloud stores and relays operations, maintains replica membership, and coordinates delivery. It is not an entity database exposed through remote CRUD semantics.

### 4.5 Eventual consistency

Trusted replicas may temporarily differ. Given the same authorized ordered operation history and compatible Core behavior, replicas converge deterministically.

### 4.6 Transport independence

Cloud semantics are defined above HTTP, WebSocket, QUIC, LAN, or any other carrier. A concrete provider implements the existing `TransportProvider` contract; it does not change synchronization semantics.

### 4.7 Deterministic replay

Core owns replay ordering, receipts, conflict hooks, and entity application. The Cloud preserves sufficient ordering metadata but never performs product replay on behalf of a client.

### 4.8 Trust through identity

Authentication proves an external identity claim. Account identity determines ownership. Device trust determines replica authorization. These are separate decisions and must remain separate services.

### 4.9 Minimal server intelligence

The server understands Accounts, Devices, replica membership, operation envelopes, cursors, acknowledgements, retention, and protocol compatibility. It does not understand product payload semantics.

### 4.10 Client-owned business logic

Shared Karya Core remains the only implementation of product behavior. Every client presents and composes Core capabilities as required by ADR-0001.

## 5. Architectural invariants

Every implementation must preserve these invariants:

1. A Device can perform locally valid work without contacting the Cloud.
2. Cloud acceptance never substitutes for a successful local commit.
3. An operation ID is globally stable within Karya and accepted idempotently.
4. Operations are scoped to one Account and attributed to one registered Device replica.
5. Only authorized, non-revoked Devices may upload or download an Account's operations.
6. Cloud ordering metadata never replaces Core's deterministic replay order.
7. Upload acknowledgement means durable Cloud acceptance, not convergence on every Device.
8. Download acknowledgement advances delivery only after the client reports successful replay.
9. The Cloud does not mutate operation payloads.
10. Revocation prevents future access without silently rewriting local history.
11. Authentication identity, Karya Account identity, and Device trust remain distinct.
12. A new transport or authentication provider must not require changes to Karya Core business APIs.

## 6. System context

```text
Desktop      Mobile      Tablet      SDK      Karya OS
    \          |           |          |          /
     +---------+-----------+----------+---------+
                           |
                 Transport Provider
                           |
                   Cloud API Layer
                           |
        +------------------+------------------+
        |                  |                  |
 Authentication      Account/Device    Sync Coordinator
        |                  |                  |
        +------------------+---------+--------+
                                     |
                              Operation Store
                                     |
                       Workers / Observability / Recovery
```

All clients use the same Account, Synchronization, and Transport contracts. Client form factor does not alter the Cloud protocol.

## 7. Component architecture

### 7.1 Client replicas

Desktop, Mobile, Tablet, SDK hosts, and Karya OS are full local replicas when their capability set permits it. Each owns:

- a local SQLite database or equivalent persistence adapter;
- Karya Core and deterministic replay;
- the local operation queue and replay receipts;
- product-derived state and indexes;
- context, continuity, and presentation;
- a platform-specific Transport Provider implementation.

Thin future surfaces such as widgets may use constrained SDK capabilities, but they still invoke Core or a trusted host rather than reimplement business rules in the Cloud.

### 7.2 Transport layer

The existing Remote Transport Engine owns connection lifecycle, batching, retry, upload, download, and acknowledgements. A future Cloud Transport Provider translates its protocol-neutral operations into a concrete carrier.

The provider is responsible for protocol framing and connectivity. It does not rank operations, replay payloads, authorize product behavior, or resolve conflicts.

### 7.3 Cloud API layer

The API layer is a stateless ingress boundary. It:

- validates protocol compatibility and request shape;
- obtains an authentication proof where required;
- resolves Account and Device authorization;
- applies request limits and backpressure;
- delegates identity, membership, operation, and synchronization work to logical services;
- returns opaque cursors and acknowledgements.

No product entity endpoints are part of this architecture.

### 7.4 Authentication Service

Authentication verifies proofs issued by configured providers and maps provider subjects to Account access claims. It owns authentication sessions and proof validation, not Karya Account data or Device trust.

Future providers may include Passkeys, Apple, Google, Microsoft, and enterprise SSO. Provider addition must not change Account identifiers or synchronization operation identity.

### 7.5 Account Service

Account Service owns the durable Cloud representation of Karya Account identity:

- stable Account identity and lifecycle status;
- associations to authentication identities;
- replica ownership boundary;
- recovery metadata and Account generation;
- policy references governing Device registration and retention;
- administrative Account suspension or recovery state.

It does not own Profiles or product data. Profiles remain client-side organizational contexts associated with the Account through synchronized Core state.

### 7.6 Device Registry

Device Registry owns:

- stable Device and replica membership identity;
- registration and pairing state;
- trust, revocation, and removal state;
- capability declarations and protocol compatibility;
- last-seen and last-acknowledged progress metadata;
- authorization to access a particular Account operation stream.

Device capability flags describe what a replica can transport or apply. They must not be used to move business rules to the server.

### 7.7 Operation Store

Operation Store is an append-oriented durable log of immutable operation envelopes. It owns:

- idempotent acceptance by stable operation ID;
- association with Account, originating Device, and logical sequence;
- ordering metadata sufficient for deterministic delivery;
- cursor-addressable reads;
- operation retention and tombstone preservation;
- replay-window support;
- durable upload acceptance state.

Operation payloads are opaque to the service. The store must not project Resources, Workspaces, Search documents, Activities, or Notifications into server-owned product models.

### 7.8 Synchronization Coordinator

Synchronization Coordinator orchestrates protocol progress without owning replay logic. It:

- authorizes an upload or download session;
- selects an Account operation stream and bounded replay window;
- coordinates batch acceptance and partial acknowledgements;
- issues and validates opaque cursors;
- tracks delivery progress per replica;
- coordinates bootstrap and incremental synchronization;
- applies backpressure and retry-safe session semantics;
- identifies when a replica requires a bootstrap rather than an incremental window.

It never creates business operations or decides how an operation changes product state.

### 7.9 Background workers

Workers perform infrastructure maintenance such as retention evaluation, stale-session cleanup, delivery bookkeeping, audit export preparation, and future bootstrap artifact generation. They consume infrastructure events, not product events, and must remain retry-safe.

## 8. Responsibility boundaries

| Capability                   | Client/Core                     | Karya Cloud                        |
| ---------------------------- | ------------------------------- | ---------------------------------- |
| Local transaction            | Owns                            | Does not participate               |
| Operation creation           | Owns                            | Never creates product operations   |
| Product validation           | Owns                            | Does not inspect payload semantics |
| Replay and receipts          | Owns                            | Delivers ordered windows           |
| Conflict detection           | Owns                            | Retains relevant operations        |
| Conflict resolution          | Future Core policy              | Does not decide                    |
| Account identity             | Maintains local representation  | Preserves cross-device identity    |
| Authentication               | Requests proof through provider | Verifies proof and maps access     |
| Device trust                 | Presents and records intent     | Enforces replica membership        |
| Upload acceptance            | Queues and sends                | Durably accepts idempotently       |
| Download progress            | Replays and acknowledges        | Tracks cursor and delivery         |
| Search and derived views     | Owns                            | Does not build                     |
| Availability without network | Guarantees local use            | Cannot be required                 |

## 9. Identity and authorization model

### 9.1 Authentication identity

An authentication identity is an assertion from an external or first-party Authentication Provider. It answers: “Which principal proved access?” It may change providers without changing the Karya Account ID.

### 9.2 Karya Account

The Account is the stable ownership boundary for replica membership and the operation stream. It answers: “Which Karya identity owns these replicas?”

An Account may have multiple authentication identities over time. Authentication linkage changes must be auditable and must not rewrite operation ownership.

### 9.3 Device identity

A Device is a registered installation and logical synchronization replica. Its identity extends the existing persistent installation ID. Reinstallation or explicit reset creates a new replica identity unless a defined recovery flow proves continuity.

### 9.4 Replica membership

Replica membership binds a Device to an Account with trust state, authorization state, capability flags, and lifecycle metadata. Membership, not possession of an Account ID, grants stream access.

### 9.5 Authorization decision

Every Cloud synchronization action is authorized against:

- a valid Account state;
- a verified authentication or established Device session appropriate to the action;
- a registered, trusted, non-revoked Device;
- requested operation stream ownership;
- protocol and capability compatibility;
- applicable recovery or administrative restrictions.

Product payload contents are not part of the authorization decision.

## 10. Authentication provider boundary

Cloud Authentication uses a provider abstraction corresponding to the existing client-side `AuthenticationProvider` boundary. A provider proves identity; Account Service maps that proof to Account access.

Provider implementations may differ in challenge, session, or assertion mechanics, but must normalize into a provider-neutral identity result. The normalized result must not leak provider-specific identifiers into synchronization operations or Device IDs.

Authentication does not automatically trust a new Device. A successfully authenticated Device remains pending until Account policy, a trusted Device, or recovery authorizes its membership.

## 11. Synchronization protocol

The protocol is conceptual and transport-neutral. Concrete endpoint design is intentionally deferred.

### 11.1 Session establishment

1. The client Transport Provider connects.
2. Authentication proof is requested when the session or operation requires it.
3. The Cloud resolves Account and Device membership.
4. Protocol version and replica capabilities are negotiated.
5. The coordinator returns authorized stream context and current session constraints.

Connection success does not imply synchronization success.

### 11.2 Upload

```text
Local pending operations
        ↓
Deterministic client batch
        ↓
Cloud authorization
        ↓
Idempotent operation acceptance
        ↓
Per-operation acknowledgement
        ↓
Local acknowledgement update
```

Upload rules:

- operation order in the submitted batch is preserved;
- the Cloud validates envelope ownership and sequencing without interpreting payloads;
- an already accepted operation ID is acknowledged as accepted, not duplicated;
- valid operations may be acknowledged even when another operation in the batch is rejected or deferred;
- unacknowledged operations remain pending locally;
- acceptance means the Cloud durably owns relay responsibility under its retention policy;
- acceptance does not mean another replica has replayed the operation.

### 11.3 Download

```text
Replica cursor
      ↓
Authorized replay window
      ↓
Ordered operation batches
      ↓
Core deterministic replay
      ↓
Replay receipts
      ↓
Download acknowledgement and cursor advance
```

The client advances its durable Cloud cursor only after local replay and receipt persistence succeed. If replay fails, the same window can be delivered again. Local replay receipts make this idempotent.

### 11.4 Cursors

Cursors are opaque protocol tokens representing a position in one Account stream for one compatible replay view. Clients must not parse, synthesize, or compare their internal values.

A cursor is not proof of authorization. It is validated again whenever used. Expired or compacted cursors trigger a bounded recovery or bootstrap response rather than undefined gaps.

### 11.5 Acknowledgements

The protocol distinguishes:

- **upload acceptance:** operations durably accepted by the Cloud;
- **download replay acknowledgement:** operations durably replayed by a Device;
- **session progress:** cursor and replay-window progress;
- **replica convergence:** an observable condition derived from acknowledgements, never inferred from upload alone.

Acknowledgements are idempotent and may be partial.

### 11.6 Retry semantics

- Clients retain pending operations until explicit acceptance.
- Lost upload responses cause safe duplicate submissions by operation ID.
- Lost download acknowledgements cause safe redelivery.
- Retry uses bounded exponential backoff with jitter in concrete providers.
- Server backpressure may extend retry timing but must not discard accepted operations.
- Exhausted retry leaves the client usable offline and the queue intact.

### 11.7 Replay semantics

The Cloud provides authorized immutable operations and ordering metadata. Core:

- applies its deterministic comparison order;
- checks dependency and replay receipts;
- validates Device authorization through Account membership;
- detects and records conflicts;
- applies supported operations;
- records durable replay completion.

The Cloud never reports product convergence by replaying operations itself.

### 11.8 Partial synchronization

Synchronization is bounded by batch size, operation count, payload budget, and replay window. A Device may make progress across many sessions. Partial completion is normal and must leave both local queue and Cloud cursor consistent.

Capability-constrained replicas may receive only protocol-supported envelopes, but filtering must be explicit, stable, and represented in cursor semantics. Filtering by product meaning is prohibited in the base architecture.

### 11.9 Initial bootstrap

```text
Install Karya
      ↓
Authenticate or create Account
      ↓
Register Device as pending
      ↓
Approve trust or complete recovery
      ↓
Request replica bootstrap
      ↓
Download authorized operation history or opaque checkpoint plus tail
      ↓
Core replays locally
      ↓
Persist receipts and cursor
      ↓
Local database becomes ready
```

The first implementation may bootstrap from retained operation history. Future scale may require a client-produced opaque checkpoint followed by an immutable operation tail. The Cloud may store and deliver such an artifact but must not generate product state by interpreting operations.

Bootstrap is complete only after the client has committed its local database and acknowledged the resulting cursor. Interrupted bootstrap restarts from durable local progress or a fresh bootstrap boundary.

## 12. Device lifecycle

### 12.1 New Device

1. Installation creates a stable local Device ID.
2. Authentication associates the installation with an Account request.
3. Device Registry records pending membership and capabilities.
4. The Device cannot access the Account operation stream yet.
5. A trusted authorization path approves or rejects it.

### 12.2 Trusted Device

A trusted Device may upload and download within its Account scope. It maintains last-seen and replay progress metadata. Trust does not authorize administrative operations beyond explicit Account policy.

### 12.3 Pairing

Pairing authorizes pending membership. The architecture permits approval by an existing trusted Device or a recovery flow. Pairing must bind the exact pending Device identity and Account and must be auditable. Concrete challenge or cryptographic mechanics are deferred.

### 12.4 Device removal

Removal ends active membership and prevents future sessions. Historical operation attribution remains intact. A removed Device can be registered again only as a new or explicitly recovered membership.

### 12.5 Lost Device

A user marks the Device lost through another trusted Device or recovery flow. The Cloud revokes its future stream access and invalidates active sessions. Other Devices continue operating. Local data already present on the lost Device cannot be remotely assumed erased.

### 12.6 Revoked Device

Revocation is immediate for new Cloud authorization decisions and monotonic unless an explicit recovery policy creates a new membership. Revoked Device operations already accepted remain in history; later uploads from that Device are rejected.

Future encryption and key rotation may make post-revocation payloads inaccessible to old keys, but that is not defined here.

## 13. Multi-Device Continuity

Cross-device consistency is produced by Core replay, not server projections.

### 13.1 Resources and Workspaces

Immutable Resource, content, Profile, and Workspace operations converge through deterministic replay. The Cloud does not store a canonical Resource row or Workspace tree.

### 13.2 Continue Working

Continue Working remains a Core-derived view. After relevant Resource and context operations replay, each Device deterministically rebuilds the items visible to its current context. Device-local activity may affect recency until those inputs are represented by synchronizable operations.

### 13.3 Edit Sessions

Committed or autosaved Resource content moves as synchronization operations. Transient cursor position, keyboard state, and an actively open editor remain Device-local. A second Device resumes the latest durable content; live concurrent editing is deferred to a future collaboration protocol.

### 13.4 Activity

Activity is generated locally from meaningful Core events. Replaying a remote product operation produces the appropriate local history record. Low-level transport events do not become user Activity. Exact diagnostic chronology may differ by Device while product history remains attributable to the originating operation.

### 13.5 Notifications

Notifications remain locally derived from Activity and current context. Synchronizable notification lifecycle state, when supported by Core, travels as operations. Karya Cloud does not decide which Activities deserve attention.

### 13.6 Context and navigation

Each Device owns active navigation and ephemeral UI state. Durable context needed for continuity may synchronize only when represented by an explicit Core operation. The Cloud never selects the Profile, Workspace, or Resource a user should open.

## 14. Conflict model

### 14.1 Detection

Core detects conflicts during replay using operation dependencies, local timestamps or versions, replay receipts, and supported-operation rules. The Cloud may detect envelope-level protocol violations such as invalid Device sequence or incompatible history, but these are not product conflicts.

### 14.2 Recording

Conflict records remain local Core data and refer to immutable operations. The operation history required to investigate a conflict is retained according to Cloud policy.

### 14.3 Resolution

Conflict-resolution algorithms are intentionally deferred. Future resolution must be implemented as deterministic Core policy and, where it changes shared state, emit new immutable operations. The Cloud must not silently choose a Resource or Workspace winner.

## 15. Failure model

### 15.1 Offline Device

Local work continues. Operations accumulate in SQLite. Transport reports offline state and later reconnects from durable progress.

### 15.2 Cloud downtime

Clients remain locally operational. No accepted local action is rolled back. Upload and download resume idempotently when service returns.

### 15.3 Partial upload

The Cloud acknowledges accepted operation IDs individually. The client retains and retries only unfinished operations. Batch identity is diagnostic; operation identity defines idempotency.

### 15.4 Duplicate upload

The Operation Store returns the original acceptance outcome for an existing operation ID after verifying compatible ownership. It never appends a second logical operation.

### 15.5 Lost upload acknowledgement

The client retries. Idempotent acceptance returns acknowledgement without duplication.

### 15.6 Failed local replay

The Device does not advance its durable download cursor. It records a Core failure or conflict and may retry the same operations after recovery.

### 15.7 Lost download acknowledgement

The Cloud may redeliver the window. Replay receipts prevent duplicate entity application. The next valid acknowledgement advances progress.

### 15.8 Expired cursor

The coordinator offers a retained replay boundary or requires bootstrap. It never skips silently to the latest position.

### 15.9 Revocation during a session

Authorization is re-evaluated at bounded protocol boundaries. The session is terminated, unfinished requests fail safely, and locally queued work remains local.

### 15.10 Region or storage failure

Durable acceptance must survive the failure modes promised by the deployed service tier. If durability cannot be guaranteed, the Cloud must not acknowledge upload acceptance.

## 16. Security architecture

### 16.1 Trust boundaries

The principal boundaries are:

- external Authentication Provider to Authentication Service;
- unauthenticated client to Cloud ingress;
- authenticated principal to Account authorization;
- registered Device to trusted replica membership;
- transport session to operation stream;
- Cloud services to durable infrastructure;
- operational staff and tooling to user metadata and payloads.

Every boundary requires explicit authentication, authorization, auditing, and least privilege appropriate to its role.

### 16.2 Device trust

Authentication alone does not create trust. Device Registry enforces pending, trusted, removed, lost, and revoked states. Trust changes are Account-scoped, auditable, and monotonic where revocation safety requires it.

### 16.3 Authorization

Authorization is deny-by-default. Service calls carry Account and Device scope rather than trusting caller-supplied identifiers. Operation upload verifies origin membership; download verifies destination membership.

### 16.4 Recovery

Recovery restores control of Account identity and permits a new Device authorization path. Recovery metadata is versioned and auditable. A recovery event may increment Account generation, revoke sessions, or require Device review according to future policy. Recovery must not rewrite product operation history.

### 16.5 Future encryption

The architecture reserves opaque payloads, Device public-key placeholders, Account generation, and capability negotiation for future end-to-end encryption. No cryptographic algorithm, key hierarchy, or custody model is selected in version 1.0.

Future encryption must preserve offline creation, immutable operation identity, server opacity, Device revocation, bootstrap, and provider independence.

### 16.6 Future key rotation

Key rotation will be an Account and Device membership concern coordinated through versioned metadata. It must not require the Cloud to understand product payloads. Revocation and recovery are explicit triggers to evaluate, but mechanics remain deferred.

### 16.7 Data minimization

Cloud services retain only identity metadata, Device membership, operation envelopes and opaque payloads, protocol progress, recovery metadata, and necessary operational audit data. Logs and metrics must exclude payload content and sensitive authentication proofs.

## 17. Scalability architecture

### 17.1 Stateless service tier

API and coordination processes remain stateless between requests. Durable session, membership, cursor, and operation state lives in shared storage. Instances scale horizontally behind a load-distribution layer.

### 17.2 Partitioning

The natural consistency and sharding boundary is the Account operation stream. Account-based partitioning keeps authorization and ordered reads local to a partition while allowing different Accounts to scale independently.

Large Accounts may use stable subpartitions, but any subdivision must preserve a deterministic merged replay view and opaque cursor semantics.

### 17.3 Millions of operations

The Operation Store requires append-efficient writes, indexed idempotency checks, bounded cursor reads, and retention-aware compaction. Clients consume bounded windows and apply backpressure rather than requesting unbounded histories.

### 17.4 Event queues

Infrastructure events may decouple acceptance from non-critical maintenance, metrics, retention evaluation, and future bootstrap artifact generation. Durable upload acknowledgement must not depend on eventually processed work required for basic operation recovery.

### 17.5 Retention

Retention considers active Device acknowledgements, revoked or stale membership policy, recovery windows, tombstones, legal obligations, and bootstrap availability. An operation cannot be removed merely because one Device acknowledged it.

Compaction may replace an old replay prefix with a verifiable opaque client-produced checkpoint and retained tail. Product semantics remain outside the server.

### 17.6 Object storage

Future large opaque bootstrap artifacts and attachments may use object storage. Metadata references remain Account-scoped and authorized. Object storage does not become a browsable user workspace or product database.

### 17.7 Multi-region evolution

Initial deployment may assign an Account stream to a home region. Later replication can provide disaster recovery and locality. The system must avoid presenting conflicting accepted order for one Account stream. Exact topology and consistency technology are deployment decisions, not protocol changes.

## 18. Logical service boundaries

These are ownership boundaries, not a requirement for five independently deployed microservices.

### Authentication Service

Owns provider proof verification, normalized principal identity, and authentication sessions. It does not own Accounts or Device trust.

### Account Service

Owns Account lifecycle, authentication associations, recovery metadata, and policy. It does not own product entities.

### Device Service

Owns registration, pairing, trust, revocation, capability, last-seen, and replica membership. It does not own synchronization operations.

### Operation Service

Owns idempotent immutable operation persistence, ordered retrieval, retention, and opaque payload durability. It does not replay operations.

### Synchronization Service

Owns authorized synchronization sessions, replay windows, cursors, upload/download coordination, acknowledgements, bootstrap selection, and backpressure. It delegates identity to Account and Device services and storage to Operation Service.

A modular monolith is an acceptable first deployment if code ownership and data access follow these boundaries. Services should separate operationally only when scale, reliability, or organizational ownership justifies it.

## 19. Deployment architecture

```text
                 Load distribution / ingress
                            |
                 Stateless Cloud API instances
                            |
       +--------------------+--------------------+
       |                    |                    |
 Identity storage    Operation storage    Coordination state
       |                    |                    |
       +--------------------+--------------------+
                            |
                 Background worker processes
                            |
          Metrics / logs / traces / audit / alerts
                            |
                Future opaque object storage
```

### 19.1 API layer

The API layer terminates concrete transports, applies admission control, resolves authorization, and delegates to logical services. It is horizontally scalable and replaceable without changing the Cloud protocol contract.

### 19.2 Databases

Identity and operation workloads have different access patterns and may use separate durable stores. Technology selection is deferred. Required qualities are transactional membership updates, idempotent operation acceptance, ordered bounded reads, durable cursor state, backup, and recovery.

### 19.3 Workers

Workers process retry-safe infrastructure jobs. No worker executes client business rules or changes a Resource based on payload interpretation.

### 19.4 Object storage

Object storage is deferred for opaque bootstrap artifacts, attachments, and other large blobs. Authorization remains mediated by Account and Device membership.

### 19.5 Observability

Production deployment includes:

- service health and dependency health checks;
- request rate, latency, error, and saturation metrics;
- operation acceptance and delivery lag metrics;
- queue depth, replay-window, retry, and bootstrap metrics;
- Device authorization and revocation audit signals;
- structured logs with correlation identifiers and no product payloads;
- distributed traces across infrastructure service boundaries;
- alerts for durability, authorization, backlog, and cursor integrity failures.

### 19.6 Health semantics

Liveness indicates a process can make progress. Readiness indicates it can safely serve its role, including required authorization and durable storage dependencies. A service that cannot durably accept an operation must not report upload readiness.

## 20. Platform integration

### 20.1 Desktop

Desktop provides a Cloud Transport Provider and Authentication Provider through its composition root. It continues using the same Core, Account, Synchronization, and local persistence packages.

### 20.2 Mobile and Tablet

Mobile and future Tablet clients use native connectivity and credential adapters behind the same provider contracts. Background execution limits affect scheduling, not synchronization semantics.

### 20.3 SDK

The SDK exposes Account, Device, and synchronization capabilities through stable Core APIs. Integrators do not call Cloud product CRUD APIs because none exist.

### 20.4 Karya OS

Karya OS treats Cloud as a platform transport and identity service. System surfaces, widgets, and automation consume the same local Core state and operation stream.

### 20.5 Protocol compatibility

All clients declare protocol and operation capability versions. The Cloud negotiates infrastructure compatibility; Core decides whether an operation type is supported. Incompatible replicas fail explicitly or bootstrap through a supported boundary. The Cloud does not transform product payloads between Core versions.

## 21. Future evolution

### Shared Workspaces and Teams

Future sharing adds membership principals and operation-stream authorization scopes. It must not turn Resources into server-owned CRUD records. Shared stream policy extends Account/Device authorization rather than bypassing it.

### Collaboration and real-time editing

Presence and live editing require a separate ephemeral collaboration channel plus durable Core operations. Presence is not added to the immutable operation log merely because it is networked.

### AI Cloud Services

AI services require explicit user authorization and data-boundary decisions. They consume deliberate capability APIs or approved opaque data flows; they do not become the synchronization authority.

### Enterprise and SSO

Enterprise adds organization policy, managed identities, retention controls, audit, and deployment options. Enterprise policy may constrain Account and Device membership without moving client business logic to the server.

### Web client

A future Web client must host compatible Core and local persistence or explicitly act as a constrained replica. It may not use server-side product projections as a shortcut that forks behavior.

### Public APIs and automation

Public APIs should enter through an SDK or trusted automation replica that emits the same immutable Core operations. Direct mutation of Cloud operation storage is prohibited.

## 22. Constraints

- No server-owned product entity model.
- No requirement for connectivity to perform local work.
- No authentication-provider identity embedded in operation ownership.
- No Device trust implied solely by successful login.
- No mutation or semantic filtering of operation payloads by the Cloud.
- No cursor advance before successful local replay acknowledgement.
- No irreversible retention policy before bootstrap and recovery guarantees are defined.
- No concrete transport coupled to Synchronization Engine.
- No cloud-specific business behavior in Desktop, Mobile, SDK, or Karya OS.
- No cryptographic implementation selected by this specification.
- No assumption that logical services must initially be separate deployments.

## 23. Implementation sequence

Future implementation should proceed in vertical infrastructure slices:

1. Define versioned Cloud protocol envelopes and compatibility rules.
2. Implement one Cloud Transport Provider against a local or test server.
3. Implement Authentication Provider verification behind the existing boundary.
4. Implement Account and pending Device registration.
5. Implement trusted Device pairing and revocation.
6. Implement idempotent operation upload and per-operation acknowledgement.
7. Implement cursor-based download and replay acknowledgement.
8. Implement full-history bootstrap and restart recovery.
9. Validate two physical clients through failure and duplicate-delivery scenarios.
10. Add production observability, backup, retention safeguards, and scale tests.

Each slice must preserve offline behavior and pass existing local platform verification.

## 24. Acceptance criteria for future implementations

An implementation conforms to this specification when:

- a Device can work throughout Cloud downtime;
- a local operation is never lost because an upload response is lost;
- duplicate upload and download are harmless;
- an untrusted or revoked Device cannot access an Account stream;
- a trusted new Device can bootstrap a complete local replica;
- two compatible trusted replicas converge through Core replay;
- Cloud services do not import or duplicate product business logic;
- Desktop, Mobile, SDK, and Karya OS can use the same protocol;
- adding a transport or authentication provider does not alter Core APIs;
- operational logs and metrics do not expose product payloads;
- retention cannot create an unrecoverable gap for an authorized active replica.

## 25. Open decisions intentionally deferred

The following require their own ADRs before implementation:

- concrete Cloud transport and protocol encoding;
- Authentication Provider priority and Account-linking policy;
- Device pairing proof and recovery procedure;
- operation storage technology and durability tier;
- cursor encoding and replay-window limits;
- retention, compaction, and opaque checkpoint policy;
- end-to-end encryption and key management;
- attachment and object-storage model;
- multi-region consistency and disaster-recovery targets;
- shared Workspace authorization model;
- service-level objectives and commercial tiers.

These decisions may refine implementations but may not violate the invariants in this specification or ADR-0002.
