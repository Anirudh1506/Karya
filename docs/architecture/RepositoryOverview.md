# Repository Overview

Karya is a pnpm and Turbo monorepo containing multiple clients and one shared platform core.

## Top-level layout

```text
apps/
  shell/                 Electron Desktop client
  mobile/                Expo development-build client foundation
packages/
  core/                  Public Core façade
  kernel/                Composition, commands, queries, service lifecycle
  domain/                Aggregates and invariants
  types/                 Shared contracts and data types
  platform/              Native capability abstractions
  persistence/           Repository and unit-of-work contracts
  event-bus/             Typed platform event distribution
  *-service/             Focused capability owners
  metadata-store/        Desktop SQLite persistence adapter
  content-store/         Shared contract plus Desktop Node adapter entry point
  shell-adapter/         Desktop-facing Core adapter
  ui/                    Desktop React DOM primitives
  design-tokens/         Framework-neutral visual primitives
  tooling/               Shared lint and formatting policy
docs/
  architecture/          Current architecture documentation
  adr/                   Architectural decisions
```

`apps/shell` retains its existing name to avoid a disruptive rename. Its responsibility is Desktop.

## Workspace operation

- `pnpm dev:desktop` starts Electron Desktop.
- `pnpm dev:mobile` starts Expo for a development client.
- `pnpm typecheck` validates all typed workspaces.
- `pnpm lint` applies shared repository policy.
- `pnpm test` runs package tests.
- `pnpm build` builds the complete workspace graph.
- `pnpm verify` runs the full validation pipeline.
