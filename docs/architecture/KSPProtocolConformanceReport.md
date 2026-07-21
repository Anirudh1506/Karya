# KSP v1.0 Protocol Conformance Report

- **Status:** Passed
- **Protocol:** Karya Synchronization Protocol 1.0
- **Reference implementation:** `@karya/ksp-conformance`
- **Validation date:** 2026-07-14
- **Specification:** [Karya Synchronization Protocol Specification](./KaryaSynchronizationProtocolSpecification.md)

## Outcome

The KSP reference adapter passes the canonical conformance suite. The harness validates protocol behavior rather than product behavior and does not import Core, Synchronization Engine, Account Engine, Remote Transport Engine, React, Expo, Electron, SQLite, or a network implementation.

The harness confirms that KSP semantics can remain identical across logical loopback, HTTP, WebSocket, LAN, Bluetooth, USB, and unknown-future transport profiles.

## Harness architecture

```text
Provider certification adapter
        ↓ implements KspConformanceAdapterFactory
Canonical conformance runner
        ├─ session and boundary validation
        ├─ compatibility validation
        ├─ deterministic replica simulator
        ├─ failure injection
        ├─ bootstrap and recovery validation
        ├─ observability validation
        └─ architectural scale validation
```

The package contains:

- a provider-neutral conformance adapter contract;
- a reference KSP adapter and session coordinator;
- durable logical replica simulators;
- deterministic operation ordering and envelope identity validation;
- fault injection for maintenance, network loss, lost responses, duplicate delivery, expired sessions, dependency failure, and bootstrap interruption;
- opaque cursor generation, validation, expiration, and recovery;
- a reusable certification runner returning a machine-readable report;
- a compact idempotent receipt ledger for million-receipt architectural validation.

## Passed guarantees

| Guarantee                      | Result | Evidence                                                                   |
| ------------------------------ | ------ | -------------------------------------------------------------------------- |
| Session lifecycle              | Passed | Idle through authentication, authorization, negotiation, sync, disconnect  |
| Authentication boundary        | Passed | Unauthenticated sessions rejected explicitly                               |
| Authorization boundary         | Passed | Unauthorized, untrusted, and revoked Devices rejected                      |
| Capability negotiation         | Passed | Optional capabilities decline safely; required mismatches fail             |
| Protocol compatibility         | Passed | Unsupported major protocol versions fail before synchronization            |
| Optional message evolution     | Passed | Unknown optional messages ignored without progress mutation                |
| Required message evolution     | Passed | Unknown required messages fail explicitly                                  |
| Deterministic batching         | Passed | Stable KSP comparison order and bounded carrier-specific batches           |
| Partial upload acknowledgement | Passed | Accepted operations commit; deferred remainder stays pending               |
| Lost upload response           | Passed | Retry returns already-accepted without duplicate storage                   |
| Duplicate download             | Passed | Replay receipts prevent duplicate product application                      |
| Partial replay                 | Passed | Durable receipts survive interruption without cursor advancement           |
| Restart restoration            | Passed | Pending state, receipts, replay order, and cursor resume deterministically |
| Cursor opacity                 | Passed | Clients carry tokens without parsing or synthesizing them                  |
| Cursor corruption              | Passed | Invalid tokens fail with `cursor-invalid`                                  |
| Cursor expiration              | Passed | Expired tokens fail explicitly and permit bootstrap recovery               |
| Dependency handling            | Passed | Missing dependencies produce deterministic recovery errors                 |
| Bootstrap                      | Passed | New replica replays all retained history before becoming ready             |
| Bootstrap interruption         | Passed | Restart resumes from the last committed window                             |
| Retry classification           | Passed | Maintenance, transport, session, and state failures remain distinct        |
| Transport neutrality           | Passed | Seven carrier profiles produce identical durable outcomes                  |
| Observability                  | Passed | Correlation diagnostics and protocol metrics are emitted                   |
| Sensitive-data redaction       | Passed | Product payloads are absent from diagnostics                               |

## Deterministic replay validation

The deterministic suite executes the same 50,000-operation history twice using fresh, identically configured logical replicas and adapters.

Both runs produce identical:

- replay order;
- durable receipt identity;
- final opaque cursor;
- upload acknowledgements;
- replica digest.

