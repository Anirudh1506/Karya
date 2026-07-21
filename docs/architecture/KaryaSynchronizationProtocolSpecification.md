# Karya Synchronization Protocol Specification

- **Protocol:** KSP
- **Version:** 1.0
- **Status:** Architectural contract
- **Date:** 2026-07-14
- **Related decisions:** [ADR-0001: Platform-First Architecture](../adr/ADR-0001-platform-first-architecture.md), [ADR-0002: Karya Cloud as Replication Infrastructure](../adr/ADR-0002-karya-cloud-replication-infrastructure.md)
- **Related architecture:** [Synchronization Engine](./synchronization-engine.md), [Remote Transport Engine](./RemoteTransportEngine.md), [Karya Account Engine](./KaryaAccountEngine.md), [Karya Cloud Architecture Specification](./KaryaCloudArchitectureSpecification.md)

## 1. Purpose

The Karya Synchronization Protocol (KSP) is the transport-independent contract by which trusted Karya replicas exchange immutable synchronization operations.

KSP answers one question:

> How do trusted Karya replicas communicate without exposing product semantics?

The protocol standardizes sessions, identity context, capability negotiation, operation exchange, acknowledgements, replay progress, recovery, and compatibility. It does not standardize how Resources, Workspaces, Profiles, or other product capabilities behave.

HTTP, WebSocket, QUIC, LAN, Bluetooth, USB, loopback test providers, and future transports may encode and carry KSP differently. They must preserve the same messages and semantics.

This specification intentionally defines no HTTP routes, REST resources, GraphQL operations, JSON schemas, Protocol Buffer definitions, binary layouts, cryptographic algorithms, client code, or server code.

## 2. Normative language

The terms **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** describe protocol requirements.

- **MUST / MUST NOT:** required for KSP v1.0 conformance.
- **SHOULD / SHOULD NOT:** expected unless a documented transport constraint justifies deviation without breaking protocol invariants.
- **MAY:** optional behavior whose absence does not break conformance.

Examples and diagrams are explanatory. The normative rules in prose take precedence.

## 3. Goals

KSP is:

- **deterministic:** the same compatible inputs produce the same ordering and progress decisions;
- **versioned:** peers identify the protocol contract they implement;
- **replay-safe:** redelivery cannot apply an operation twice;
- **idempotent:** repeated requests and acknowledgements have stable outcomes;
- **transport-neutral:** protocol meaning does not depend on a carrier;
- **resumable:** durable progress survives disconnects and process restarts;
- **incremental:** peers exchange bounded windows rather than rebuilding all state;
- **extensible:** capabilities and optional fields can evolve independently;
- **backward-compatible:** compatible older implementations continue safely;
- **offline-first:** a disconnected replica remains locally useful;
- **local-first:** each Device owns its local state and Core owns product behavior;
- **product-agnostic:** infrastructure transports opaque operations, not product commands.

## 4. Non-goals

KSP does not define:

- product entities, commands, projections, or business validation;
- conflict-resolution algorithms;
- Resource content formats;
- authentication providers or login experiences;
- Device-pairing proof mechanisms;
- transport connection mechanics;
- transport encodings or framing;
- compression or encryption algorithms;
- Cloud deployment or storage architecture;
- live collaboration, presence, or remote cursors in v1.0;
- attachment or media transfer in v1.0;
- server-authoritative product state.

## 5. Constitutional invariants

Every conforming implementation preserves these invariants:

1. A locally valid commit never requires a KSP session.
2. KSP carries immutable operation envelopes; it does not carry product behavior.
3. Payloads are opaque to Transport and replication infrastructure.
4. Account and Device scope are authenticated and authorized before stream access.
5. Protocol negotiation completes before synchronization messages are exchanged.
6. Upload acceptance means durable relay acceptance, not replay by another replica.
7. Download progress advances only after durable local replay completion.
8. Duplicate upload, download, receipt, and acknowledgement messages are safe.
9. A cursor is opaque, scoped, and never proof of authorization.
10. Missing history is never silently skipped.
11. Replay order and product conflict handling remain owned by Karya Core.
12. Unknown required behavior fails explicitly; unknown optional behavior is safely ignored or declined.
13. Retry never mutates operation identity or payload.
14. Disconnect never discards locally pending operations or durable replay progress.
15. Transport choice cannot change synchronization meaning.

## 6. Protocol stack

```text
Karya product capabilities
        ↓ create domain events through Core
Karya Core
        ↓ owns business behavior and deterministic application
Synchronization Engine
        ↓ owns operation log, queue, replay, receipts, and conflicts
Remote Transport Engine
        ↓ owns connection lifecycle, batching, retry, and durable progress
Karya Synchronization Protocol (KSP)
        ↓ defines messages and replication semantics
Transport Provider
        ↓ maps KSP to a carrier without changing meaning
HTTP / WebSocket / QUIC / LAN / Bluetooth / USB / Loopback
```

### 6.1 Karya Core

Core creates and applies product behavior. It owns supported operation semantics, dependency validation, replay order, replay receipts, and conflict detection. KSP never invokes product repositories directly.

### 6.2 Synchronization Engine

The Synchronization Engine translates synchronizable Core events into immutable local operations, persists pending state, suppresses replay feedback loops, and applies incoming operations through their owning Core services.

### 6.3 Remote Transport Engine

