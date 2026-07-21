# Karya v1.0 Alpha Certification Report

- **Date:** 2026-07-14
- **Scope:** Local-first Desktop and Mobile product
- **Architecture status:** Frozen; no redesign required
- **Certification status:** Conditional product certification; engineering alpha certified

## Executive decision

Karya v1.0 Alpha demonstrates its original local-first continuity thesis. Existing engines compose into a credible work environment: context is restored, capture propagates through the product, search restores ownership before opening, editing survives lifecycle transitions, and Continue Working provides a direct route back into active work.

The implementation is engineering-ready for structured internal alpha usage. It is not yet honest to claim unqualified daily-use product certification because no observed external usability sessions, physical-device accessibility audit, or release-device cold-start study has been completed.

The certification decision is therefore:

- **Engineering alpha:** Certified.
- **Internal dogfood:** Certified.
- **Unqualified primary-work-environment claim:** Pending evidence.
- **Cloud connectivity:** Not authorized by this report.

This distinction is deliberate. Synthetic correctness can prove continuity and speed boundaries; it cannot prove comprehension, delight, habit formation, or voluntary preference.

## Changes made during certification

No new capability or engine was introduced. The review made targeted improvements to existing experiences:

- Desktop Continue Working now consumes the Core-ranked `continuity.continueWorking` model instead of reconstructing a separate recent-resource list.
- Desktop Home leads with resumption, search, and capture rather than product inventory statistics.
- Desktop’s direct-create action is named “Quick capture.”
- Mobile Home exposes direct “See all” paths to Continue Working and the complete active Workspace library.
- Mobile Home removes duplicate Profile and Workspace switch actions because the context bar already owns those paths.
- Account, Synchronization, and Transport diagnostics are collapsed under “Platform details” instead of competing with daily work.
- Continue Working explains whether an item is present because it was opened or edited.
- Profile and Workspace selection now explain Karya’s ownership model in ordinary language.
- Quick Capture makes its active Profile and Workspace visible, explains that a short name is sufficient, and reports local preparation.
- Mobile editing now presents title and note before metadata, collapses infrequent details and movement controls, names the resource in native navigation, and offers explicit autosave retry.
- Mobile Resource lists lead with the current Workspace name and use “Notes and resources” to connect product language to familiar objects.
- Mobile Search uses the quieter placeholder “Search your work.”

## 1. UX report

### What feels magical

- Selecting a search result restores its Profile and Workspace through Core before opening the Resource.
- Continue Working survives suspend, resume, and restart and reacts through events rather than manual refresh.
- Capture immediately appears in Home, Search, Activity, Continue Working, and persistence through one Core lifecycle.
- Editing recovery state persists on every change while product metadata autosaves on a bounded delay.
- Desktop and Mobile share the same Core behavior despite different presentation models.

### What feels frustrating

- Quick Capture currently captures a concise note name, then opens the editor for substantive content. This is fast for reminders but one transition too many for longer thoughts.
- Mobile Resource editing uses a platform text control rather than the richer Desktop note surface. Content is safe, but formatting parity does not exist.
- Desktop Home still contains more secondary information than the deliberately quiet Mobile Home.
- Archived-object actions remain visible within primary management lists and add cognitive weight for first-time users.

### What felt unnecessary and was reduced

- Product-count statistics on Desktop Home.
- Infrastructure controls presented as primary Mobile Home actions.
- Duplicate Profile and Workspace switching actions below an already interactive context bar.
- Always-visible metadata and movement controls while writing on Mobile.
- A Desktop Home implementation of “recent” work that bypassed the canonical Continue Working ranking.

### What remains confusing

- “Resource” is an architectural term. The revised Mobile list pairs it with “Notes,” but first-run education still needs observed validation.
- The distinction between a Profile and Workspace is conceptually sound but cannot be certified through copy review alone.
- A default Workspace is created automatically; users may not immediately understand whether to rename it or create another.

### Accessibility assessment

Current Mobile work uses system fonts, semantic colors, 44–52 point actions, accessibility roles, selected/expanded states, live-region errors, safe-area-aware navigation, and system light/dark appearance. Desktop uses keyboard search and labeled icon actions.

Remaining certification work includes VoiceOver, TalkBack, keyboard-only Desktop, 200% text, reduced-motion, contrast, focus-order, and switch-control sessions on release devices.

## 2. Workflow report

### Internal usage simulation

Automated focused-work cycles represent:

- Student — thesis research;
- Engineer — release reliability;
- Founder — company strategy;
- Designer — mobile interaction;
- Researcher — field study;
- Writer — long-form essay.

Each workflow performs:

