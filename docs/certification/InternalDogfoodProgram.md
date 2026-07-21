# Karya v1.0 Alpha Internal Dogfood and Product Certification Program

- **Program state:** Active
- **Start:** 2026-07-15 (Day 1)
- **Day 7 review:** 2026-07-21
- **Day 14 review:** 2026-07-28
- **Day 21 review:** 2026-08-04
- **Day 30 final review:** 2026-08-13
- **Current certification:** Engineering alpha certified; Primary Work Environment not yet certified
- **Scope:** Existing local-first Desktop and Mobile product

## Purpose

This program determines whether Karya meaningfully improves real work and deserves to become a user's primary working environment. It does not certify architecture by proxy and it does not treat synthetic tests as evidence of comprehension, trust, delight, or habit.

The architecture and capability set are frozen. During this program, changes are limited to UX, workflow, accessibility, performance, reliability, navigation, continuity, physical-device usability, and defect fixes. Cloud or HTTP providers, authentication providers, AI, SDKs, Tablet, Widgets, Karya OS, new engines, and new architectural layers are prohibited.

## Rule 0 — No philosophical defenses

The team must never defend unsuccessful product behavior by explaining Karya's philosophy, architecture, intended power, or conceptual model. The product must defend itself through usage.

Interpret observations literally:

| Participant evidence                                                                  | Required interpretation                                                                       | Prohibited defense                                   |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| “I don't understand Profiles.”                                                        | Profile comprehension failed. Investigate why the interface did not communicate it.           | Explain Karya's Profile philosophy.                  |
| The participant never uses Continue Working.                                          | Continue Working was not naturally chosen. Investigate discoverability, relevance, and trust. | Claim the participant does not understand its power. |
| The participant opens Finder instead of Karya Search for work Karya claims to manage. | Search failed that workflow. Record the exit and its cause.                                   | Default to “users need onboarding.”                  |
| The participant seeks a manual save action.                                           | Autosave trust was not established.                                                           | Explain that autosave is technically reliable.       |
| The participant reconstructs context manually.                                        | Continuity failed from the participant's perspective.                                         | Explain that Core restored internal state.           |

Onboarding is a product surface and may be evaluated like any other surface, but it must not be used as a blanket explanation for failed comprehension. A facilitator may ask neutral follow-up questions after observing failure; teaching the intended model invalidates that task as uncoached comprehension evidence.

Rule 0 applies to sessions, defect triage, review reports, recommendations, and the final certification decision. Architectural correctness may explain a defect's mechanism, but it may never override observed product evidence.

## Certification decision rule

The final statement may be approved only when every hard gate is satisfied:

> Karya v1.0 Alpha provides a meaningful improvement over existing workflows and can confidently serve as a user's primary working environment.

Missing evidence is a failure to certify, not a pass. A simulator is not physical-device evidence. Automated persona tests are engineering evidence, not user evidence. A participant's stated willingness must not be inferred from task completion.

### Hard gates

| Gate                  | Required evidence                                                                                        | Pass condition                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Product comprehension | Uncoached first-use sessions across all six personas                                                     | At least 80% correctly explain Profile, Workspace, Resource, and ownership after use                        |
| Core workflow success | Observed resume, capture, search, edit, and context-switch tasks                                         | At least 90% completed without intervention; no critical workflow below 80%                                 |
| Natural adoption      | Daily first-choice and avoidance observations                                                            | Continue Working, Search, Capture, and Editing are each chosen naturally by a majority of relevant sessions |
| Desirability          | End-of-day and next-day responses                                                                        | At least 80% would willingly use Karya again; qualitative evidence supports a meaningful improvement        |
| Continuity            | Suspend, resume, restart, process death, editing, search, capture, notification, and continuation trials | 100% restoration for committed work; zero confirmed data-loss incidents                                     |
| Autosave trust        | Long editing and interruption trials                                                                     | Zero lost committed edits; users can correctly identify save/recovery state                                 |
| Accessibility         | VoiceOver, TalkBack, keyboard-only, 200% text, reduced motion, contrast, and focus-order sessions        | No blocker or critical defect; every primary workflow is independently operable                             |
| Physical devices      | Current and lower-performance supported iOS and Android devices plus Desktop                             | Primary workflows, process death, restart, large notes, and long sessions pass on each required class       |
| Reliability           | Daily smoke checks and weekly full verification                                                          | No open P0/P1 defect; no recurring restart, refresh-loop, database, or lifecycle failure                    |
| Performance           | Release-like physical-device measurements                                                                | No user-blocking latency; regressions are investigated against Day 0 and the preceding review               |

Thresholds are fixed before Day 1 observations. They may be made stricter, but must not be relaxed after results are known merely to obtain certification.