The Remote Transport Engine drives KSP sessions through a provider. It owns deterministic batching, bounded retry, upload and download orchestration, cursor persistence, and lifecycle integration. It does not inspect operation payloads.

### 6.4 KSP

KSP defines the conceptual messages and the state transitions they cause. KSP is above the carrier and below Karya synchronization orchestration. Its guarantees are independent of request/response, streaming, duplex, peer-to-peer, or store-and-forward delivery.

### 6.5 Transport Provider

A provider maps KSP messages onto its carrier. It may manage sockets, radio sessions, requests, framing, transport authentication, or connectivity APIs. It MUST NOT reinterpret acknowledgement, cursor, replay, or error semantics.

## 7. Participants and terminology

- **Replica:** one persistent Karya installation participating in synchronization.
- **Device:** the Account-owned installation identity associated with a replica.
- **Peer:** either participant in a KSP session.
- **Initiator:** the peer that begins a session.
- **Coordinator:** the peer that authorizes a stream and coordinates exchange. Karya Cloud commonly has this role, but a compatible LAN or peer coordinator may also implement it.
- **Account stream:** the authorized ordered history of operation envelopes for one Account and compatible replay view.
- **Origin replica:** the Device that created an operation.
- **Destination replica:** the Device receiving an operation for replay.
- **Operation:** an immutable synchronization fact created by the Synchronization Engine.
- **Batch:** a bounded ordered collection of operation envelopes.
- **Replay window:** a bounded segment offered to a replica for local replay.
- **Cursor:** an opaque continuation token for an authorized replay view.
- **Upload acceptance:** confirmation that replication infrastructure durably accepted responsibility for an operation.
- **Replay receipt:** durable client evidence that Core has already applied or safely classified an operation.
- **Download acknowledgement:** confirmation that a replay window reached durable local completion.
- **Capability:** a named, versioned optional behavior supported by a peer.

## 8. Session lifecycle

### 8.1 State model

```text
Idle
  ↓ connect
Connecting
  ↓ carrier available
Authenticating
  ↓ identity accepted
Authorizing
  ↓ Account and Device access accepted
Negotiating
  ↓ version and capabilities compatible
Ready
  ↓ exchange requested
Synchronizing
  ↓ bounded progress complete
Ready / Idle
  ↓ carrier lost or session ended
Disconnected
  ↓ resumable reconnect
Connecting
```

A terminal authorization, revocation, or compatibility failure moves the session to **Rejected**. A transient transport, dependency, maintenance, or backpressure condition moves it to **Interrupted**, from which retry is allowed.

### 8.2 Establishment

1. The initiator opens the underlying carrier.
2. Peers exchange connection context and correlation identity.
3. The initiator presents an opaque authentication assertion when required.
4. The coordinator authenticates the principal conceptually.
5. The coordinator authorizes the Account, Device, and requested replica stream.
6. Peers negotiate protocol compatibility.
7. Peers exchange capabilities and operation-version support.
8. The coordinator issues session context and bounded operating constraints.
9. The session becomes ready for upload, download, or bootstrap.

Connection success MUST NOT be treated as authentication, authorization, or synchronization success.

### 8.3 Ready and synchronize cycles

A ready session MAY perform multiple bounded synchronization cycles. Each cycle may upload, download, or do both. A peer MAY return to ready between cycles, wait for a capability update, send a heartbeat, or disconnect cleanly.

KSP does not require a permanently open connection. A request/response provider may create one logical session across several carrier exchanges. A streaming provider may retain one carrier connection. Both preserve the same durable session semantics.

### 8.4 Reconnection

After interruption, a replica reconnects using durable local state:

- pending operations remain pending until upload acceptance;
- the last durably acknowledged download cursor remains authoritative;
- an unacknowledged replay window may be delivered again;
- live transport handles and in-memory session identifiers are not assumed to survive;
- authentication, authorization, and cursor scope are revalidated.

### 8.5 Clean disconnect

A clean disconnect communicates intent and a final diagnostic reason. It does not imply queue completion, convergence, cursor advancement, or Device removal.

## 9. Protocol message model

Every KSP message has conceptual common metadata:

- message type;
- message identifier unique within its sender scope;
- KSP protocol version;
- session identifier when a session exists;
- correlation identifier;
- sender Device or service identity where applicable;
- creation timestamp for diagnostics;
- optional tracing context;
- message-specific body.

Message identifiers support duplicate detection and diagnostics. They do not replace operation IDs, batch IDs, cursor tokens, or acknowledgement IDs.

The timestamp is informational. It MUST NOT be the sole basis for authorization, correctness, ordering, or replay protection.

## 10. Message catalogue

### 10.1 Connection messages

#### Connection Request

Begins a logical session. It identifies the requested KSP version range, replica identity, intended Account scope when known, and correlation context.

#### Connection Accepted

Confirms that session establishment may proceed and supplies a session identifier plus coordinator constraints. It does not authenticate or authorize synchronization.

#### Connection Rejected

Ends establishment with a structured protocol error and retry classification.

### 10.2 Authentication messages

#### Authentication Challenge

Requests a provider-neutral proof appropriate to the deployment. Its contents remain opaque to KSP.

#### Authentication Assertion

Carries the opaque proof and declared provider identity. KSP does not define or inspect provider claims.

#### Authentication Result

Reports conceptual authentication success or failure and any bounded proof-renewal requirement. Success identifies a principal but does not trust a Device.

### 10.3 Authorization messages

