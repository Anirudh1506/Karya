# Architecture Overview

## Runtime model

Karya clients are presentation and platform-composition boundaries. The Kernel coordinates commands, queries, services, persistence contracts, and Event Bus subscriptions. Domain packages own invariants. Adapters supply device and storage behavior.

```text
Desktop                                      Mobile
Electron main / preload / React              Expo / React Native
        |                                           |
Shell Adapter                                Mobile composition root
        |                                           |
        +---------------- Core ---------------------+
                             |
                           Kernel
               commands, queries, DI lifecycle
                             |
     Event Bus <-------- capability services ------> State Engine
                             |
                  Domain and repository contracts
                             |
            Desktop SQLite / future Mobile SQLite
```

## Ownership rules

- Domain packages own invariants and lifecycle meaning.
- Services own reusable capability behavior.
- Kernel owns composition and command orchestration.
- Event Bus communicates completed platform facts.
- Persistence owns repository contracts, not a specific SQLite library.
- Platform owns capability contracts, not native implementations.
- Clients own rendering, direct input, navigation presentation, and concrete adapter registration.

## Phase 1 boundary

Phase 1 established runtime, navigation, deep-link, theme, and state-provider boundaries without product destinations. Phase 2 connected that foundation to a client-safe Core composition root.

## Phase 2 Mobile runtime

Mobile now owns a single composition root that registers Expo platform adapters, Expo SQLite persistence, repositories, and the existing Core. App State transitions suspend and resume Core through the existing Service Registry. See [Mobile Composition Root](MobileCompositionRoot.md).
