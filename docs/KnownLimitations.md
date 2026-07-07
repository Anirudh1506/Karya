# Known Limitations

Release snapshot: `v1.0.0-alpha.1`

This is an alpha release. It is usable for local desktop validation, but it is not a fully signed public distribution.

## Distribution

- macOS arm64 is the only verified packaged output in this snapshot.
- Windows and Linux builder metadata is configured, but installers have not been validated.
- macOS app signing and notarization are prepared but not enabled.
- The app may require manual approval in macOS security settings on first launch.

## Updates

- Check for Updates appears in the About dialog/menu context as unavailable for Phase 1.
- No auto-update service is configured.

## Sync And Accounts

- Karya Cloud is not included.
- Cross-device sync is not included.
- Collaboration and shared workspaces are not included.
- Account/subscription management is not included.

## Data

- Data is local.
- Backup and restore workflows are not yet productized.
- Database migrations should be treated carefully between alpha builds.

## Search

- Universal Search is functional and command-aware, but advanced search syntax is future-ready rather than complete.
- Relationship-aware search is present as a foundation, but deeper semantic expansion is still early.

## Continue Working

- Launch Configuration supports one configuration per workspace.
- Multiple launch profiles such as coding mode, meeting mode, or research mode are not included.
- Some external application launch behavior depends on platform support and installed app metadata.

## Native Menus

- Production native menus are present.
- Search and Settings commands are wired into the renderer.
- Some layout toggle commands are exposed through the native bridge but have limited UI-state behavior in this alpha.

## Icons And Branding

- Native icons are generated and packaged.
- Installer branding is configured for future Windows/Linux outputs, but those installers need platform verification.

## Calendar

- Calendar Events are modeled separately from Resources.
- Calendar development is still early compared with Notes, Resources, Workspaces, and Tasks.

## Relationships

- Relationships are centrally managed and visible in the workspace Relationships tab.
- Graph visualization is lightweight.
- AI-based relationship suggestions are not included; current suggestions are metadata/rule based.

## Activity

- Activity capture exists across major flows.
- Some grouped events may still need refinement as real usage patterns emerge.

## Settings

- Settings is scoped to desktop Phase 1.
- Future cloud, SDK, plugin, mobile, enterprise, and AI-agent settings are intentionally excluded.

## Accessibility

- Keyboard access and focus states are implemented across major flows.
- A full accessibility audit is still needed before a stable public release.