#### Authorization Request

Requests access for a Device to an Account stream and declares the requested synchronization role and capabilities.

#### Authorization Result

Accepts or rejects access based on Account state, Device membership, trust, revocation, and scope. Accepted authorization is limited to the session and declared stream context.

### 10.4 Negotiation messages

#### Version Proposal

Declares the sender's supported KSP version range, Core compatibility identity, and supported operation-envelope versions.

#### Capability Declaration

Declares supported named capabilities and versions, including whether each is required or optional for the proposed session.

#### Negotiation Result

Selects one compatible KSP version, an agreed capability set, operation-version constraints, and session limits. If no safe intersection exists, it returns a compatibility error before synchronization begins.

#### Capability Update

Declares a runtime change to an optional capability or limit. It MUST NOT silently change negotiated protocol version, cursor meaning, operation interpretation, or required behavior. Such changes require renegotiation or a new session.

### 10.5 Upload messages

#### Upload Batch

Carries one deterministic ordered batch of immutable operation envelopes. It includes stable batch identity and bounded continuation metadata.

#### Upload Acknowledgement

Reports an outcome for each operation the coordinator evaluated. Outcomes distinguish accepted, already accepted, deferred, and rejected. Accepted and already accepted both permit local upload acknowledgement.

An omitted operation has not been acknowledged and remains pending.

### 10.6 Download messages

#### Download Request

Requests a bounded replay window after an opaque cursor. An absent cursor requests the authorized initial boundary, not an arbitrary latest position.

#### Download Batch

Carries one ordered replay window, its stable batch identity, the prior cursor scope, and an opaque candidate continuation cursor.

#### Download Acknowledgement

Confirms which delivered operations reached durable local replay completion and whether the complete replay window committed. Only complete window acknowledgement permits the coordinator to treat the candidate cursor as Device progress.

### 10.7 Replay messages

#### Replay Receipt Summary

Optionally communicates bounded, product-opaque evidence of already replayed operation IDs or ranges to reduce redelivery and diagnose convergence. Local replay receipts remain authoritative on the replica.

#### Replay Required

Instructs a replica that a bounded window must be replayed or revalidated before incremental continuation can proceed. It never orders Core to bypass receipts or product validation.

### 10.8 Retry and flow-control messages

#### Retry Instruction

Reports a transient condition, the affected message or batch, a retry classification, an optional minimum delay, and whether the same request identity should be reused.

#### Flow Control

Temporarily adjusts negotiated in-flight count, batch count, or payload budget within previously agreed limits. It MUST NOT acknowledge or discard operations.

### 10.9 Liveness messages

#### Heartbeat

Confirms session liveness and MAY carry non-authoritative progress diagnostics. Heartbeats never advance cursors or acknowledge operations.

#### Heartbeat Acknowledgement

Confirms receipt of a heartbeat. Absence may cause transport reconnection but not operation loss.

### 10.10 Bootstrap messages

#### Bootstrap Request

Requests an authorized initial replica boundary for a new or recovering Device, including supported operation versions and checkpoint capability.

#### Bootstrap Response

Selects a full retained replay window or, in a future negotiated capability, an opaque checkpoint plus operation tail. It declares the base boundary and required completion conditions.

#### Bootstrap Progress

Optionally reports durable bounded progress during a multi-window bootstrap. It supports resumption but does not mark the replica ready.

#### Bootstrap Complete

Confirms that Core committed the local replica, replay receipts, and final cursor. Only then is bootstrap complete.

#### Recovery Required

Reports that incremental continuation is impossible and identifies the permitted recovery class: retained replay boundary, fresh bootstrap, Account recovery, client upgrade, or operator intervention.

### 10.11 Session termination messages

#### Disconnect

Closes a session with a normal, transient, or terminal diagnostic reason.

#### Session Revoked

Terminates access because Device or Account authorization is no longer valid. It is terminal for the affected authorization state and MUST NOT be automatically retried with the same trust state.

## 11. Capability negotiation

### 11.1 Negotiated dimensions

Peers declare:

- supported KSP major and minor versions;
- Core compatibility identity;
- supported operation-envelope versions;
- supported product operation type/version pairs without exposing payload semantics;
- supported optional protocol capabilities;
- future compression capability;
- future transport or payload encryption capability;
- bootstrap and checkpoint capability;
- batch, payload, replay-window, and in-flight limits.

### 11.2 Selection

The selected session contract is the highest mutually supported compatible protocol version unless deployment policy selects a lower compatible version. Every required capability MUST have a mutually supported version.

Optional capabilities with no compatible intersection are disabled. Required capability mismatch fails negotiation explicitly.

### 11.3 Core and operation compatibility

Core version is diagnostic and policy input, not a substitute for operation compatibility. Peers MUST declare the operation envelope versions and operation type/version pairs they can safely carry or replay.

A coordinator may transport an opaque operation without understanding its payload, but it MUST NOT offer that operation to a replica that declared it cannot safely receive the envelope version. Product-operation compatibility remains enforced by Core during replay.

### 11.4 Graceful incompatibility

An incompatible peer receives a structured `protocol-version-unsupported`, `capability-unsupported`, or `operation-version-unsupported` error containing the compatible range or upgrade requirement when safe to disclose. No upload, cursor advancement, or partial bootstrap occurs before a compatible contract is established.

## 12. Canonical operation envelope

