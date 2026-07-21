# KSP Provider Certification

## Purpose

KSP certification establishes that a Transport Provider preserves KSP v1.0 semantics regardless of its carrier, platform, or deployment.

Certification answers:

> Can this provider replace the reference carrier without changing durable protocol outcomes?

## Provider requirements

Every provider seeking KSP v1.0 certification must:

- implement the existing Karya Transport Provider boundary for runtime integration;
- supply a test adapter implementing `KspConformanceAdapterFactory` and `KspConformanceAdapter`;
- preserve the full authentication, authorization, negotiation, synchronization, recovery, and disconnect lifecycle;
- preserve message, operation, batch, acknowledgement, and cursor identity;
- treat operation payloads as opaque;
- support operation-level idempotent upload outcomes;
- distinguish upload acceptance from download replay acknowledgement;
- advance continuation only after durable replay acknowledgement;
- support bounded batching and backpressure without discarding work;
- map carrier failures to stable KSP error and retry classes;
- resume from durable KSP boundaries after disconnect or process restart;
- reject incompatible required versions, capabilities, and messages explicitly;
- ignore unknown optional behavior safely;
- enforce Account and trusted Device scope;
- expose correlation diagnostics and transport-neutral metrics;
- redact product payloads, authentication proofs, cursor contents, and secrets;
- pass the canonical suite without modifying its assertions.

## Certification adapter

The certification adapter is test infrastructure. It maps the provider's actual session behavior into the neutral harness contract. It must not emulate away provider behavior, rewrite outcomes, or substitute the reference adapter for the implementation under review.

The factory creates isolated provider environments for carrier profiles. Each environment must expose:

- session connection and negotiation;
- upload and per-operation acknowledgement;
- download windows and opaque cursors;
- replay acknowledgement;
- bootstrap and completion;
- heartbeat and disconnect;
- deterministic fault injection or an equivalent controlled test facility;
- Device revocation and cursor expiration controls;
- diagnostics and metrics.

Provider-specific setup may provision a local process, simulator, radio bridge, test database, or disposable service. Those mechanics remain outside the canonical assertions.

## Certification flow

```text
Provider implementation
        ↓
Certification adapter
        ↓
Canonical KSP conformance suite
        ↓
Deterministic replay suite
        ↓
Bootstrap and recovery suite
        ↓
Architectural scale suite
        ↓
Provider-specific integration tests
        ↓
Conformance report reviewed
        ↓
KSP v1.0 Certified
```

The same flow applies to HTTP, WebSocket, LAN, Bluetooth, USB, Cloud, SDK, Desktop, Mobile, and future Karya OS implementations.

## Required certification evidence

A certification record includes:

- provider name and version;
- supported KSP, envelope, operation, and capability versions;
- source revision and build identity;
- runtime and carrier environment;
- canonical suite result;
- deterministic replay result;
- bootstrap and recovery result;
- architectural scale result;
- provider-specific supplemental test result;
- metrics and redacted diagnostics artifact;
- known deviations, disabled optional capabilities, and operational limits;
- reviewer and certification date.

## Pass criteria

A provider is certified only when:

- every required canonical check passes;
- deterministic histories produce identical durable outcomes;
- duplicate delivery and lost acknowledgements remain safe;
- interrupted replay and bootstrap resume without history loss;
- unsupported compatibility fails gracefully;
- all failure outcomes are deterministic and correctly classified;
- payload opacity and sensitive-data redaction pass;
- the provider does not require changes to Core, Synchronization Engine, Account Engine, Remote Transport Engine, or KSP;
- provider-specific tests reveal no contradiction with the canonical report.

Performance numbers are reported but are not universal pass thresholds until Karya defines transport-class service objectives. Correctness failures cannot be waived by performance advantages.

## Failure and remediation

A failed guarantee prevents certification. The provider team must:

1. preserve the failing test and diagnostic artifact;
2. determine whether the defect is in the provider, its certification adapter, or shared conformance harness;
3. correct the provider or adapter when the KSP requirement is valid;
4. rerun the entire canonical suite;
5. request architectural review only if the test exposes a genuine contradiction in the frozen KSP constitution.

The provider must not fork, skip, weaken, or special-case a canonical assertion. A constitutional change requires an explicit protocol decision and versioning review.

## Recertification

Recertification is required when a provider changes:

- KSP or envelope version support;
- operation-version handling;
- authentication or authorization integration;
- session, retry, batching, cursor, or acknowledgement behavior;
- durable storage or replay coordination;
- carrier library or framing with protocol-visible effects;
- redaction or observability behavior;
- bootstrap or recovery handling;
- supported platform or runtime in a way that can affect protocol semantics.

Routine internal changes with no protocol-visible effect still run the suite in continuous integration.

## Recommended continuous integration

Provider repositories should run:

```text
Every change
  → conformance and deterministic replay

Nightly or release candidate
  → failure matrix, bootstrap, and architectural scale

Release
  → full canonical suite, provider integration tests, and certification artifact
```

The in-repository reference commands are:

```sh
pnpm test:ksp:conformance
pnpm test:ksp
pnpm test:ksp:scale
```

## Certification status labels

- **Conformant:** all canonical checks pass in development.
- **Certified:** conformant results and required evidence have been reviewed for a named release.
- **Provisionally certified:** a previously certified provider has only optional capability or environment evidence pending; no constitutional failure is allowed.
- **Not certified:** any required check fails or evidence is missing.
- **Certification withdrawn:** a regression or security issue invalidates a prior result.

## Reference status

The `@karya/ksp-conformance` reference adapter is conformant with KSP v1.0. Its report is [KSP v1.0 Protocol Conformance Report](./KSPProtocolConformanceReport.md).
