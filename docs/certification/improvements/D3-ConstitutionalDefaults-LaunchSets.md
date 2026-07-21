# D3 — Constitutional Defaults and Immediate Launch Set Projection

## Status

Implemented. Automated verification passed; observed workflow revalidation remains pending.

## Reported evidence

1. The prior empty-state correction also removed the Default Profile and Default Spaces, which are required platform state rather than invented user content.
2. The first application added to a Launch Set was persisted but did not appear. A second mutation caused the prior state to appear.
3. Move presented every destination in one combined selector instead of collecting Profile and Space intent separately like Reference.
4. Workspace Settings mixed Overview information with configuration, used a 50/50 layout, and presented Launch Sets as part of Continue Working.

These are treated as product failures. No onboarding or philosophical defense is proposed.

## Root causes

- Client startup requested a seed with no initial context, conflating constitutional defaults with sample data.
- `WorkspaceLaunchSetUpdated` existed as a Workspace domain event, but the Workspace Service did not publish a typed platform event for it.
- The State Engine therefore received no Launch Set-specific mutation and retained its previous Workspace projection. A later, unrelated Workspace event refreshed the projection and exposed the already-persisted prior value.

## Corrections

- `createSeedData` always creates the Default Profile, Desktop Default Space, Profile Default Space, and active session. The option that allowed callers to suppress required initial context was removed.
- Desktop and Mobile continue to disable demo content. Fresh stores therefore contain constitutional defaults but no Resources, references, or sample content.
- Both persistence implementations now upsert missing constitutional records by stable ID and repair a missing or invalid active session. Existing user-created records are preserved.
- The Workspace Service now translates the domain mutation into `WorkspaceLaunchSetUpdated`.
- The State Engine subscribes to that event and immediately replaces the affected Workspace projection. Existing snapshot subscriptions then notify Desktop without a refresh, navigation change, restart, or second mutation.
- Move now asks for Profile first and then shows only Spaces owned by that Profile. “None — Desktop Default Space” remains an explicit platform destination. Core normalizes the selection through the shared destination resolver and atomically updates both Resource ownership and placement.
- Workspace Settings now uses full-width vertical sections for Identity, Appearance, Workspace Experience, Continue Working, Launch Sets, Workspace Preferences, and Danger Zone. Overview-only state, Profile, last-opened, statistics, and resource-count fields were removed.
- Workspace identity, visual treatment, landing behavior, Resource presentation, notification scope, continuity policy, capture placement, relationship/activity/search preferences, synchronization/offline overrides, and Launch Set startup policy persist on the Workspace aggregate and project immediately through Core.
- Continue Working restores saved continuity. Launch Sets restore the environment. Both can run together, while Launch Set testing bypasses continuity restoration.
- Applications and Resources enter one ordered Launch Item sequence. Every Launch Item can be enabled or disabled, reordered, delayed, configured, focused where applicable, and removed. Sequential/parallel execution, failure handling, restore behavior, and ready notifications are persisted with the sequence.
- Workspace Settings shows only a compact Launch Set summary. The application/Resource picker and startup sequence live in a dedicated full-screen overlay editor so large Launch Sets do not expand or overwhelm the settings page.
- Workspace duplication copies configuration, Resource references, pinned applications, and Launch Sets without copying system-owned content. Export produces a versioned JSON Workspace manifest.

## Event flow

```text
UpdateWorkspaceLaunchSetCommand
  -> WorkspaceService.updateLaunchSet
  -> WorkspaceAggregate.WorkspaceLaunchSetUpdated
  -> Workspace repository save
  -> Event Bus WorkspaceLaunchSetUpdated
  -> State Engine applyWorkspaceUpdated
  -> Kernel snapshot commit
  -> Desktop subscription notification
```

## Automated evidence

- A production Core boot contains exactly one Default Profile, two required Default Spaces, and no Resources or Workspace references.
- A Mobile store created during the missing-default interval is repaired without replacing an existing user Profile.
- A Desktop SQLite store with an invalid prior session is repaired without replacing an existing user Profile.
- Launch Set creation is visible in the Core snapshot immediately after the first mutation.
- Enable, disable, second-application addition, removal, and reset are visible immediately.
- Every tested mutation publishes exactly one typed Launch Set event.
- The final Launch Set is restored from the Workspace repository after a Core restart.
- Resource moves succeed from Profile to Profile, Profile to Desktop Default Space, and Desktop Default Space back to a Profile. Invalid Profile/Space combinations remain rejected by Core.
- Per-item enable state survives Workspace mapping, event projection, and Core restart restoration.
- Workspace customization and expanded Launch Set startup policy survive event projection and Core restart restoration.

## Manual revalidation

1. Launch with a new database. Verify the Default Profile and both Default Spaces exist and contain no Resources.
2. Add the first application to a Workspace Launch Set. Verify it appears immediately.
3. Disable and re-enable the Launch Set. Verify each state appears immediately.
4. Add a second application and remove the first. Verify both mutations appear immediately.
5. Change Workspaces and return. Verify the correct Launch Set is shown.
6. Restart Karya. Verify the final Launch Set is restored exactly.
7. Move a Resource between two Profiles, into Desktop Default Space, and back to a Profile. Verify Profile and Space are selected separately and the Resource appears only in the chosen destination.
8. Open Workspace Settings and verify all seven sections use the full width in one vertical scroll. Confirm no Overview statistics or last-opened information appears.
9. Configure Continue Working and a Launch Set independently. Disable one Launch Item, restart Karya, and verify the item remains disabled and is skipped during launch.
10. Change identity, appearance, landing, Resource display, continuity, and Workspace preferences. Restart Karya and verify each value and its live behavior are restored.
11. Duplicate the Workspace and verify its configuration, Resource references, pinned applications, and Launch Set are preserved. Export its manifest and verify the JSON contains no Resource content.
12. Open the Launch Set editor and verify the overlay owns its own scroll area, closes with Escape/backdrop/close button, and leaves no application list visible on Workspace Settings.

Record whether any refresh, second interaction, navigation change, or restart was needed to reveal a mutation. Any such occurrence keeps the finding open.
