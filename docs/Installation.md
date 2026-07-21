# Installation

Release snapshot: `v1.0.0-alpha.1`

Karya Desktop currently produces a verified macOS arm64 package. Windows and Linux metadata/icons are configured in the builder, but those installers have not been verified in this release snapshot.

## macOS

Generated artifacts:

```text
apps/shell/release/mac-arm64/Karya.app
apps/shell/release/Karya-1.0.0-alpha.1-arm64-mac.zip
```

To install from the ZIP:

1. Unzip `Karya-1.0.0-alpha.1-arm64-mac.zip`.
2. Move `Karya.app` to `/Applications`.
3. Launch Karya.

Because this alpha is not code signed or notarized yet, macOS may require explicit approval in System Settings before first launch.

## Build Locally

```bash
pnpm install
pnpm --filter @karya/shell run assets:icons
pnpm build:production
pnpm --filter @karya/shell run dist
```

## Application Identity

- Name: `Karya`
- Version: `1.0.0-alpha.1`
- Bundle identifier: `com.karya.desktop`
- Category: Productivity
- Publisher: Karya

## Data Location

Karya stores metadata in Electron's standard app user-data directory.

For test installs, set:

```bash
KARYA_USER_DATA_DIR=/path/to/test-data
```

This makes it possible to verify clean installs without affecting regular local data.

## Clean Install Test

Use an empty temporary user-data directory:

```bash
env -u ELECTRON_RUN_AS_NODE KARYA_USER_DATA_DIR=/private/tmp/karya-clean-install NODE_ENV=production apps/shell/release/mac-arm64/Karya.app/Contents/MacOS/Karya
```

Confirm:

- The app launches without `pnpm dev`.
- A metadata database is created.
- The app name is Karya.
- The app icon is the Karya icon, not Electron's icon.
- No demo data is seeded in production mode.

## Uninstall

For the app bundle:

1. Quit Karya.
2. Delete `Karya.app`.
3. Optionally remove the user-data directory if you want to delete local data.

The app bundle and user data are separate. Removing the app does not automatically remove user data.

## Signing Status

Signing and notarization are prepared but not enabled in `v1.0.0-alpha.1`.

Current state:

- macOS entitlements file exists.
- Hardened runtime is configured in the builder.
- Code signing is disabled unless certificates are provided.
- Notarization credentials are not configured.

Before public distribution, configure Apple Developer signing and notarization.
See [macOS Signing and Notarization](MacOSSigningNotarization.md) for the release checklist.