KSP transports a canonical conceptual envelope with these fields:

| Field                  | Meaning                                                                |
| ---------------------- | ---------------------------------------------------------------------- |
| Operation ID           | Globally stable immutable identity used for idempotency                |
| Account ID             | Ownership and operation-stream scope                                   |
| Origin Device ID       | Replica that created the operation                                     |
| Operation Type         | Stable namespaced product-operation discriminator                      |
| Operation Version      | Version of the operation payload contract                              |
| Device Sequence        | Monotonically increasing logical sequence within the origin replica    |
| Timestamp              | Origin-reported creation time used as deterministic ordering input     |
| Payload                | Opaque immutable product data                                          |
| Dependencies           | Stable operation IDs required or referenced by this operation          |
| Envelope Version       | Version of the KSP operation envelope                                  |
| Capability Requirement | Optional capability/version required to carry or replay this operation |
| Integrity Metadata     | Transport-neutral integrity and future replay-protection hook          |

### 12.1 Identity

Operation ID is permanent. Retries, forwarding, batching, download, and replay MUST preserve it. A duplicate Operation ID with incompatible Account, Device, type, version, sequence, or payload identity is a protocol integrity failure, not a new operation.

### 12.2 Account and Device scope

Account ID scopes authorization and storage. Origin Device ID identifies authorship and replica sequence. Neither identifier is accepted solely because it appears in the envelope; both are verified against authenticated membership.

### 12.3 Sequence

Device Sequence is monotonic within one origin Device. It detects gaps, impossible regressions, and duplicate identity. It is not a global order across Devices.

A gap MAY cause dependency deferral, replay-window expansion, or recovery. It MUST NOT cause silent operation fabrication or skipping.

### 12.4 Timestamp

Timestamp contributes to the existing deterministic Core comparison order. Clock skew is expected. Timestamp MUST NOT independently decide authorization, uniqueness, acceptance, or causal correctness.

### 12.5 Payload opacity

Transport Providers and replication infrastructure MUST treat Payload as opaque bytes or an opaque encoded value. They may enforce negotiated size and integrity constraints. They MUST NOT route, rank, modify, merge, index, or authorize by product content.

### 12.6 Dependencies

Dependencies contain operation identities, not product entity references. Core decides whether dependencies are satisfied and how missing dependencies are recorded. Infrastructure may use dependency presence to defer delivery but MUST NOT resolve product conflicts.

### 12.7 Local-only acknowledgement state

Pending, failed, and acknowledged upload state are local queue metadata and are not part of immutable operation identity. A sender MUST NOT change the envelope when its delivery state changes.

## 13. Deterministic ordering

Within a batch, operations use the established Karya comparison order:

1. timestamp;
2. origin Device ID;
3. Device Sequence;
4. Operation ID.

This provides a total deterministic comparison order, not proof of causality. Dependencies remain explicit. A provider MUST preserve the submitted order. A receiver MAY verify and normalize order before passing operations to Core.

Batch order is stable for the same input set. Rebatching after partial acknowledgement preserves relative operation order. Batch identity may change when membership changes; operation identity never changes.

## 14. Batching and flow control

### 14.1 Bounded batches

Negotiation establishes maximum semantics rather than a universal numeric limit:

- maximum operations per batch;
- maximum encoded payload budget;
- maximum in-flight batches;
- maximum replay-window size;
- optional transport-specific frame limits beneath KSP.

A sender uses the smallest applicable bound. A receiver MAY advertise lower temporary limits through flow control.

### 14.2 Stable batch identity

A batch has stable identity for one submitted membership and order. Batch identity supports correlation and acknowledgement. It is not the idempotency key for individual operations.

### 14.3 Partial upload acknowledgement

An Upload Acknowledgement reports operation-level outcomes. The sender:

1. marks accepted and already-accepted operations durably acknowledged;
2. leaves deferred or omitted operations pending;
3. handles rejected operations according to terminal or recoverable error classification;
4. rebuilds the unfinished remainder in deterministic order;
5. never resends a modified envelope under the same Operation ID.

### 14.4 Incremental continuation

Download uses bounded replay windows and opaque continuation cursors. A receiver may complete one window per session or many. Every committed window is independently resumable.

### 14.5 Backpressure

Backpressure delays new work; it does not revoke prior durable acceptance. A peer may reduce in-flight limits, request a delay, or end a session with a retryable condition. The sender keeps unaccepted operations locally.

## 15. Acknowledgement model

KSP separates four concepts:

| Concept                         | Meaning                                                      | Authority                   |
| ------------------------------- | ------------------------------------------------------------ | --------------------------- |
| Upload acceptance               | Infrastructure durably accepted relay responsibility         | Receiving operation service |
| Local replay receipt            | Core already applied or durably classified one operation     | Destination replica         |
| Download/window acknowledgement | A delivered window reached durable local completion          | Destination replica         |
| Convergence observation         | Known replicas have progressed through a compatible boundary | Derived diagnostic only     |

No one acknowledgement implies another.

### 15.1 Upload acceptance

Upload acceptance is per operation and idempotent. A lost response causes the sender to retry the same Operation ID. The receiver returns the original compatible outcome.

### 15.2 Replay receipt

Core persists a replay receipt after successful application or another defined idempotent completion. Receipt identity is tied to Operation ID. Redelivery checks the receipt before applying product behavior.

### 15.3 Window acknowledgement