```text
Launch
  → establish Profile and Workspace
  → Quick Capture
  → create twelve supporting notes
  → edit and save a long note
  → switch Workspace
  → capture incoming work
  → search for the original thought
  → restore its Profile and Workspace
  → verify Continue Working priority
  → suspend
  → resume
  → verify work and context
```

All six workflows passed.

### Daily-work interpretation

The platform supports the essential loop of research, capture, writing, editing, context switching, retrieval, and resumption. The simulation intentionally uses realistic titles and multi-paragraph content while avoiding claims about human emotion or habit.

The strongest workflow is “find or resume existing work.” The weakest is “capture a substantive thought without entering the editor.”

### Ownership comprehension

The model is internally consistent:

```text
Profile = role or sphere of responsibility
  └─ Workspace = related body of work
       └─ Resource = note or other working object
```

Context Resolution enforces this hierarchy. The revised selection copy makes it visible. Time-to-understanding remains a user-research question.

## 3. Continuity report

| Scenario                     | Result | Evidence                                                           |
| ---------------------------- | ------ | ------------------------------------------------------------------ |
| Cold Core boot               | Passed | Profile, Workspace, repositories, and derived state restore        |
| Suspend and resume           | Passed | Editing flushes and context remains stable                         |
| Core restart                 | Passed | Profile, Workspace, Resources, Capture, and Continue Working tests |
| Editing interruption         | Passed | Immediate recovery persistence plus autosave and checkpoints       |
| Search context restoration   | Passed | Profile and Workspace restored before Resource selection           |
| Continue Working restoration | Passed | Ranked items rebuild from persisted continuity facts               |
| Activity restoration         | Passed | SQLite-backed chronological queries                                |
| Notification restoration     | Passed | Read and dismissed state persists                                  |
| Synchronization replay       | Passed | Duplicate replay suppressed by durable receipts                    |
| Protocol reconnection        | Passed | KSP harness validates retry, cursor, replay, and bootstrap         |

The platform consistently preserves durable context. Ephemeral presentation state—Mobile editor scroll position, selection restoration across process death, and per-screen scroll position—does not yet have complete release-level validation.

## 4. Performance report

### Existing platform measurements

| Workload                                    | Observed range |
| ------------------------------------------- | -------------: |
| 5,000 edits with repeated lifecycle flushes |    9.8–26.4 ms |
| Index 10,000 search documents               |  41.4–100.1 ms |
| Search 10,000-document index                |    1.6–38.4 ms |
| Rank 10,000 Continue Working items          |   10.6–48.3 ms |
| Replay 20,000 operations                    |   23.8–45.6 ms |
| Duplicate replay of 20,000 operations       |     3.5–8.2 ms |
| SQLite integrity-checked restart            |     155–159 ms |
| SQLite metadata search over 10,000 items    |     9.3–9.6 ms |

### Alpha workflow measurements

The six in-memory persona runs observed:

- Core startup: 0.6–10.6 ms;
- Quick Capture: 0.4–1.8 ms;
- long-note edit and explicit save: 0.5–1.4 ms;
- Search plus context restoration: 2.1–3.7 ms;
- suspend plus resume: 0.07–0.36 ms.

These are deterministic engine measurements, not UI frame, storage, or physical-device service-level objectives.

### Performance conclusion

No engine-level latency blocks alpha. Search, Continue Working, capture, editing, replay, and SQLite queries have substantial headroom at the current target scale.

Release-device cold launch, warm launch, first-input delay, keyboard response, long-list rendering, large-note typing frames, memory, and thermal behavior remain required before public beta.

## 5. Navigation report

### Mobile primary paths after refinement

| Goal                     | Path                                | Interaction count excluding typing |
| ------------------------ | ----------------------------------- | ---------------------------------: |
| Resume priority work     | Home → Continue card                |                                  1 |
| Browse all continuations | Home → See all → item               |                                  2 |
| Open recent work         | Home → recent row                   |                                  1 |
| Browse Workspace work    | Home → See all recent work → item   |                                  2 |
| Search and open          | Home → Search → result              |                                  2 |
| Quick Capture            | Home → Quick Capture → Capture note |                                  2 |
| Switch Profile           | Home context → Profile              |                                  2 |
| Switch Workspace         | Home context → Workspace            |                                  2 |
| View Activity            | Home → Activity                     |                                  1 |
| View Notifications       | Home → Notifications                |                                  1 |

Infrastructure status is still available but requires intentionally expanding Platform details.

### Desktop primary paths

- Search: `Command/Ctrl + K`, type, Enter.
- Quick Capture: one header action.
- Resume: one Continue Working selection.
- Workspace switching: one sidebar selection.
- Profile switching: one sidebar selection.

### Navigation conclusion

Primary paths are short and context-preserving. The main remaining risk is information density on Desktop, not excessive interaction count.