Leaving Karya for a workflow the current product claims to support counts as a failed Karya workflow, even when the external tool completes the participant's broader task.

## Participants and coverage

Recruit at least two participants from each target workflow: Student, Engineer, Founder, Researcher, Designer, and Writer. A single person may contribute multiple daily sessions, but cannot substitute for coverage across personas.

Each participant should use realistic, non-sensitive work. Test data must be backed up or disposable. Do not place the only copy of important work in an alpha build.

## Daily protocol

Each day has one primary 45–90 minute work session and a next-use resumption check. Rotate personas so every persona is represented before each review gate.

1. Record build identity, platform, device, OS, accessibility settings, and whether the session is observed.
2. Start from the participant's natural entry point. Do not instruct them to use a particular feature after the initial task is stated.
3. Ask them to resume existing work, capture an incoming idea, find known work, edit a substantive note, and switch context when the workflow calls for it.
4. Introduce one continuity transition: background/foreground, restart, process death, or Desktop quit/relaunch.
5. Record elapsed time and interactions for resume, capture, search, edit, and context switching.
6. Record feature choice, abandonment, hesitation, error recovery, continuity result, and any trip outside Karya.
7. Ask the daily product questions verbatim and preserve concise participant language.
8. Classify findings and link defects. Only permitted product improvements may enter the program build.
9. Run the daily smoke suite after any accepted fix.
10. Recheck the session on the next day to determine whether work was restored and whether the participant voluntarily returns.

Use [Daily Session Template](./DailySessionTemplate.md) for every session. Never backfill subjective answers from memory.

## Experience-specific observations

### Continue Working

Record whether it was chosen without prompting, whether its ordering made sense, whether it beat browsing or recent files, whether context was restored, and whether the participant would miss it.

### Universal Search

Record discoverability, query attempts, result comprehension, time to target, context restoration, and whether another navigation path was preferred. Search must not be credited when the facilitator suggested it.

### Quick Capture

Measure open-to-commit time, abandonment, context comprehension, interruptions, and whether the participant continued into Editing. Capture is successful only when the Resource persists and appears naturally throughout the product.

### Editing

Use realistic long-form content. Record input continuity, autosave confidence, large-note behavior, interruption recovery, cursor/selection/scroll restoration, and any manual save-seeking behavior.

### Workspace philosophy

Ask participants to explain Profile, Workspace, Resource, ownership, and continuity in their own words. Do not teach the answer immediately before asking.

## Physical-device matrix

| Platform | Required class                         | Day 0 availability           | Evidence state                                          |
| -------- | -------------------------------------- | ---------------------------- | ------------------------------------------------------- |
| Desktop  | Apple Silicon Mac used for development | Mac mini available           | Engineering only; observed extended-use session pending |
| iOS      | Current supported iPhone               | No connected physical iPhone | Pending                                                 |
| iOS      | Lower-performance supported iPhone     | Not available                | Pending                                                 |
| Android  | Current supported phone                | No connected Android device  | Pending                                                 |
| Android  | Lower-performance supported phone      | Not available                | Pending                                                 |

iOS simulators are installed and may be used for development reproduction, but do not satisfy the table. The Android toolchain is installed; no Android device was attached on Day 0.

## Physical-device scenarios

Run each primary workflow plus:

- cold and warm launch;
- five background/foreground cycles;
- OS process termination followed by relaunch;
- low-memory interruption where the platform permits safe reproduction;
- 25,000-character everyday note and 100,000-character stress note;
- at least a 60-minute uninterrupted editing session;
- keyboard appearance/dismissal and selection near the beginning, middle, and end of a long note;
- 200% text, screen reader, reduced motion, dark mode, and orientation changes supported by the client;
- low-storage warning behavior without intentionally risking user data.

## Measurements

Use a monotonic stopwatch or platform profiler and record raw values, not impressions alone.

| Measure                  | Start                    | End                                               |
| ------------------------ | ------------------------ | ------------------------------------------------- |
| Cold startup             | App process launch       | Home interactive                                  |
| Warm startup             | Foreground request       | Home interactive                                  |
| Resume work              | Home interactive         | Intended Resource editable                        |
| Search                   | Search action            | Intended result open and context restored         |
| Capture                  | Capture action           | Persisted Resource detail open                    |
| Edit                     | Resource open            | First accepted input; also record save settlement |
| Context switch           | Profile/Workspace action | New context content stable                        |
| Autosave                 | Last input               | Durable saved state reported                      |
| Synchronization overhead | Engine cycle begins      | Local queue settles                               |

Engine timings remain supporting evidence. User-perceived measurements must come from release-like Desktop or physical Mobile sessions.

## Daily product questions