A window is completely acknowledged only after all its operations have durable replay outcomes and the local cursor transaction commits. Partial diagnostic progress MAY be reported, but the durable continuation boundary does not advance past an incomplete window.

### 15.4 Acknowledgement loss

Acknowledgement messages may be duplicated or lost. A repeated acknowledgement has the same result. A lost upload acknowledgement triggers re-upload. A lost download acknowledgement triggers possible redelivery. Neither creates duplicate product application.

## 16. Replay model

### 16.1 Ownership

Replay is exclusively owned by Karya Core and the Synchronization Engine. KSP delivers envelopes and progress metadata. It never applies product state.

### 16.2 Replay window

A replay window is a bounded, ordered, authorized segment associated with:

- one Account stream;
- one destination replica;
- one negotiated compatibility view;
- one prior cursor boundary;
- one candidate continuation cursor;
- an expiration or recovery policy.

### 16.3 Replay procedure

For each delivered operation, the destination:

1. verifies envelope integrity and Account scope;
2. verifies origin Device authorization as required by Account policy;
3. checks the local replay receipt;
4. checks supported envelope and operation versions;
5. evaluates declared dependencies;
6. passes the operation to Synchronization/Core replay;
7. persists its replay receipt or structured conflict/failure outcome;
8. commits complete window progress;
9. sends download acknowledgement.

### 16.4 Duplicate suppression

Operation ID plus durable replay receipt is the duplicate-suppression boundary. Batch ID, session ID, cursor, timestamp, and Device Sequence are insufficient substitutes.

### 16.5 Dependency handling

If a dependency is absent:

- the receiver MAY defer the dependent operation within the bounded window;
- the receiver MAY request an earlier or expanded replay window;
- Core MAY record a missing-dependency conflict;
- the receiver MUST NOT invent the dependency or silently mark the dependent operation successfully replayed.

Cycles, permanently unavailable dependencies, and unsupported historical operations result in structured recovery or Core conflict handling.

### 16.6 Partial replay

Partial replay progress may be persisted locally. Cursor advancement occurs only at a complete safe boundary. Following interruption, the same window may be requested again; receipts make already completed operations no-ops.

## 17. Cursor model

### 17.1 Opacity

A cursor is an opaque token. Clients MUST NOT parse, compare, increment, synthesize, shorten, or infer product state from it.

### 17.2 Scope

A cursor is scoped to:

- Account stream;
- destination Device or replica membership;
- protocol and compatible replay view;
- applicable retention generation;
- authorization context.

A cursor from one scope is invalid in another.

### 17.3 Continuation

A Download Request presents the last durably committed cursor. A Download Batch offers a candidate next cursor. The client persists it only after complete local replay and acknowledgement conditions are met.

### 17.4 Expiration

A cursor may expire because of retention, compaction, membership change, incompatible protocol evolution, or recovery generation change. Expiration returns `cursor-expired` or `recovery-required`; it never returns an apparently successful later window with a silent gap.

### 17.5 Recovery

On cursor failure, the coordinator selects one of:

- reissue from an available retained boundary;
- replay an expanded retained window;
- perform fresh bootstrap;
- use a future negotiated opaque checkpoint plus tail;
- require Account recovery, upgrade, or operator intervention.

### 17.6 Security

Possession of a cursor grants no access. Authentication, authorization, membership, version, and cursor scope are revalidated on use. Cursors should be treated as sensitive operational metadata even when they reveal no product content.

## 18. Retry model

### 18.1 Retry classes

Errors are classified as:

- **immediate retry safe:** same message may be repeated without delay;
- **delayed retry safe:** retry after a supplied or locally computed delay;
- **reconnect required:** establish and negotiate a new session, then resume from durable state;
- **recovery required:** incremental retry cannot succeed;
- **terminal until state changes:** authorization, revocation, or compatibility must change first;
- **non-retryable:** the request or envelope is invalid.

### 18.2 Hints

A retryable error MAY provide:

- minimum retry delay;
- suggested backoff class;
- session-reuse or reconnect requirement;
- affected batch or operation IDs;
- resumable cursor or boundary;
- expiry time for the hint.

Hints are advisory except an explicit minimum delay or maintenance boundary, which clients SHOULD honor. Clients impose their own bounded retry policy and lifecycle constraints.

### 18.3 Backoff

Concrete clients use bounded exponential backoff and MAY add jitter. KSP does not prescribe numeric constants. Lifecycle suspension, connectivity state, battery policy, or background execution limits may defer retries without changing protocol correctness.

### 18.4 Duplicate safety

Retry reuses stable message, operation, and batch identities when the semantic request is unchanged. If batch membership changes after partial acknowledgement, a new batch identity is used while original Operation IDs remain unchanged.

### 18.5 Resumable transfer

KSP resumes at acknowledged operation and cursor boundaries, not arbitrary carrier byte offsets. A transport may additionally resume frames, but KSP correctness never depends on carrier-level resumption.

### 18.6 Exhaustion

Retry exhaustion ends or interrupts the session. Pending local operations and the last durable cursor remain intact. The application continues locally and may retry later.

## 19. Error model

### 19.1 Error envelope

A protocol error conceptually contains:

- stable error code;
- category;
- human-readable diagnostic safe for logs;
- retry classification;
- correlation identifier;
- affected message, batch, operation, or cursor reference when applicable;
- optional compatibility or retry hint;
- optional nested transport diagnostic that does not change KSP meaning.

