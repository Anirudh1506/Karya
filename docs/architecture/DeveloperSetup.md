# Developer Setup

## Requirements

- Node.js 20.19 or newer
- pnpm 9.15.4
- Desktop native build tools required by Electron and `better-sqlite3`
- For iOS: supported Xcode and Simulator tooling
- For Android: Android Studio, SDK, and an emulator or connected device

## Install

```bash
pnpm install
```

## Desktop

```bash
pnpm dev:desktop
pnpm build:desktop
```

## Mobile development build

The Mobile client uses Expo Continuous Native Generation and `expo-dev-client`.

```bash
pnpm --filter @karya/mobile ios
pnpm --filter @karya/mobile android
pnpm dev:mobile
```

The first two commands generate and install a native development build. After it is installed, `pnpm dev:mobile` starts Metro for that client.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm verify` to run the complete sequence.

## Adding a shared capability

1. Put invariants in Domain.
2. Put reusable behavior in the owning service.
3. Publish completed facts through Event Bus.
4. Define device behavior as a Platform contract.
5. Register concrete adapters in the client composition root.
6. Keep Node and Electron imports out of shared root entry points.
