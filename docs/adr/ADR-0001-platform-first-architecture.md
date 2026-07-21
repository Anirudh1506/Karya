# ADR-0001: Platform-First Architecture

- **Status:** Accepted
- **Date:** 2026-07-11
- **Decision owners:** Karya Platform

## Context

Karya began with a working Electron Desktop client, but the product model spans Desktop, Mobile, Cloud, a future SDK, and Karya OS. Independent client implementations would duplicate Resource behavior, Context Resolution, Continuity, synchronization semantics, and lifecycle rules.

## Decision

Karya is one platform with multiple clients. Business behavior belongs to shared Core services and domain packages. Clients compose platform adapters and present Core capabilities.

Dependency direction is inward:

```text
Clients -> Client adapters -> Core / Kernel -> Services -> Domain and contracts
   |                                                    ^
   +---------- platform and persistence adapters -------+
```

The Event Bus remains a first-class coordination mechanism for service-owned facts. Clients must not introduce parallel business-event systems.

Desktop-native implementations remain isolated behind shared contracts. Mobile must be able to import shared Core entry points without resolving Node, Electron, or `better-sqlite3` modules.

## Consequences

- Product behavior is implemented once and presented by multiple clients.
- Platform capabilities are injected through `@karya/platform`.
- Repository contracts remain in `@karya/persistence`; SQLite implementations remain adapters.
- Client composition roots register concrete platform and persistence implementations.
- Shared package entry points must be safe in every supported JavaScript runtime.
- Desktop-specific UI and adapters are not automatically shared with Mobile.
- New packages require a demonstrated ownership boundary and measurable reuse benefit.

## Constraints

- Preserve working Desktop behavior during migration.
- Prefer evolutionary changes to package renames or rewrites.
- Do not create empty packages for anticipated capabilities.
- Do not move business rules into client state or navigation.
- Do not make network availability a requirement for locally valid work.