Errors MUST NOT expose authentication proofs, payload contents, encryption material, or unnecessary user metadata.

### 19.2 Protocol error catalogue

| Error code                      | Category       | Default handling                                       |
| ------------------------------- | -------------- | ------------------------------------------------------ |
| `unauthenticated`               | identity       | Obtain or renew proof, then establish a new session    |
| `unauthorized`                  | authorization  | Terminal until Account or membership state changes     |
| `device-untrusted`              | authorization  | Complete trust flow; do not synchronize                |
| `device-revoked`                | authorization  | Terminate session; do not auto-retry                   |
| `account-unavailable`           | authorization  | Recover or reactivate Account as policy allows         |
| `protocol-version-unsupported`  | compatibility  | Negotiate supported version or upgrade                 |
| `capability-unsupported`        | compatibility  | Disable optional capability or upgrade if required     |
| `operation-version-unsupported` | compatibility  | Defer operation and require compatible Core            |
| `invalid-message`               | protocol       | Do not retry unchanged message                         |
| `invalid-operation-envelope`    | protocol       | Reject affected operation; preserve other outcomes     |
| `operation-identity-conflict`   | integrity      | Stop affected stream and investigate                   |
| `dependency-missing`            | replay         | Request replay expansion or record Core conflict       |
| `cursor-invalid`                | continuation   | Retry from last known valid boundary or recover        |
| `cursor-expired`                | continuation   | Use offered recovery or bootstrap path                 |
| `replay-required`               | continuation   | Replay specified safe window before continuing         |
| `bootstrap-required`            | recovery       | Begin authorized bootstrap                             |
| `recovery-required`             | recovery       | Follow declared recovery class                         |
| `retry-later`                   | transient      | Preserve progress and retry with backoff               |
| `rate-limited`                  | transient      | Honor minimum delay and reduce concurrency             |
| `maintenance`                   | transient      | Retry after maintenance guidance                       |
| `dependency-unavailable`        | infrastructure | Retry without changing product state                   |
| `transport-failure`             | transport      | Reconnect and resume from durable state                |
| `session-expired`               | session        | Establish, authenticate, authorize, and negotiate anew |

### 19.3 Infrastructure versus product errors

KSP errors cover identity, authorization, compatibility, envelope validity, availability, continuation, and delivery. Product validation, unsupported product behavior, and merge conflicts are Core outcomes. A provider MUST NOT translate a product conflict into upload rejection after a valid immutable operation has already been durably accepted.

### 19.4 Partial failure

A batch-level carrier failure acknowledges nothing unless a durable operation-level acknowledgement was already received. A valid Upload Acknowledgement may report mixed outcomes. One invalid operation does not require rejecting unrelated valid operations unless atomic infrastructure policy was explicitly negotiated; KSP v1.0 assumes operation-level acceptance.

## 20. Bootstrap protocol

### 20.1 Preconditions

Bootstrap requires:

- a persistent new or recovering Device identity;
- successful authentication where required;
- trusted, non-revoked Account membership;
- compatible KSP, envelope, capability, and operation-version negotiation;
- an empty, quarantined, or explicitly recoverable local replica target.

### 20.2 Lifecycle

```text
New Device created locally
        ↓
Identity authenticated
        ↓
Device membership trusted
        ↓
Bootstrap Request
        ↓
Replay boundary selected
        ↓
Retained operation windows
        ↓ future capability
Opaque checkpoint + immutable tail
        ↓
Core deterministic replay
        ↓
Receipts and cursor committed
        ↓
Bootstrap Complete
        ↓
Replica Ready
```

### 20.3 History bootstrap

KSP v1.0 requires support for bootstrap from retained compatible operation history. The coordinator supplies bounded replay windows from a complete authorized boundary. The replica applies them using the ordinary replay and acknowledgement rules.

### 20.4 Checkpoint extension

A future negotiated capability may provide an opaque client-produced checkpoint plus an immutable operation tail. Replication infrastructure may store and deliver the artifact but MUST NOT construct product state by interpreting operations.

Checkpoint metadata must identify its Account scope, producing compatibility, base history boundary, integrity context, and required tail cursor. The concrete artifact format is outside KSP v1.0.

### 20.5 Interruption and resumption

Bootstrap progress is durable only at acknowledged replay boundaries. After interruption, the replica resumes from its last committed bootstrap cursor when still valid. Otherwise it begins from a newly selected complete boundary. It never mixes histories from incompatible bootstrap generations.

### 20.6 Completion

Bootstrap is complete only when:

1. all required operations through the selected boundary have durable replay outcomes;
2. replay receipts and the final cursor are committed atomically with local readiness;
3. the replica sends Bootstrap Complete;
4. the coordinator accepts that completion for the active Device membership.

A partially bootstrapped database MUST NOT be presented as a fully ready replica.

## 21. Versioning strategy

### 21.1 Protocol version

KSP uses conceptual major and minor versions:

- **major:** incompatible changes to required message semantics, state transitions, or invariants;
- **minor:** backward-compatible additions such as optional messages, fields, capabilities, or error detail.

KSP 1.x peers negotiate a common compatible minor contract. A peer MUST NOT claim compatibility if it cannot preserve required semantics.

### 21.2 Envelope and operation versions

Protocol version, operation-envelope version, and product-operation version are independent:

- KSP version governs session and delivery behavior;
- envelope version governs operation metadata structure;
- operation version governs opaque payload interpretation by Core.

