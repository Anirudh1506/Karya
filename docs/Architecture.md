# Karya Architecture

Release snapshot: `v1.0.0-alpha.1`

Karya Desktop is an Electron application built around service-owned behavior. The React shell renders the experience, but core behavior lives in reusable packages under `packages/`.

## Product Model

Karya organizes work around a few first-class concepts:

- Profiles: top-level personal or work identities.
- Workspaces: focused project contexts inside profiles.
- Default Space: an inbox for imports, captures, temporary resources, and unplaced work.
- Resources: user-managed content such as notes, tasks, bookmarks, files, folders, images, and documents.
- Events: calendar and reminder objects managed outside the Resource Service.
- Applications: local desktop apps that can be pinned, associated with workspaces, and launched from Karya.
- Relationships: typed links between Karya objects.
- Activity: meaningful work history across resources, workspaces, and applications.
- Notifications: workspace-aware attention items and reminders.

## Runtime Layers

```text
Electron Main Process
  Native windows, menus, packaging identity, platform IPC

Preload Bridge
  Safe IPC boundary exposed as window.karyaShell

React Renderer
  Desktop shell, navigation, inspector, dashboards, editors, settings

Shell Adapter
  API boundary between renderer/main and core services

Kernel / Core
  Command handling, service composition, query orchestration

Services
  Resource, Workspace, Profile, Event, Search, Relationship,
  Continuity, Activity, Notification, Application Registry, Settings

Persistence
  SQLite metadata store plus filesystem content store
```

## Package Responsibilities

- `apps/shell`: Electron desktop app, renderer UI, native menus, packaging.
- `packages/core`: Service composition for the Karya runtime.
- `packages/kernel`: Command handlers and shell-facing application API.
- `packages/shell-adapter`: IPC-friendly adapter used by the renderer.
- `packages/types`: Shared domain and API types.
- `packages/ui`: Shared UI primitives.
- `packages/resource-service`: Resource lifecycle and metadata ownership.
- `packages/event-service`: Calendar/event object lifecycle.
- `packages/relationship-service`: Typed relationships and graph queries.
- `packages/search-service`: Universal search indexing/query behavior.
- `packages/continuity-service`: Continue Working and resume context.
- `packages/activity-service`: Activity timeline recording and grouping.
- `packages/notification-service`: Notifications and reminders.
- `packages/application-registry`: Local application discovery and launch metadata.
- `packages/workspace-service`: Workspace lifecycle and associations.
- `packages/profile-service`: Profile lifecycle and defaults.
- `packages/metadata-store`: SQLite-backed persistence implementation.
- `packages/content-store`: Filesystem-backed resource content storage.
- `packages/import-service`: File/folder import and linking workflows.
- `packages/platform`: Platform abstraction used by services.

## Command Flow

Most user actions follow this path:

```text
UI action
  -> shell controller
  -> shell adapter
  -> Electron IPC
  -> kernel shell API
  -> command bus
  -> service/persistence update
  -> snapshot subscription
  -> renderer refresh
```

This keeps application behavior centralized and makes features available from multiple entry points such as menus, context menus, universal search, inspector actions, and workspace pages.

## Persistence

Karya stores desktop metadata in SQLite through `KaryaMetadataStore`.

Default production data location is Electron's `userData` path. For smoke tests or isolated runs, `KARYA_USER_DATA_DIR` can override this path.

Resource content is stored separately by `FileSystemContentStore` under:

```text
<userData>/content-store
```

## Production Build

The production pipeline uses:

- `electron-vite` for optimized main, preload, and renderer bundles.
- `electron-builder` for packaged desktop artifacts.
- ASAR packaging with `better-sqlite3` unpacked.
- Generated native icons for macOS, Windows, and Linux.
- Production mode without demo seed data, development menus, or renderer devtools.

Current macOS artifact:

```text
apps/shell/release/mac-arm64/Karya.app
apps/shell/release/Karya-1.0.0-alpha.1-arm64-mac.zip
```

## Native Identity

The desktop app is configured as:

- App name: `Karya`
- Version: `1.0.0-alpha.1`
- Bundle identifier: `com.karya.desktop`
- Category: Productivity
- macOS icon: `apps/shell/build/icon.icns`
- Windows icon: `apps/shell/build/icon.ico`
- Linux icons: `apps/shell/build/icons/`

## Architectural Notes

- Resources and Events are separate object families.
- Search indexes more than Resources.
- Relationships are typed and centrally managed.
- Continue Working is a workspace-level capability, with optional Launch Configuration.
- The renderer should not own core business rules.
- New capabilities should generally enter through Core services, then surface through the shell.
