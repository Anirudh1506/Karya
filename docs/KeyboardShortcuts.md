# Keyboard Shortcuts

Release snapshot: `v1.0.0-alpha.1`

On macOS, use `Cmd`. On Windows/Linux, use `Ctrl`.

## Global Shell

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+K` | Open Universal Search |
| `Cmd/Ctrl+N` | Create a new Note |
| `Cmd/Ctrl+,` | Open Settings |
| `Cmd/Ctrl+Shift+N` | New Workspace |
| `Cmd/Ctrl+I` | Import File |
| `Cmd/Ctrl+Shift+I` | Import Folder |
| `Cmd/Ctrl+Enter` | Continue Working for the active Workspace |

## Native View Menu

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+B` | Toggle Sidebar command |
| `Cmd/Ctrl+Shift+B` | Toggle Inspector command |
| `Cmd/Ctrl+Shift+D` | Toggle Dock command |
| Native fullscreen shortcut | Enter or exit fullscreen |

The toggle commands are exposed through the native menu bridge. Full UI state wiring for all layout toggles is still limited in this alpha.

## Selected Resource

When a resource is selected and focus is not inside an input/editor:

| Shortcut | Action |
| --- | --- |
| `Enter` | Open selected Resource |
| `F2` | Rename selected Resource |
| `Delete` / `Backspace` | Delete selected Resource |
| `Cmd/Ctrl+D` | Duplicate selected Resource |
| `Cmd/Ctrl+I` | Open Resource Properties |

## Universal Search

| Shortcut | Action |
| --- | --- |
| `ArrowDown` | Move to the next result |
| `ArrowUp` | Move to the previous result |
| `Enter` | Execute selected result |
| `Tab` | Toggle preview/action focus |
| `Esc` | Close search |

## Native Note Editor

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+S` | Save note content |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Y` | Redo |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `Cmd/Ctrl+B` | Bold |
| `Cmd/Ctrl+I` | Italic |
| `Cmd/Ctrl+U` | Underline |
| `Cmd/Ctrl+Shift+7` | Ordered list |
| `Cmd/Ctrl+Shift+8` | Checklist |
| `Tab` | Indent inside editor |
| `Enter` on checklist item | Continue checklist |

## Calendar And Task Views

| Shortcut | Action |
| --- | --- |
| `Enter` on calendar item | Open/select event |
| `Enter` on task card | Open/select task |
| `Space` on task card | Toggle/select task interaction |

## Standard Edit Menu

Karya uses native platform edit roles:

- Undo
- Redo
- Cut
- Copy
- Paste
- Select All
