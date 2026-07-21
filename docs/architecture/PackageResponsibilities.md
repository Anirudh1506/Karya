# Package Responsibilities

## Foundations

| Package                | Responsibility                                     | Runtime scope |
| ---------------------- | -------------------------------------------------- | ------------- |
| `@karya/types`         | Shared data contracts and portable value utilities | Shared        |
| `@karya/domain`        | Aggregates, invariants, lifecycle rules            | Shared        |
| `@karya/core`          | Deliberate client-facing Core façade               | Shared        |
| `@karya/kernel`        | Composition, command orchestration, lifecycle      | Shared        |
| `@karya/event-bus`     | Typed event publication and subscription           | Shared        |
| `@karya/state-engine`  | Derived platform state                             | Shared        |
| `@karya/platform`      | Device capability interfaces                       | Shared        |
| `@karya/persistence`   | Repository and unit-of-work contracts              | Shared        |
| `@karya/design-tokens` | Framework-neutral design primitives                | Shared        |
| `@karya/tooling`       | Repository lint and formatting policy              | Development   |

## Capability packages

Resource, Workspace, Profile, Search, Query, Continuity, Relationship, Notification, Activity, Event, Settings, Command, Application Registry, and Import services retain their existing focused ownership.

## Desktop packages

| Package                      | Responsibility                                       |
| ---------------------------- | ---------------------------------------------------- |
| `apps/shell`                 | Electron lifecycle, IPC, Desktop renderer, packaging |
| `@karya/shell-adapter`       | Desktop-facing Core API                              |
| `@karya/metadata-store`      | `better-sqlite3` repositories and migrations         |
| `@karya/content-store/node`  | Node filesystem content storage                      |
| `@karya/import-service/node` | Node filesystem import traversal                     |
| `@karya/ui`                  | React DOM Desktop primitives                         |

## Deferred packages

Database, logging, configuration, synchronization, identity, Cloud, and SDK packages are not created until their ownership is proven by implemented requirements.