Changing one does not automatically change the others.

### 21.3 Optional fields

New optional fields define safe absence behavior. A receiver ignores an unknown optional field while preserving it when forwarding is required and possible. A field that changes correctness cannot be optional merely to avoid a major version change.

### 21.4 Unknown messages

Every extension message declares whether it is optional or required for the current session:

- an unknown optional message is ignored and MAY receive an `unsupported-optional-message` diagnostic;
- an unknown required message terminates or renegotiates the session with an explicit compatibility error;
- unknown synchronization messages MUST NOT advance cursors or imply acknowledgement.

### 21.5 Capability evolution

Capabilities use stable names and independent versions. New optional capabilities may be added in a minor protocol release. Breaking capability semantics require a new capability major version, not silent reinterpretation.

### 21.6 Deprecation

A deprecation policy:

1. publishes the affected protocol or capability range;
2. retains a documented compatibility window;
3. reports upgrade guidance during negotiation;
4. does not strand accepted operation history;
5. provides bootstrap or migration handling before removal;
6. never silently changes cursor or acknowledgement meaning.

### 21.7 Forwarding opacity

Infrastructure may preserve unknown payloads and optional envelope extensions without interpreting them. It must reject an envelope version it cannot safely validate, scope, store, or reproduce exactly.

## 22. Security considerations

### 22.1 Authentication boundary

KSP carries provider-neutral authentication challenges and assertions conceptually. Authentication proves a principal. It does not establish Device trust, Account membership, or operation authorization by itself.

### 22.2 Authorization boundary

Every stream action is authorized for Account, Device, membership, trust state, capability, and requested scope. Authorization is deny-by-default and re-evaluated at session establishment and bounded protocol transitions.

### 22.3 Integrity

Messages and operation envelopes require integrity protection appropriate to the carrier and deployment. KSP reserves integrity metadata and capability hooks but does not define algorithms or key management.

An Operation ID collision with different immutable identity is treated as an integrity incident.

### 22.4 Replay protection

Protocol-message replay protection and product-operation replay safety are separate:

- sessions use bounded identity, correlation, freshness, and future cryptographic hooks to reject invalid message reuse;
- operations use stable identity, idempotent acceptance, and durable Core replay receipts;
- acknowledgements are scoped to Account, Device, session or durable stream, batch, and operation identities as applicable.

### 22.5 Confidentiality

KSP requires carriers and deployments to protect authentication material and synchronization payloads according to policy. Future end-to-end payload encryption is capability-negotiated. KSP v1.0 does not specify encryption algorithms.

### 22.6 Revocation

Revoked Devices cannot establish new authorized sessions. Active sessions are invalidated at bounded authorization checks. Revocation does not erase data already present on the Device and does not mutate accepted operation history.

### 22.7 Minimal disclosure

Negotiation and errors reveal only the compatibility, identity, and diagnostic information needed to proceed safely. Logs, traces, and metrics exclude authentication proofs, raw payloads, keys, and sensitive cursor contents.

### 22.8 Resource limits

Implementations enforce negotiated bounds for message size, batch size, operation count, dependency count, in-flight work, retry rate, and session duration. Limit failures remain explicit and must not produce silent history gaps.

## 23. Observability

### 23.1 Correlation and tracing

Every session has correlation context. Messages, batches, retries, and errors retain correlation identifiers across transport boundaries. Optional tracing identifiers may connect client, provider, and coordinator spans without becoming protocol identity.

### 23.2 Metrics

Transport-neutral protocol metrics SHOULD include:

- session establishment outcomes and duration;
- authentication and authorization outcome classes;
- negotiation compatibility outcomes;
- operations and bytes offered, accepted, deferred, rejected, downloaded, and replay-acknowledged;
- batch size and replay-window duration;
- cursor age and expiration count;
- retry count, delay class, reconnect count, and exhaustion;
- bootstrap progress, completion, restart, and failure;
- duplicate upload and redelivery count;
- error counts by stable KSP code;
- heartbeat latency where relevant.

Metrics MUST NOT use payload contents or high-cardinality user data as labels.

### 23.3 Diagnostics

Diagnostics distinguish:

- carrier connection;
- authentication;
- authorization;
- negotiation;
- upload acceptance;
- download delivery;
- local replay;
- cursor persistence;
- acknowledgement;
- recovery.

This prevents “sync failed” from hiding the actual boundary.

### 23.4 Logging

Logs use stable message type, error code, session correlation, provider identity, bounded batch counts, and redacted operation identifiers where policy requires. Logs never include raw payloads, reusable proofs, encryption secrets, or full user content.

## 24. Extensibility model

Extensions use negotiated capabilities and optional message families. They MUST preserve the base session, identity, immutable-operation, acknowledgement, cursor, and error invariants unless a future major KSP version explicitly supersedes them.

### 24.1 Collaboration

Future collaboration may add causality, participant, and shared-Workspace authorization capabilities. Durable product changes still become immutable Core operations. Live ephemeral collaboration must remain distinguishable from durable synchronization.

### 24.2 Presence and live cursors

Presence and cursor messages may use low-latency, non-durable channels. They must never advance durable KSP cursors or masquerade as operation acknowledgement.

### 24.3 AI streaming

AI request or stream capabilities require separate authorization and data-handling policy. Generated durable product changes must enter Core and synchronization as ordinary operations rather than bypassing the operation log.

