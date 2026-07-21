# Phase 1 Migration Notes

## Changes

- Added the Expo Mobile client foundation at `apps/mobile`.
- Added framework-neutral design tokens.
- Added shared ESLint and Prettier policy.
- Added common root development and verification scripts.
- Split Node implementations into explicit package subpath exports.
- Replaced Kernel `node:path` use with portable path utilities.
- Extended Platform contracts with Camera and Secure Storage boundaries.
- Preserved the existing Event Bus, service ownership, persistence contracts, and Desktop client structure.

## Behavior compatibility

No Resource, Profile, Workspace, Search, Capture, Notification, synchronization, authentication, AI, Settings, or other product capability was added to Mobile. Existing Desktop commands and services retain their behavior.

## Deferred work

- Mobile persistence adapter and Core bootstrapping.
- Dedicated synchronization and identity capabilities.
- Shared configuration or logging packages.
- Strict unused-symbol linting for the legacy Desktop renderer.
- Progressive Desktop adoption of shared design tokens.

## Known tooling baseline

The previous repository had no ESLint baseline and contains significant existing unused-code findings, particularly in the Desktop renderer and generated command registration modules. Phase 1 enables recommended correctness rules but defers unused-symbol enforcement to a dedicated cleanup that can be reviewed independently from platform setup.