Ask after each session:

1. Did you enjoy using Karya?
2. What annoyed you?
3. What felt magical?
4. What felt unnecessary?
5. What did you avoid using?
6. What required too many interactions?
7. What broke continuity?
8. Would you miss this tomorrow?
9. Would you willingly use Karya again?
10. If Karya were removed tomorrow, what would you miss most—or would you miss nothing?

Question 10 must accept “nothing” without challenge or reframing. Repeated unaided answers such as Continue Working, Search, or not losing context are product-value signals; they are not proof by themselves and must be considered alongside actual usage.

## Finding severity and change control

- **P0:** data loss, corruption, security or privacy breach, or app unusable for all primary work. Stop the program build.
- **P1:** primary workflow blocked, repeated crash/restart loop, broken recovery, or inaccessible primary path. Certification is blocked.
- **P2:** significant friction with a reliable workaround. Fix when evidence shows repeated impact.
- **P3:** polish or isolated inconvenience. Track; do not churn the product merely to close it.

Every change must cite observed evidence, stay inside the allowed categories, and be retested against the workflow that revealed it. Architecture remains frozen unless a defect proves an existing constitutional guarantee false; that situation requires an explicit stop-and-review rather than an opportunistic redesign.

## Review cadence

The four required review documents are:

- [Day 7 Certification Report](./reviews/Day07CertificationReport.md)
- [Day 14 Certification Report](./reviews/Day14CertificationReport.md)
- [Day 21 Certification Report](./reviews/Day21CertificationReport.md)
- [Day 30 Final Certification Report](./reviews/Day30FinalCertificationReport.md)

Each review includes UX, workflow, accessibility, reliability, continuity, performance, recommended improvements, product concerns, and certification status. A review stays `Scheduled` until its calendar date and required evidence are reached.

## Roadmap certification gate

The roadmap is frozen at the Internal Dogfood Program. Architectural readiness does not authorize Connected Karya.

```text
30-day Internal Dogfood Program
  → Primary Work Environment certification
  → if passed: Connected Karya
       → HTTP Provider
       → Authentication Provider
       → Cloud Services
       → AI
  → if failed: evidence-backed Product Improvements
       → UX
       → Workflow
       → Continuity
       → Reliability
       → new 30-day re-certification
```

HTTP providers, authentication providers, Cloud services, AI, SDKs, and Karya OS remain prohibited until Primary Work Environment certification passes. A failed Day 30 decision returns Karya to product improvements followed by a complete re-certification period; it does not advance the roadmap.

## Program status ladder

| Milestone                              | Status      |
| -------------------------------------- | ----------- |
| Karya Platform                         | Certified   |
| Distributed Architecture               | Certified   |
| Cloud Architecture                     | Certified   |
| Protocol Architecture                  | Certified   |
| Engineering Alpha                      | Certified   |
| Internal Dogfood Program               | Active      |
| Primary Work Environment Certification | Pending     |
| Connected Karya                        | Not started |

## Daily register

|   Day | Date                     | Planned focus                            | Status    |
| ----: | ------------------------ | ---------------------------------------- | --------- |
|     0 | 2026-07-15               | Engineering and environment baseline     | Complete  |
|     1 | 2026-07-15               | Student / first-use and resume           | Scheduled |
|     2 | 2026-07-16               | Engineer / edit and search               | Scheduled |
|     3 | 2026-07-17               | Founder / context switching              | Scheduled |
|     4 | 2026-07-18               | Researcher / capture and retrieval       | Scheduled |
|     5 | 2026-07-19               | Designer / continuity and Mobile         | Scheduled |
|     6 | 2026-07-20               | Writer / long editing                    | Scheduled |
|     7 | 2026-07-21               | Mixed workflow and Day 7 review          | Scheduled |
|  8–13 | 2026-07-22 to 2026-07-27 | Repeat weak paths and physical devices   | Scheduled |
|    14 | 2026-07-28               | Day 14 review                            | Scheduled |
| 15–20 | 2026-07-29 to 2026-08-03 | Extended use, accessibility, recovery    | Scheduled |
|    21 | 2026-08-04               | Day 21 review                            | Scheduled |
| 22–29 | 2026-08-05 to 2026-08-12 | Confirmation, regression, next-day habit | Scheduled |
|    30 | 2026-08-13               | Final certification review               | Scheduled |

## Current decision

The program is active. Day 0 engineering evidence is recorded in [Day 0 Baseline](./Day00Baseline.md). No human daily-use or physical Mobile evidence has yet been collected in this program, so Primary Work Environment certification remains **pending**.

The first evidence collection record is scheduled as [Day 1 Student Session](./sessions/2026-07-15-day-01-student.md).
