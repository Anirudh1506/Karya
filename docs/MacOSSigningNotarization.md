# macOS Signing and Notarization

This checklist is required before publishing a macOS ZIP or DMG outside the Mac App Store. It prevents Gatekeeper errors such as `"Karya" is damaged and can't be opened` after users download the app from GitHub.

The permanent fix is to sign the app with a `Developer ID Application` certificate and notarize the release with Apple before uploading it.

## Requirements

- Active Apple Developer Program membership.
- Apple Developer Team ID. For Karya, use `CM2V36MJT8`.
- Xcode installed and signed in to the Apple Developer account.
- App Store Connect Team API key with the `Developer` role.
- GitHub repository access to add Actions secrets.

Do not use an `Apple Development` certificate for public GitHub releases. That certificate is for local development builds. For external macOS distribution, use `Developer ID Application`.

## Create the Developer ID Certificate

1. Open Xcode.
2. Go to `Xcode > Settings > Accounts`.
3. Add the Apple ID that owns the Apple Developer membership.
4. Select the team with Team ID `CM2V36MJT8`.
5. Click `Manage Certificates`.
6. Click `+`.
7. Choose `Developer ID Application`.

If `Developer ID Application` is not visible, confirm that the Apple Developer Program membership is active and that Xcode has refreshed the correct team.

## Export the Certificate

1. Open `Keychain Access`.
2. Select the `login` keychain.
3. Open `My Certificates`.
4. Find `Developer ID Application: <Your Name> (CM2V36MJT8)`.
5. Expand it and confirm there is a private key under the certificate.
6. Right-click the certificate and choose `Export`.
7. Save it as `karya-developer-id.p12`.
8. Protect it with a strong password.

Never commit the `.p12` file or its password to Git.

Encode the exported certificate for GitHub Actions:

```bash
base64 -i karya-developer-id.p12 | pbcopy
```

## Create App Store Connect API Credentials

Use a Team API key, not an Individual API key. Individual API keys cannot be used with Apple's notarization tooling.

1. Open App Store Connect.
2. Go to `Users and Access > Integrations > App Store Connect API`.
3. Select `Team Keys`.
4. Generate a new key.
5. Set the role to `Developer`.
6. Download the `.p8` key file. It can only be downloaded once.
7. Record the `Key ID`.
8. Record the `Issuer ID`.

Encode the `.p8` file for GitHub Actions:

```bash
base64 -i AuthKey_YOUR_KEY_ID.p8 | pbcopy
```

## Add GitHub Actions Secrets

Open the GitHub repository, then go to:

`Settings > Secrets and variables > Actions > New repository secret`

Add these secrets:

| Secret                 | Value                                       |
| ---------------------- | ------------------------------------------- |
| `MAC_CSC_LINK`         | Base64 content of `karya-developer-id.p12`  |
| `MAC_CSC_KEY_PASSWORD` | Password used when exporting the `.p12`     |
| `APPLE_API_KEY`        | Base64 content of the downloaded `.p8` file |
| `APPLE_API_KEY_ID`     | App Store Connect API Key ID                |
| `APPLE_API_ISSUER`     | App Store Connect Issuer ID                 |
| `APPLE_TEAM_ID`        | Apple Developer Team ID, `CM2V36MJT8`       |

Keep these values only in GitHub Secrets. Do not place them directly in workflow YAML or source files.

## Enable Signing in the Build Script

The release build must not disable signing.

In `apps/shell/package.json`, replace:

```json
"dist:mac": "pnpm run prepare:production && electron-builder --mac --config.mac.identity=null"
```

with:

```json
"dist:mac": "pnpm run prepare:production && electron-builder --mac"
```

The `identity=null` flag forces an unsigned or ad-hoc signed app and will cause public downloads to fail Gatekeeper checks.

## Enable Notarization

In `apps/shell/electron-builder.yml`, keep hardened runtime enabled and add notarization under `mac`:

```yaml
mac:
  category: public.app-category.productivity
  icon: build/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize: true
  target:
    - target: dir
    - target: zip
```

Hardened runtime is required for notarization.

## GitHub Actions Release Job

Use a macOS runner for signing and notarization:

```yaml
name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  macos:
    runs-on: macos-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build, sign, and notarize
        run: pnpm run dist:mac
        env:
          CSC_LINK: ${{ secrets.MAC_CSC_LINK }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CSC_KEY_PASSWORD }}
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
          APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
          APPLE_API_ISSUER: ${{ secrets.APPLE_API_ISSUER }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}

      - name: Verify signature and Gatekeeper acceptance
        run: |
          codesign --verify --deep --strict --verbose=2 apps/shell/release/mac-arm64/Karya.app
          codesign -dv --verbose=4 apps/shell/release/mac-arm64/Karya.app
          spctl --assess --type execute --verbose=4 apps/shell/release/mac-arm64/Karya.app

      - name: Publish release
        uses: softprops/action-gh-release@v2
        with:
          files: apps/shell/release/*.zip
```

## Local Verification

With the `Developer ID Application` certificate installed in Keychain:

```bash
cd "/Users/anirudhkoundinyak/Desktop/Karya OS/Karya"
pnpm run dist:mac
```

Verify the app signature:

```bash
codesign --verify --deep --strict --verbose=2 apps/shell/release/mac-arm64/Karya.app
codesign -dv --verbose=4 apps/shell/release/mac-arm64/Karya.app
```

Expected output should include:

```text
Authority=Developer ID Application: ...
TeamIdentifier=CM2V36MJT8
```

The output must not include:

```text
Signature=adhoc
TeamIdentifier=not set
```

Check the notarization staple:

```bash
xcrun stapler validate apps/shell/release/mac-arm64/Karya.app
```

Check Gatekeeper:

```bash
spctl --assess --type execute --verbose=4 apps/shell/release/mac-arm64/Karya.app
```

A successful Gatekeeper check should report the app as accepted.

## Test the Downloaded Artifact

Always test the exact artifact users will download.

1. Publish a new tagged prerelease, for example `v1.0.0-alpha.2`.
2. Download the ZIP from GitHub in a browser.
3. Extract it into `~/Downloads`.
4. Run:

```bash
codesign --verify --deep --strict --verbose=2 ~/Downloads/Karya.app
spctl --assess --type execute --verbose=4 ~/Downloads/Karya.app
xcrun stapler validate ~/Downloads/Karya.app
```

5. Open `Karya.app` normally from Finder.

Do not keep distributing a release that was built with `identity=null`. Delete the broken asset and upload a newly signed and notarized artifact.

## Release Naming

Prefer tagged release URLs instead of draft `untagged-*` URLs.

Recommended artifact names:

```text
Karya-1.0.0-alpha.2-arm64-mac.zip
Karya-1.0.0-alpha.2-x64-mac.zip
```

Apple Silicon Macs need the `arm64` build. Intel Macs need an `x64` build, unless a universal build is produced.
