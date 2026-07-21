# Dependency Graph

## Allowed direction

```text
apps/shell -----> shell-adapter -----> core -----> kernel
     |                    |                          |
     +-> Desktop adapters |                          +-> capability services
                          |                                  |
apps/mobile --------------+                                  +-> domain
     |                                                       +-> persistence contracts
     +-> design-tokens                                       +-> platform contracts
                                                             +-> event-bus
```

## Adapter direction

```text
metadata-store ----implements----> persistence/domain/query contracts
content-store/node -implements----> content-store contract
Electron platform --implements----> platform contracts
future Expo adapters -implement---> platform and persistence contracts
```

## Prohibited dependencies

- Domain, services, Kernel, and Core must not import Electron or React Native.
- Mobile must not import `metadata-store`, `better-sqlite3`, Node filesystem adapters, `shell-adapter`, or Desktop UI.
- Desktop adapters must not become dependencies of shared services.
- UI state must not become an authoritative Resource repository.
- Clients must not publish substitutes for typed Event Bus domain facts.

## Mobile-safe entry points

Node implementations use explicit subpath exports:

- `@karya/content-store/node`
- `@karya/import-service/node`

The root entry points expose portable contracts and behavior only.