### 24.4 Attachments and media

Large binary artifacts may use content-addressed or chunked transfer capabilities. The base operation envelope carries opaque references and integrity context. Artifact transfer acknowledgement remains separate from operation upload acceptance.

### 24.5 Enterprise routing

Enterprise relays, regional policy, data residency, audit, and gateway routing may extend session authorization and transport selection. They cannot change product payload semantics or permit untrusted Device access.

### 24.6 New transports

A new transport implements the same KSP session and message semantics. Carrier-specific liveness, framing, discovery, and quality-of-service behavior remain below KSP.

## 25. Transport conformance

An HTTP, WebSocket, QUIC, LAN, Bluetooth, USB, or other provider conforms when it:

- carries every required KSP v1.0 message needed for its supported role;
- preserves message, operation, batch, acknowledgement, and cursor identity;
- completes authentication, authorization, and negotiation before exchange;
- supports operation-level idempotent upload outcomes;
- advances download progress only after replay acknowledgement;
- survives duplicate, reordered carrier delivery where the carrier permits it;
- maps carrier failures to KSP error and retry classes;
- resumes from durable KSP boundaries;
- enforces negotiated limits;
- exposes transport-neutral diagnostics;
- never interprets product payloads.

A provider may omit optional capabilities. It may not weaken required semantics because its carrier is unreliable or constrained.

## 26. Conformance test model

Every implementation SHOULD be verifiable with a shared protocol harness covering:

1. successful session establishment and negotiation;
2. incompatible version and capability rejection;
3. unauthorized, untrusted, and revoked Device rejection;
4. deterministic batch ordering;
5. complete and partial upload acknowledgement;
6. lost upload response followed by idempotent retry;
7. duplicate download followed by receipt-based suppression;
8. lost download acknowledgement and safe redelivery;
9. interrupted session and cursor-based resumption;
10. expired cursor and explicit recovery;
11. missing dependency handling;
12. bootstrap interruption and restart;
13. unknown optional and required message handling;
14. retry, backpressure, and maintenance hints;
15. payload opacity and sensitive-log redaction;
16. transport replacement with identical protocol outcomes.

The harness may use loopback or simulated carriers. It tests KSP semantics, not product behavior or a particular encoding.

## 27. Implementation relationship to current Karya contracts

KSP v1.0 formalizes and extends the semantics already represented by the current platform boundaries:

- `SyncOperation` maps into the canonical operation envelope; Account scope, envelope version, and capability metadata belong to the future protocol adapter without changing product payload ownership.
- `TransportBatch` represents an Upload Batch or Download Batch at the current abstraction level.
- `TransportAcknowledgement` represents operation-level acknowledgement but future adapters must retain the distinction between upload acceptance and download replay acknowledgement.
- `TransportDownload.cursor` remains opaque and is persisted only after successful replay.
- `TransportProvider` remains the carrier adapter boundary.
- `RemoteTransportEngine` remains responsible for session, batching, retry, and continuation orchestration.
- `SynchronizationEngine` remains responsible for pending operations, replay, receipts, and local acknowledgements.
- `AccountEngine` remains responsible for replica membership and Device authorization.

This specification does not require immediate refactoring of those contracts. A future concrete provider implementation should introduce the smallest compatible adapter changes necessary to represent KSP messages explicitly.

## 28. Constraints on future implementation

Future work MUST NOT:

- couple Synchronization Engine or Core to HTTP, WebSocket, or any carrier;
- use a server product database as the base synchronization source;
- acknowledge upload before the promised durable acceptance boundary;
- advance a cursor before durable local replay completion;
- infer convergence from upload alone;
- expose product payloads to routing, authorization, or ranking;
- treat authentication as Device trust;
- silently skip expired history or unsupported operations;
- reuse an Operation ID for modified content;
- make online connectivity necessary for locally valid work;
- define transport-specific operation semantics;
- add optional fields whose absence changes correctness;
- let presence, collaboration, attachment, or AI extensions bypass Core ownership.

## 29. Deferred decisions

The following remain separate implementation or ADR decisions:

- concrete protocol encoding and framing;
- HTTP, WebSocket, QUIC, LAN, Bluetooth, and USB mappings;
- authentication providers and proof formats;
- Device pairing and recovery proof;
- cursor encoding and retention generation;
- concrete numeric batch and payload limits;
- compression algorithms;
- transport and end-to-end encryption algorithms;
- integrity signatures and key rotation;
- opaque checkpoint format and producer trust;
- attachment and media transfer protocol;
- collaboration and shared-Workspace authorization;
- presence and live-cursor protocol;
- enterprise routing and regional policy;
- formal service-level objectives.

These decisions may extend KSP but may not violate its v1.0 invariants without an explicit major-version decision.

## 30. Definition of done

KSP v1.0 is sufficient when independent teams can implement:

- an HTTP Transport Provider;
- a WebSocket Transport Provider;
- a LAN or Bluetooth Provider;
- a deterministic protocol test harness;
- Karya Cloud coordination and operation relay;
- Desktop and Mobile adapters;
- a future SDK client;
- a future Karya OS client;

without redesigning the Synchronization Engine, Account Engine, Core platform, acknowledgement model, or replay ownership.

The final constitutional rule is:

> KSP moves authorized immutable operations and durable progress between trusted replicas. Core remains the only authority that understands what those operations mean.
