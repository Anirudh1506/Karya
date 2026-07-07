# Changelog

All notable release-level changes for Karya Desktop are tracked here.

## v1.0.0-alpha.1

Release type: Alpha

### Added

- Electron desktop shell with production packaging.
- Native app identity:
  - App name: Karya
  - Bundle identifier: `com.karya.desktop`
  - Version: `1.0.0-alpha.1`
  - Productivity category
- Generated native icons:
  - macOS `.icns`
  - Windows `.ico`
  - Linux `.png` sizes
- Professional native menu structure:
  - Karya/About
  - File
  - Edit
  - View
  - Workspace
  - Help
- About dialog with version, build, platform, copyright, license, homepage, and update status.
- Persisted window size, position, and maximized state.
- Production build pipeline using `electron-vite` and `electron-builder`.
- Production packaging without demo seed data.
- ASAR packaging with native SQLite dependency unpacking.
- macOS ZIP artifact generation.
- Code-signing preparation through macOS entitlements and hardened runtime config.

### Core Platform

- Service-first runtime architecture.
- Profile Service.
- Workspace Service.
- Resource Service.
- Event Service for calendar/event objects.
- Relationship Service.
- Search Service.
- Continuity Service.
- Activity Service.
- Notification Service.
- Settings Service.
- Application Registry.
- SQLite metadata persistence.
- Filesystem content store.
- Import Service for files and folders.

### Workspace

- Workspace Overview.
- Dedicated workspace pages:
  - Resources
  - Notes
  - Tasks
  - Calendar
  - Bookmarks
  - Applications
  - Activity
  - Relationships
  - Settings
- Default Space modeled as an inbox.
- Workspace-aware application dock.
- Workspace-scoped search.
- Workspace settings with Continue Working Launch Configuration.

### Resources

- Resource explorer.
- Notes.
- Tasks.
- Bookmarks.
- Files and folders.
- Import file.
- Import folder.
- Link file.
- Link folder.
- Resource inspector.
- Resource actions:
  - Open
  - Reveal
  - Rename
  - Move
  - Duplicate
  - Copy Path
  - Properties
  - Check
  - Archive
  - Delete
- Resource metadata, tags, linked workspaces, and relationship context.

### Notes

- Native Karya notes.
- Workspace Notes page.
- Default Space Quick Capture for notes.
- Native note editor with formatting shortcuts.
- Note content persistence.

### Tasks

- Task board.
- Task statuses.
- Priorities.
- Due dates.
- Reminders metadata.
- Checklist support.
- Task inspector behavior.

### Calendar And Events

- Calendar Events separated from Resources.
- Events remain searchable and workspace/profile-aware.
- Workspace Calendar page.
- Event inspector context.

### Relationships

- Typed relationship model.
- Bidirectional relationship management.
- Workspace Relationships page.
- Graph view.
- Connected object list.
- Suggestions.
- Relationship creation UI.
- Rule preventing folder-to-child-file relationships inside the same folder.

### Search And Commands

- Universal Search / Command Palette.
- Grouped result sections.
- Keyboard navigation.
- Command execution.
- Recent command/search behavior.
- Resource, workspace, profile, application, and command discovery.

### Notifications

- Notification Center.
- Workspace-aware notifications.
- Profile-aware notifications.
- Grouped notification presentation.
- Notification actions such as open, read, archive, and delete.

### Activity

- Activity capture across meaningful resource, workspace, application, and notification events.
- Workspace activity timeline.
- Activity grouping.

### Settings

- Desktop Phase 1 settings application.
- Appearance settings.
- Sidebar settings.
- Animation preferences.
- Notification preferences.
- Universal Search settings.
- Keyboard shortcut surface.
- Continue Working settings.
- Workspace defaults.
- Default applications.
- Import settings.
- Performance and privacy settings.

### Fixed During Alpha Prep

- Calendar Events no longer appear as Resources.
- Resource Browser remains Resource-only.
- Continue Working excludes calendar appointments.
- Resource names for imported files use file names rather than full paths where appropriate.
- Folder imports no longer flood Resume Working with un-interacted child files.
- Activity duplicate/grouping behavior refined.
- Workspace navigation opens Overview by default.
- Folder navigation back-to-workspace behavior corrected.
- Small-screen layout responsiveness improved.
- Task color contrast improved for light/dark backgrounds.
- Global Search selection contrast improved.
- Launch Configuration persistence and startup sequence lag fixed.
- Workspace Notes and Default Space Quick Capture note creation fixed.

### Known Gaps

- macOS signing/notarization is not enabled.
- Windows and Linux packages are configured but not verified.
- Auto-update is not implemented.
- Cloud sync, account sync, collaboration, plugins, SDK, and mobile are not included.
- AI-based relationship suggestions and workspace briefings are future work.
