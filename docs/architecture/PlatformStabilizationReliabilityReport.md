# Platform Stabilization Phase 01 — Reliability Report

Date: 2026-07-13

## Certification outcome

The local-first platform passed integrated reliability validation and is ready for Karya Account and remote transport work. No Core engine requires architectural redesign before distribution.

The validation found one platform-wide performance defect: every State Engine commit cloned, recursively froze, and JSON-serialized the complete snapshot. Under an event storm this made otherwise incremental state transitions behave quadratically. Structural-sharing-aware freezing replaced the full copy and serialization without weakening snapshot immutability.

Measured result: 250 integrated Resource mutations improved from 18,117 ms to 437–625 ms, approximately 29–41 times faster depending on concurrent test load.

## Validated scenarios

- 5,000 edits in one session, including 20 lifecycle flushes, final close, recovery persistence, and checkpoint verification.
- 10,000 indexed Resources with exact, incremental rename, stale-term removal, deterministic ranking, and duplicate checks.
- Continue Working ranking over 10,000 Resources, including active-resource priority and repeat determinism.
- 20,000 deliberately reversed synchronization operations followed by complete duplicate replay.
- 250 integrated Core Resource mutations with renames, Activity, Search, Continue Working, State Engine, and synchronization subscribers active together.
- Repeated Core suspend/resume and idempotent shutdown after the event storm.
- SQLite database containing 10,000 Resources, 10,000 search documents, 10,000 Notifications, 50,000 Activities, and 50,000 SyncOperations.
- WAL mode, integrity check, migration restart, WAL checkpoint, query plans, database growth, and queue restoration.

## Correctness results

| Area             | Result                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| Editing          | Final revision 5,000 restored; exactly two checkpoints; no open session after close |
| Search           | 10,000 unique documents; rename removed stale term; deterministic target returned   |
| Continue Working | 10,000 unique ordered items; active Resource first; repeat order identical          |
| Event storm      | No duplicate Resources, search documents, Activities, or SyncOperations             |
| Synchronization  | 20,000 applications; 20,000 receipts; second replay applied zero operations         |
| Notifications    | Indexed unread count and persisted state queries remained consistent                |
| Activity         | Indexed chronological queries returned the requested 50 records                     |
| Lifecycle        | Repeated suspend/resume completed; service subscriptions stopped on shutdown        |
| SQLite           | `integrity_check=ok`; WAL enabled; schema restart succeeded                         |

## Memory and retention validation

- Editing keeps one draft and one active session per open Resource; 5,000 changes did not create per-edit checkpoints or sessions.
- Autosave timers are replaced rather than accumulated and are cleared on shutdown.
- Event Bus handlers are stored in sets, registry stop functions unsubscribe engine handlers, and duplicate service starts are idempotent.
- Sync replay receipts grow intentionally with the immutable operation history; this is durable history, not a retained-object leak.
- State snapshots now retain unchanged frozen branches through structural sharing instead of allocating a complete clone per event.

This phase validates bounded ownership structurally and through long synthetic workloads. Device-specific resident-memory and GC curves should still be collected with Instruments and Android Studio before public beta because simulator heap figures are not representative.

## Issues discovered and fixes

### Fixed: whole-snapshot copying on every event

Root cause: `structuredClone`, recursive freezing, and two complete JSON serializations occurred for each commit.

Fix:

- Preserve structural sharing between State Engine snapshots.
- Skip already-frozen branches during recursive freezing.
- Remove JSON-based equality comparison; state transitions already construct a new root only for commits.

No public API, event, persistence model, or UI behavior changed.

## Remaining risks

- Metadata Resource filtering and SQLite metadata search deserialize the 10,000-row collection. Current latency is acceptable, but server-scale libraries will require SQL predicates or FTS.
- Synchronization queue restoration materializes the full matching queue. Remote transport should use cursor-based batches.
- Replay receipts and acknowledged operations have no retention/compaction policy yet. That policy belongs with the remote acknowledgement protocol.
- Continue Working intentionally ranks the active Workspace collection in memory. Very large single-Workspace collections may justify a bounded query later.
- Native third-party dependencies emit deprecation warnings under Xcode 26.1.1 and Gradle warns about Gradle 10 compatibility.

## Verification

- ESLint: passed
- TypeScript workspace: 32/32 tasks passed
- Complete test suite: passed
- Kernel: 36 tests passed, including six stress validations
- Metadata store: 19 tests passed, including SQLite scale validation
- Mobile: 17 tests passed
- Desktop production build: passed
- iOS and Android Hermes export: passed
- Android native debug build: passed
- iOS native simulator build: passed
