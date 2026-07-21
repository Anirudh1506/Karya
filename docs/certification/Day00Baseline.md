# Karya v1.0 Alpha Certification — Day 0 Baseline

- **Captured:** 2026-07-15 00:05–00:10 IST
- **Program state:** Active; human dogfood begins on Day 1
- **Certification state:** Engineering alpha certified; Primary Work Environment pending

## Environment

| Item                     | Value                                    |
| ------------------------ | ---------------------------------------- |
| Host                     | Apple Silicon Mac mini, arm64            |
| macOS                    | 26.2 (25C56)                             |
| Node                     | 25.2.1, ABI 141                          |
| pnpm                     | 9.15.4                                   |
| Xcode                    | 26.1.1 (17B100)                          |
| Java                     | OpenJDK 17.0.17                          |
| iOS physical devices     | None connected                           |
| Android physical devices | None connected                           |
| iOS simulators           | iOS 26.1 simulator set installed         |
| Android tooling          | ADB 36.0.2 available; no device attached |

## Verification

`pnpm verify` passed on the Day 0 worktree:

- ESLint passed with zero allowed warnings;
- TypeScript passed across the workspace;
- complete repository tests passed;
- complete repository build passed;
- Desktop production bundle passed;
- Android and iOS Hermes exports passed.

The Desktop renderer emitted the existing non-blocking warning that its approximately 676 KB minified chunk exceeds Vite's 500 KB advisory threshold.

## Persona workflow baseline

The existing focused suite completed all six deterministic workflows plus its measurement report: **7/7 passed**.

| Persona    |  Startup | Capture | Edit and save | Search and restore | Suspend/resume |
| ---------- | -------: | ------: | ------------: | -----------------: | -------------: |
| Student    | 11.28 ms | 1.85 ms |       1.50 ms |            4.09 ms |        0.35 ms |
| Engineer   |  0.94 ms | 0.65 ms |       0.62 ms |            2.74 ms |        0.09 ms |
| Founder    |  0.67 ms | 0.47 ms |       0.59 ms |            2.60 ms |        0.09 ms |
| Designer   |  1.35 ms | 0.52 ms |       0.56 ms |            2.88 ms |        0.08 ms |
| Researcher |  0.68 ms | 0.52 ms |       0.60 ms |            2.70 ms |        0.12 ms |
| Writer     |  0.62 ms | 0.51 ms |       0.53 ms |            2.61 ms |        0.08 ms |

These are in-memory engine timings. They prove deterministic workflow behavior, not human task speed or device responsiveness.

## Reliability baseline

The integrated reliability suite passed **6/6**.

| Workload                                 | Day 0 result |
| ---------------------------------------- | -----------: |
| 5,000 edits and lifecycle flushes        |     10.46 ms |
| Index 10,000 search documents            |     57.61 ms |
| Query 10,000-document search index       |      2.14 ms |
| Rank 10,000 Continue Working items       |     10.37 ms |
| Replay 20,000 synchronization operations |     33.58 ms |
| Replay the same 20,000 operations        |      3.44 ms |
| Integrated event storm                   |    670.08 ms |

The SQLite reliability suite passed **1/1** after correcting the local native-module ABI:

| SQLite workload                   |     Day 0 result |
| --------------------------------- | ---------------: |
| Seed representative data          |        816.06 ms |
| Database size                     | 93,073,408 bytes |
| Integrity-checked restart         |        165.07 ms |
| Resource query                    |         23.17 ms |
| Metadata search                   |          9.59 ms |
| Activity query                    |          0.25 ms |
| Notification query                |          0.06 ms |
| Synchronization queue restoration |         26.64 ms |

## Defect and recovery record

The first SQLite run failed because `better-sqlite3` was built for Electron ABI 130 while tests ran under Node ABI 141. No product data or source was changed.

Recovery:

1. rebuilt the installed native dependency for the active Node runtime;
2. reran and passed the SQLite reliability suite;
3. completed `pnpm verify`;
4. rebuilt `better-sqlite3` for Electron using the existing `rebuild:native` script;
5. directly opened and closed an in-memory SQLite database under Electron successfully.

This is an engineering-environment reliability concern: Node-based SQLite integration and Electron runtime use different native ABIs. Certification runs must explicitly select the correct binding and restore Electron afterward. It is not evidence of a Core or persistence semantic defect.

## Evidence still missing

- observed first-use sessions;
- real daily workflows and next-day return behavior;
- participant comprehension of Profiles, Workspaces, Resources, ownership, and continuity;
- natural adoption and abandonment rates;
- physical iOS and Android testing;
- VoiceOver, TalkBack, keyboard-only, 200% text, reduced-motion, contrast, and focus-order sessions;
- release-device cold/warm startup and UI latency;
- OS process-death restoration;
- long editing sessions and large-note interaction behavior;
- user trust in autosave, recovery, and implemented synchronization semantics.

## Day 0 decision

The engineering foundation is suitable to start controlled dogfooding. There is no evidence supporting unconditional Primary Work Environment certification yet. The next valid step is the scheduled Day 1 observed Student workflow, not additional capability development.
