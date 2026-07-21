# Mobile Composition Root

**Phase:** Platform Implementation 2  
**Status:** Implemented

## Purpose

The Mobile composition root is the only location where Karya Mobile assembles platform adapters, persistence, repositories, Kernel, and Core. React components do not construct business services or repositories.

## Dependency graph

```text
AppProviders
  -> MobileCoreLifecycle
      -> createMobileCompositionRoot
          -> ExpoPlatformProviders
          -> ExpoSqliteStore
              -> persistence repositories
              -> domain Resource/Workspace repositories
              -> query repositories
          -> createKaryaCore
              -> Kernel ServiceRegistry
                  -> Event Bus
                  -> existing Core services
```

Expo APIs terminate at adapters inside `apps/mobile`. Core receives only `PlatformProviders`, repository contracts, query contracts, and lifecycle calls.

## Startup sequence

1. `MobileCoreLifecycle` mounts once.
2. The composition root serializes a start operation.
3. Expo SQLite opens `karya-mobile.db`.
4. WAL and foreign-key modes are enabled.
5. Migrations create the migration ledger and entity storage.
6. Repository and query adapters are supplied to Core.
7. Existing production bootstrap data is persisted if the database is structurally empty. Demo content remains disabled.
8. Kernel initializes existing services deterministically.
9. Service Registry starts Event Bus first and dependent services afterward.
10. State Engine hydrates and Core becomes `running`.
11. The application remains visually idle.

## Lifecycle sequence

```text
active
  -> Core running

inactive/background
  -> Service Registry stops in reverse dependency order
  -> Event Bus stops last
  -> events published while suspended are buffered
  -> Core suspended

active
  -> Event Bus starts first
  -> buffered events are delivered
  -> dependent services restart
  -> Core running
```

App State transitions and composition operations share a serialized queue. Duplicate start, suspend, resume, and shutdown requests are idempotent.

## Shutdown sequence

1. The lifecycle bridge removes its App State subscription.
2. Composition root enters `stopping`.
3. Core unsubscribes State Engine.
4. Service Registry stops services in reverse dependency order.
5. Event Bus stops and clears subscriptions and buffers.
6. Core invokes the registered persistence close operation.
7. Expo SQLite closes.
8. Composition root becomes `stopped` and cannot restart.

Mobile operating systems may terminate a suspended process without executing JavaScript cleanup. SQLite transactions and WAL provide durable process-safe storage; shutdown remains deterministic whenever the runtime delivers unmount or termination handling.

## Platform adapters

| Capability      | Phase 2 behavior                          |
| --------------- | ----------------------------------------- |
| Clipboard       | Expo Clipboard read/write                 |
| Secure storage  | Expo Secure Store get/set/remove          |
| Camera          | Capability-safe unavailable placeholder   |
| Notifications   | No-op startup stub                        |
| Applications    | Empty mobile application-provider adapter |
| Filesystem      | Capability-safe unavailable placeholder   |
| Downloads       | Empty mobile adapter                      |
| Web metadata    | Unavailable placeholder                   |
| Window controls | No-op mobile adapter                      |

Capabilities without a Phase 2 use case remain behind existing contracts and expose no Expo APIs to Core.

## SQLite adapter

`ExpoSqliteStore` implements existing persistence contracts without introducing a database package or changing repository interfaces.

- Uses Expo SQLite asynchronous APIs.
- Enables WAL.
- Owns a migration ledger.
- Stores repository records as versionable JSON envelopes keyed by kind and stable identity.
- Implements atomic unit-of-work transactions.
- Adapts persisted Resource and Workspace DTOs through existing domain mappers.
- Reuses existing query behavior rather than duplicating filter and ranking rules.
- Opens and closes idempotently.

The current query adapters materialize repository collections before applying existing query semantics. Before the first unbounded collection feature ships, these adapters should move filtering, ordering, and pagination into indexed SQLite queries without changing their contracts.

## Structural bootstrap data

Core currently requires an active Profile, Default Space, and Continuity session during hydration. Mobile uses the existing `includeDemoContent: false` production seed. It creates no Resources, activities, notifications, applications, or sample content. Removing these structural entities would require changing established Core invariants and is outside this infrastructure phase.

## Verification

Smoke tests cover:

- Core boot/suspend/resume/shutdown idempotency.
- Event Bus start/stop and buffered delivery.
- SQLite open/migrate/transaction/close lifecycle.
- Composition-root ordering and single Core construction.
- Mobile Hermes resolution of the actual Core graph.

Successful Metro exports for iOS and Android prove that the Mobile runtime graph does not resolve Electron, Node filesystem, or `better-sqlite3` implementations.

### Local native-toolchain status

Expo native prebuild completes for iOS and Android. On the current development machine, installing or launching a native client remains externally blocked:

- iOS: full Xcode is not selected; only Command Line Tools are active. The repository path also contains spaces, which React Native 0.83 prebuilt artifact handling rejects during CocoaPods validation.
- Android: no Android SDK location or emulator/device is configured.

These limitations occur after configuration generation and are independent of the passing TypeScript, smoke-test, Desktop build, and iOS/Android Hermes bundle checks.
