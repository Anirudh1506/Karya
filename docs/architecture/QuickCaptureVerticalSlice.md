# Quick Capture Vertical Slice

## Architecture

Quick Capture is a Core capability exposed by `@karya/capture-service`. Clients call the Kernel `ShellApi`; they do not construct Resources or resolve ownership.

```text
Mobile Quick Capture
  -> ShellApi capture commands
    -> CaptureService
      -> ProfileService + WorkspaceService (context validation)
      -> ResourceService (creation and SQLite persistence)
      -> EventBus (lifecycle and downstream updates)
```

The service is registered in the existing Kernel composition root. Desktop behavior and the existing `createNote` API remain unchanged.

## Capture lifecycle

1. `beginCapture()` validates the active Profile and Workspace, freezes their IDs in a short-lived capture session, and publishes `CaptureStarted`.
2. `completeCapture()` trims and validates the name, verifies that context did not change, and delegates creation to `ResourceService`.
3. `ResourceService` persists the Note Resource and publishes `ResourceCreated`.
4. `CaptureService` publishes `CaptureCompleted` and releases the capture session.
5. `cancelCapture()` releases an unfinished session and publishes `CaptureCancelled` without creating data.

The public model includes a Resource kind so later capture types can use the same lifecycle without changing the client boundary.

## Context validation

Capture requires an active, non-archived Profile-owned Workspace. Ownership, primary placement, Workspace references, and default-space placement are derived by Core. If the context is absent or changes during capture, Core returns a `CaptureContextError`; Mobile offers a shortcut to Workspace selection.

## Persistence and event flow

Completion executes through the existing Command Bus unit of work. The existing SQLite Resource repository remains authoritative. No Capture-specific database or duplicate Resource repository was introduced.

`ResourceCreated` continues to drive:

- State Engine and Home updates
- Workspace Resource membership
- Continue Working ranking
- Universal Search incremental indexing

The UI performs no refresh calls and stores no business state.

## Mobile flow

```text
Home -> Quick Capture modal -> enter name -> Create -> Resource Detail
                         \-> Cancel -> Home
                         \-> no context -> Workspace selection
```

The screen uses shared design tokens, focuses the name input, exposes only Name/Create/Cancel, and keeps styles in a separate file.

## Verification

Automated coverage includes lifecycle event order, context-derived ownership, cancellation, missing context, State Engine/Home visibility, Continue Working updates, Search indexing, persistence restoration, and mobile delegation.

## Remaining work before Notifications

- Product-level device testing for keyboard, accessibility announcements, and modal presentation on iOS and Android.
- Notification infrastructure can consume the same Event Bus; it should not couple to the Capture UI.
- Future capture Resource kinds should add kind-specific creation strategies behind `CaptureService`, preserving its public lifecycle.
