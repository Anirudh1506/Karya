# User Guide

Release snapshot: `v1.0.0-alpha.1`

Karya Desktop is a workspace-centered desktop shell. It helps organize work by Profile, Workspace, Resource, Event, Relationship, Activity, Notification, and Application context.

## Core Concepts

## Profiles

Profiles separate high-level areas of life or work. A profile owns workspaces, default spaces, resources, and settings context.

Use Profiles when you want separation between contexts such as personal work, startup work, university work, or client work.

## Workspaces

Workspaces are focused project contexts. A workspace has dedicated pages:

- Overview
- Resources
- Notes
- Tasks
- Calendar
- Bookmarks
- Applications
- Activity
- Relationships
- Settings

Clicking a workspace in the sidebar opens its Overview.

## Default Space

Default Space is an inbox, not a normal project workspace.

Use it for:

- Recent imports
- Captured items
- Unsorted resources
- Recently created scratch notes
- Items waiting to move into a focused workspace

## Resources

Resources are user-managed content objects:

- Notes
- Tasks
- Bookmarks
- Files
- Folders
- Images
- Documents

Resources appear in resource lists, workspace resource pages, search, inspectors, and relationship views.

## Events

Calendar Events are system objects, not Resources. They are managed by the Event Service and appear in calendar, agenda, dashboard, and search contexts rather than the Resource browser.

## Applications

Karya discovers local desktop applications and lets you:

- Launch apps.
- Pin apps globally.
- Mark apps as workspace preferred.
- Associate apps with a workspace.
- Include apps in a Continue Working Launch Configuration.

The dock is workspace-aware and reflects the active workspace context.

## Universal Search

Open Universal Search with:

```text
Cmd/Ctrl+K
```

Search can find:

- Commands
- Resources
- Workspaces
- Profiles
- Applications
- Calendar Events
- Notifications and activity context where indexed

Search also supports command execution such as creating notes, tasks, bookmarks, profiles, workspaces, and imports.

## Creating Work

Common creation paths:

- Header Create button.
- Workspace Notes page.
- Default Space Quick Capture.
- Universal Search commands.
- Native File menu.

Notes created from a workspace page are placed in that workspace. Notes captured from Default Space stay in the inbox until moved.

## Importing And Linking

Use Add Resource to:

- Import File
- Import Folder
- Link File
- Link Folder

Import copies content into Karya's content store. Link keeps a reference to the local file or folder path.

## Inspector

The inspector adapts to the selected context.

For Resources, it includes actions such as:

- Open
- Reveal
- Rename
- Move
- Duplicate
- Copy Path
- Properties
- Folder
- Check
- Archive
- Delete

It also shows contextual sections for preview, metadata, linked workspaces, tags, and relationships.

## Relationships

Relationships connect objects across the workspace.

Supported relationship types include:

- References
- Depends On
- Related To
- Parent
- Child
- Duplicate
- Inspired By
- Supports
- Blocks

Use the workspace Relationships tab for graph view, connected objects, suggestions, creation, and timeline.

Rule in this alpha: a folder should not be related to files inside the same folder. Files in the same folder may still be related to one another, and folders may relate to other folders or other objects.

## Continue Working

Continue Working restores or launches workspace context.

If a workspace has a Launch Configuration enabled:

- Only configured applications/resources are launched.
- Startup sequence order is respected.
- Unavailable apps are skipped gracefully.

If no Launch Configuration exists:

- Karya uses its existing default resume behavior for associated resources/apps.

Configure this from Workspace Settings or the Settings app.

## Settings

Settings includes desktop-phase configuration for:

- Appearance
- Sidebar
- Animations
- Notifications
- Universal Search
- Keyboard Shortcuts
- Continue Working
- Workspace defaults
- Default applications
- Imports
- Performance
- Privacy

Visible settings are intended to have actual desktop behavior in Phase 1.

## Activity

Activity records meaningful work events such as created, opened, edited, launched, imported, restored, archived, and relationship-related changes.

Workspace Activity is scoped to the active workspace.

## Notifications

Notifications are workspace- and profile-aware. They are stored in the Notification Center, can be grouped, and support actions such as open, read, archive, and delete.
