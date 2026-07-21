# Platform Stabilization Phase 01 — Performance Report

## Methodology

Benchmarks run on an Apple Silicon development machine using Node 25.2.1, Xcode 26.1.1, Java 17, Vitest, in-memory Core adapters for engine isolation, and `better-sqlite3` for Desktop persistence. Times are wall-clock durations from `performance.now()`. They are engineering baselines, not device service-level guarantees.

The reported range includes the isolated run and the complete workspace run where package tests execute concurrently.

## Core engine baselines

| Workload                                    |     Duration |
| ------------------------------------------- | -----------: |
| 5,000 edits with repeated flushes and close |  9.8–20.8 ms |
| Index 10,000 search documents               | 41.4–85.9 ms |
| Search 10,000-document index                |   1.6–4.4 ms |
| Rank 10,000 Continue Working items          | 10.6–33.4 ms |
| Replay 20,000 SyncOperations                | 23.8–43.0 ms |
| Duplicate replay of 20,000 operations       |   3.5–8.2 ms |
| 250 integrated Resource mutations           |   437–625 ms |

The integrated mutation rate after the fix is approximately 400–572 operations per second with all current subscribers active.

## SQLite baselines

Dataset: 10k Resources, 10k search documents, 10k Notifications, 50k Activities, and 50k SyncOperations. Database size after WAL checkpoint: 93,036,544 bytes (88.7 MiB).

| Operation                         | Duration |
| --------------------------------- | -------: |
| Transactional dataset generation  |   794 ms |
| Integrity-checked restart         |   159 ms |
| Workspace Resource query over 10k |  23.3 ms |
| Metadata search over 10k          |   9.6 ms |
| Profile Activity query, limit 50  |  0.25 ms |
| Profile unread Notification count |  0.06 ms |
| Restore 25k pending operations    |  26.9 ms |

SQLite query-plan validation confirmed use of:

- `idx_activities_profile`
- `idx_notifications_profile_status`
- `idx_sync_operations_queue`

No new database indexes were introduced because the measured indexed queries were already well below one millisecond and the remaining scans stayed below 25 ms at the target Resource scale.

## Startup and rendering interpretation

- Persistence initialization with integrity validation at the stress dataset was 159 ms on Desktop.
- Home and Continue Working derive from the same Core snapshot; the 10k Continue Working ranking baseline is the relevant engine cost before React rendering.
- Search presentation adds React/keyboard work beyond the 1.6–4.4 ms Core query baseline.
- Native cold launch and frame pacing depend on device class and were not inferred from simulator compilation. They remain release-device profiling tasks.

## Regression baseline

The stress suites are executable regression tests:

```bash
pnpm --filter @karya/kernel exec vitest run src/platform-reliability.stress.test.ts
pnpm --filter @karya/metadata-store exec vitest run src/platform-reliability.integration.test.ts
```
