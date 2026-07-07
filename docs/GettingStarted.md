# Getting Started

Release snapshot: `v1.0.0-alpha.1`

This guide is for running Karya Desktop locally from source.

## Requirements

- macOS for the currently verified desktop package.
- Node.js compatible with the repo tooling.
- `pnpm` `9.15.4`.
- Native build tooling for `better-sqlite3`.

## Install

From the repo root:

```bash
pnpm install
```

If native dependencies need rebuilding:

```bash
pnpm --filter @karya/shell run rebuild:native
```

## Run In Development

```bash
pnpm dev
```

This starts the Electron/Vite development shell for `@karya/shell`.

## Typecheck

```bash
pnpm typecheck
```

## Production Build

```bash
pnpm build:production
```

## Package The Desktop App

```bash
pnpm --filter @karya/shell run assets:icons
pnpm --filter @karya/shell run dist
```

The generated macOS app and ZIP are written to:

```text
apps/shell/release/
```

## Run The Packaged App

After packaging:

```bash
env -u ELECTRON_RUN_AS_NODE NODE_ENV=production apps/shell/release/mac-arm64/Karya.app/Contents/MacOS/Karya
```

The `env -u ELECTRON_RUN_AS_NODE` part matters if your shell has `ELECTRON_RUN_AS_NODE` set from development scripts.

## Isolated Smoke Run

To launch with a clean temporary profile:

```bash
env -u ELECTRON_RUN_AS_NODE KARYA_USER_DATA_DIR=/private/tmp/karya-smoke NODE_ENV=production apps/shell/release/mac-arm64/Karya.app/Contents/MacOS/Karya
```

This avoids touching your normal Karya data.

## First Things To Try

1. Open Karya.
2. Create or select a Profile.
3. Create or open a Workspace.
4. Import a file or folder using Add Resource.
5. Create a Note from the Workspace Notes tab.
6. Open Universal Search with `Cmd+K`.
7. Inspect the selected Resource in the right inspector.
8. Link related objects from the Relationships tab.
9. Configure Continue Working from Workspace Settings.

## Useful Scripts

- `pnpm dev`: run the desktop shell in development.
- `pnpm typecheck`: run TypeScript checks across the workspace.
- `pnpm build:production`: create optimized production bundles.
- `pnpm dist`: package the shell through Turbo.
- `pnpm --filter @karya/shell run assets:icons`: regenerate native icons.
- `pnpm --filter @karya/shell run dist`: package the app directly.
