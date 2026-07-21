# Profile Management — Vertical Slice 01

## Scope

Profile Management is the first user-facing Karya Mobile vertical slice. It adds only the ability to list, create, activate, archive, and restore Profiles. It does not add Workspace, Resource, Search, Capture, authentication, synchronization, settings, or cloud behavior.

## Architecture

```text
ProfileListScreen / CreateProfileScreen
  -> Mobile profile interaction adapter
  -> Kernel ShellApi
  -> CommandBus
  -> ProfileService
  -> ProfileRepository
  -> ExpoSqliteStore

ProfileService
  -> EventBus
  -> StateEngine
  -> ShellApi subscription
  -> Mobile render
```

React owns navigation, form input, pending indicators, and surfaced errors. Profile truth remains in Core. Screens never resolve services, construct repositories, or call Expo SQLite directly.

## Navigation and UX

- `karya://profiles` opens the Profile list.
- `karya://profiles/new` opens Profile creation.
- The list distinguishes the current Profile from other active Profiles.
- Selecting an active Profile switches context through Core immediately.
- Creation accepts a required name and optional icon and accent color, then activates the new Profile.
- Archive uses an explicit destructive confirmation and remains recoverable.
- Archived Profiles remain visible and may be restored.
- The existing design-token package supplies spacing, typography, color, and radius values for light and dark appearances.

## Startup and Restoration

Kernel startup restores `ContinuitySession.activeProfileId` before State Engine hydration. The persisted Profile must exist and remain active; otherwise Core retains its valid seed fallback. This guarantees that the first Mobile snapshot after a restart identifies the same active Profile as the previous session.

```text
SQLite opens
  -> repositories start
  -> persisted continuity session loads
  -> active Profile restores
  -> State Engine hydrates
  -> Mobile subscribes to the synchronous Shell snapshot
```

## Persistence and Events

Profiles continue to use the existing `ProfileRepository`; Mobile supplies its existing JSON-backed SQLite implementation. Active selection continues to use the existing continuity session repository. No schema or repository contract was added.

The slice relies on existing Profile events, including `ProfileCreated`, `ProfileUpdated`, `ProfileOpened`, `ActiveProfileChanged`, `ProfileArchived`, and `ProfileRestored`. The Event Bus remains the only propagation mechanism from Core into derived state.

## Edge Cases

- Whitespace-only names are rejected by the Mobile form.
- Repeated actions are disabled while the selected command is pending.
- Core prevents archiving the last active Profile.
- Archiving the current Profile activates a valid fallback through Profile Service.
- Archived Profiles cannot be selected until restored.
- Missing or archived persisted Profile IDs safely fall back during startup.
- Persistence and startup failures are surfaced without fabricating client-side Profile state.

## Verification

Automated coverage includes:

- deterministic Mobile create-and-activate command ordering;
- Mobile switch, archive, and restore command routing;
- Profile creation, activation, archival, restoration, derived state, and domain events through Core;
- SQLite Profile and continuity-session persistence across database closure and reopening;
- active-Profile restoration before initial State Engine hydration;
- existing Mobile composition-root lifecycle tests.

The repository verification pipeline remains the release gate: TypeScript, lint, unit tests, Desktop build, Expo export, and iOS/Android Hermes bundle generation.

## Next Slice Boundary

The next feature may consume the active Profile context, but should not expand this slice retroactively. Workspace or Resource work should enter as a separate vertical slice through the same Shell API, Event Bus, repository, and composition-root boundaries.
