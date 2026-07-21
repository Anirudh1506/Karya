# Platform Stabilization Phase 01 — Architecture Review

## Decision

No existing engine requires redesign before Karya Account.

Karya is ready to add identity and remote transport through its existing boundaries:

- Core owns business behavior and deterministic state transitions.
- Event Bus propagates domain changes without UI-owned refresh logic.
- Persistence contracts isolate SQLite.
- Synchronization owns immutable operations, replay receipts, deterministic ordering, acknowledgements, and conflict hooks.
- Platform adapters prevent native APIs from leaking into Core.
- Desktop and Mobile consume the same services and public Shell API.

## Evidence

- Every current engine ran together during the integrated event storm.
- Event-derived Search, Activity, Continue Working, Notification, and Sync records remained unique and consistent.
- Lifecycle stop/start paths remained idempotent under repeated suspend/resume.
- Replay remained deterministic for reversed and duplicate 20,000-operation inputs.
- SQLite migrations, WAL, integrity, query indexes, restart, and checkpoint behavior passed at scale.
- Both native clients and the Desktop production client build from the same Core after the optimization.

## Required constraints for Karya Account

Connectivity Phase 02 should extend the current design rather than replace it:

1. Bind account identity to the persistent device identity without changing entity ownership semantics prematurely.
2. Implement remote transport behind `SyncTransport`.
3. Exchange operations in bounded cursor-based batches.
4. Persist remote cursors and server acknowledgements transactionally.
5. Keep replay through existing Core services and Context Resolution.
6. Define retry, backoff, authentication expiry, and offline transitions outside product UI.
7. Add a retention/compaction policy only after the server acknowledgement contract is final.
8. Run two-device convergence, clock-skew, partial-batch, and conflict tests before enabling production synchronization.

## Technical debt that does not block Account

- SQL-side Resource filtering and FTS are future scale optimizations, not current correctness requirements.
- Turbo reports missing output declarations for several TypeScript/test tasks; this affects cache efficiency rather than runtime reliability.
- Desktop renderer bundle exceeds Vite's 500 kB warning threshold; code splitting is a delivery optimization.
- React Native/Expo dependencies emit Xcode deprecation warnings and Gradle reports future Gradle 10 incompatibility.
- Physical-device memory and launch profiling remains necessary before beta certification.

## Readiness assessment

Status: **Ready for Connectivity Phase 02 — Karya Account**, subject to preserving the constraints above.

The local-first system demonstrated correctness, deterministic replay, bounded editing state, indexed durable queries, and stable multi-engine event propagation. The measured defect was localized and corrected without changing architectural ownership. Identity and networking can therefore be introduced as adapters and protocols around the existing platform rather than as a Core rewrite.