## 6. Product philosophy report

Karya demonstrates “work-centric rather than app-centric” behavior in its Core ownership and continuity model:

- Resources remain attached to human work context rather than application containers.
- Search crosses Profile, Workspace, and Resource boundaries.
- Opening restores context rather than merely navigating.
- Continue Working ranks resumable work instead of presenting a raw file list.
- Capture chooses ownership from active context.
- Activity and Notifications separate history from attention.
- local state remains useful without Cloud availability.

The certification review corrected two presentation violations: Desktop Home inventory statistics and infrastructure-first Mobile actions. It also corrected Desktop’s bypass of canonical Continue Working ranking.

Karya is visibly more than a traditional CRUD productivity application at the behavioral level. The remaining challenge is making that distinction immediately legible to a new user without explanation.

## 7. Reliability report

The complete reliability foundation currently validates:

- 5,000-edit sessions;
- 10,000 search documents;
- 10,000 Continue Working candidates;
- 20,000 duplicate-safe synchronization replays;
- integrated event storms;
- SQLite integrity, WAL, migrations, restart, indexes, and queue restoration;
- Mobile composition lifecycle;
- KSP deterministic replay, retry, cursor recovery, bootstrap, and transport neutrality;
- 100 logical replicas, 100,000 operations, and one million receipts.

The Alpha workflow suite adds seven tests: six persona cycles and one performance report. No product workflow generated duplicate Resources, stale Search results, lost context, missing continuation, or editing loss.

Reliability is sufficient for controlled alpha use. Physical-device crash, low-storage, OS process termination, memory pressure, permission revocation, and extended battery-background tests remain release-validation work.

## 8. Recommended improvements

### Required before unqualified product certification

1. Run observed first-use sessions with at least two participants from each target persona category.
2. Measure Profile/Workspace comprehension without coaching and revise onboarding copy from evidence.
3. Test an eight-hour real workday followed by next-day resumption on Desktop and Mobile.
4. Complete release-device accessibility and performance audits.
5. Validate capture abandonment and whether users need optional initial note content before entering the editor.
6. Validate Mobile large-note cursor, selection, scroll, keyboard, and process-death restoration.

### High-value refinements that do not require new engines

- preserve Mobile editor selection and scroll position through the existing edit-session model;
- provide an optional content field in Quick Capture by composing Capture and Editing through Core;
- progressively simplify Desktop Home based on usage evidence;
- show a Core-owned continuation reason when ranking provenance becomes available;
- add undo for common archive actions where existing lifecycle semantics permit it;
- add instrumented navigation and abandonment measurements with privacy-preserving local telemetry during dogfood.

### Explicitly deferred

Cloud, authentication providers, HTTP transport, AI, collaboration, SDK, Widgets, Tablet, and Karya OS do not address current certification gaps and remain out of scope.

## 9. Architectural concerns

No constitutional defect requires redesign.

The audit found one ownership violation in presentation: Desktop Home derived its own recent-resource continuation instead of consuming the Core Continue Working result. This is fixed.

Remaining concerns are bounded:

- Continue Working exposes ranking output but not ranking provenance, forcing presentation to infer “opened” or “edited” from timestamps.
- Mobile Quick Capture and Editing compose as separate routes; adding initial content must preserve Capture Engine ownership rather than creating Resources from React.
- large single-Workspace Continue Working collections remain in-memory ranked;
- Search metadata candidates still include deserialization paths that may need FTS at substantially larger scale;
- replay receipt retention and compaction remain future protocol decisions;
- Desktop visual density may obscure the otherwise coherent Core model.

These are evolutionary concerns, not blockers for controlled local-first alpha use.

## 10. Alpha certification status

### Certified statements

We can confidently state:

> Karya v1.0 Alpha implements a coherent local-first working environment organized around meaningful work and continuity of context.

> Karya is reliable and fast enough for structured internal daily use and dogfooding before Cloud connectivity.

### Statement not yet certified

We cannot yet responsibly state:

> Every target user would voluntarily choose Karya as their primary working environment every day.

That is an observed product outcome, not an inference available from automated tests or an internal code review.

### Promotion gate

Karya v1.0 Alpha becomes unconditionally product-certified when:

- representative users understand Profile, Workspace, and Resource ownership without coaching;
- they naturally use Capture and rely on Continue Working over repeated days;
- Search consistently beats their previous retrieval workflow;
- editing and restoration remain trustworthy during real interruptions;
- release-device accessibility and latency meet the product’s quiet, immediate character;
- no P0 or P1 data-loss, continuity, navigation, or comprehension defect remains.

Until those gates pass, the correct next phase is focused dogfood and usability refinement—not more platform capabilities.

## Verification command

```sh
pnpm test:alpha
```
