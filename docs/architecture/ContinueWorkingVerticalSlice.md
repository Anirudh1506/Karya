# Continue Working — Vertical Slice 04

## Purpose

Continue Working is a Core capability that answers: “What should the user resume right now?” It restores relevant work within the active Profile and Workspace. The Mobile client presents the result but does not calculate relevance.

## Architecture

```text
Resource / Workspace / Profile commands
                  |
                  v
              Event Bus
                  |
                  v
      ContinueWorkingService
       |          |          |
       v          v          v
  Continuity   Resource   Context repositories
    session     records   Profile + Workspace
       \          |          /
        deterministic ranking
                  |
                  v
      ContinueWorkingUpdated
                  |
                  v
          State Engine snapshot
                  |
                  v
             Mobile UI
```

The implementation extends the existing `continuity-service` package. It does not introduce another repository, polling loop, or client-side ranking implementation. `ContinueWorkingItem` is a discriminated model with `kind: "resource"`, allowing a future `kind: "session"` variant without replacing consumers.

## Ranking

Only active Resources in the active Profile and Workspace are eligible. Ordering is deterministic:

1. The currently selected Resource, when present.
2. Most recently opened, descending.
3. Most recently modified, descending.
4. Most recently created, descending.
5. Resource name, using a stable lexical comparison.
6. Resource ID as the final stable tie-breaker.

Each item includes Resource, Workspace, and Profile identity and display names, Resource type, last-opened and last-modified timestamps, and a computed resume timestamp. Content is never included.

## Persistence

Ranking inputs are persisted as existing domain facts rather than as a duplicate materialized list:

- Resource timestamps and lifecycle state remain in Resource persistence.
- Active Profile and Workspace remain in the continuity session.
- Resource-open activity remains in each persisted Workspace activity timeline.
- The current selection remains in the persisted Workspace session.

At Core boot, repositories and continuity are restored first. Continue Working is then rebuilt deterministically before startup completes. This preserves the result across application restart and Core restart while keeping one source of truth.

## Event flow

The service refreshes from Event Bus notifications for Resource open, create, rename, update, move, archive and restore, and active Workspace or Profile changes. It publishes `ContinueWorkingUpdated`; the State Engine applies the new ordered collection to the Core snapshot. Refreshes are serialized so event bursts cannot commit stale results out of order. There is no polling.

Resource movement records activity in the destination Workspace without changing the user's active context. Archiving removes a Resource from eligibility immediately. Switching context recomputes visibility immediately.

## Restoration and lifecycle

```text
Core boot
  -> restore Profile
  -> restore Workspace
  -> restore continuity activity
  -> rank Continue Working
  -> publish snapshot

Core suspend
  -> stop event subscriptions
  -> preserve persisted facts and current snapshot

Core resume
  -> restart subscriptions
  -> refresh Continue Working

Core shutdown / next launch
  -> close persistence
  -> reopen persistence
  -> repeat deterministic restoration
```

## Mobile flow

The Resources view links to a minimal Continue Working screen. Cards show Resource name, type, Workspace, and last activity. Selecting a card calls the existing Core Resource-open interaction and then navigates to the Resource detail surface. Empty state copy is scoped to the active Workspace. Mobile owns no business behavior.

## Verification coverage

Automated tests cover deterministic ordering and stable tie-breaking, metadata projection, empty and invalid contexts, event propagation, rename, archive and restore, Profile switching, Workspace switching, Resource movement, lifecycle suspend/resume, and complete Core restart using persisted continuity facts.

## Remaining work before Home

- Define how Home composes Continue Working with other Core capabilities without duplicating its ranking.
- Add presentation-level accessibility and interaction tests for the final Home composition.
- Decide the display limit and progressive disclosure behavior in Home.
- Preserve the discriminated item contract when Session continuation is introduced; Sessions are intentionally not implemented in this slice.