The suite separately introduces duplicate download, a lost upload response, partial replay at operation 73, process restart, redelivery, and completion. The final receipt set contains exactly one entry for each of 500 operations and the replay order contains no duplicate application.

## Bootstrap validation

The bootstrap scenario uploads 250 retained operations, commits one 32-operation replay window, restarts the new replica, injects a bootstrap transport failure, restarts again, and resumes to completion.

The replica is not marked ready after the partial window. It becomes ready only after all 250 receipts and the final cursor are durably committed. No history is skipped.

## Compatibility findings

No constitutional compatibility defects were found.

The suite verifies:

- KSP 1.0 negotiation;
- unsupported major-version rejection;
- independent envelope-version negotiation;
- independent operation-version validation;
- optional capability decline;
- required capability rejection;
- unknown optional message tolerance;
- unknown required message failure.

Concrete encodings and provider-specific framing remain intentionally outside the harness.

## Failure-model findings

All injected failures preserve local-first guarantees:

- maintenance returns a delayed-retry classification;
- network failure requires reconnect without queue loss;
- a lost upload response is repaired by idempotent re-upload;
- duplicate download is suppressed by durable receipts;
- expired sessions require a new negotiated session;
- revoked Devices cannot continue or reconnect;
- unsupported protocol versions fail before exchange;
- unavailable upload dependencies leave operations pending;
- missing replay dependencies require recovery;
- retry exhaustion can end a session without deleting local work;
- bootstrap failure leaves the replica incomplete and resumable.

## Scalability findings

The architectural scale suite validates:

- 100 logical source replicas;
- 100,000 immutable operations;
- interrupted and resumed large-history bootstrap;
- 100,000 replay receipts on the bootstrapped replica;
- one million compact idempotent receipt insertions plus duplicate insertion attempts;
- 1,000 heartbeat cycles on a long-running logical session;
- bounded 128-operation replay windows;
- complete history and unique replay order.

The reference run completed successfully. On the validation machine, the 100-replica scale test completed in approximately 0.2 seconds and two independent 50,000-operation deterministic histories completed in approximately 0.9 seconds. These figures are development observations, not service-level objectives or transport benchmarks.

The result validates bounded data structures, incremental windows, duplicate-safe receipts, and absence of architecture-level quadratic replay behavior in the reference scenario. It does not predict real carrier latency, durable database throughput, radio behavior, or Cloud capacity.

## Observability findings

The reference adapter emits transport-neutral metrics for:

- sessions started, ready, rejected, and reconnected;
- operations offered, accepted, already accepted, downloaded, and replayed;
- duplicate deliveries and retries;
- bootstrap start and completion;
- stable protocol error codes.

Diagnostics retain sequence, type, correlation ID, session ID, and bounded non-product detail. A sentinel secret payload is injected by the suite and verified absent from serialized diagnostics.

## Failed guarantees

None.

Any future failure in the canonical suite removes certification until corrected or until an explicit KSP major-version decision changes the constitutional guarantee.

## Known limits

The harness is intentionally architectural:

- it does not benchmark actual networks or durable storage;
- authentication and authorization are simulated boundaries, not provider implementations;
- cursors are reference opaque tokens, not a production encoding;
- payload integrity and encryption hooks are not cryptographic implementations;
- checkpoint bootstrap remains a future capability;
- collaboration, attachments, presence, and AI streaming are not KSP 1.0 capabilities;
- millions of receipts are validated with a compact deterministic ledger rather than a production database.

## Commands

```sh
pnpm test:ksp
pnpm test:ksp:conformance
pnpm test:ksp:scale
```

## Remaining work before HTTP Providers

1. Choose and document a concrete KSP encoding and framing.
2. Define the minimal HTTP carrier mapping without changing KSP semantics.
3. Implement an HTTP provider adapter behind the existing Transport Provider boundary.
4. Adapt that provider to `KspConformanceAdapterFactory`.
5. Run the canonical suite unchanged.
6. Add real-network integration, durable-storage, and deployment tests as provider-specific supplements.
7. Publish a certification artifact using the process in [KSP Provider Certification](./KSPProviderCertification.md).

Provider-specific tests may add coverage. They may not replace, fork, or weaken the canonical constitutional suite.
