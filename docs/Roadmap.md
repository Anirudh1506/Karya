# Roadmap

Release snapshot: `v1.0.0-alpha.1`

This roadmap captures likely next steps after the alpha. It is not a commitment to ship dates.

## Alpha Stabilization

- Validate clean install and update behavior.
- Add signed and notarized macOS builds.
- Verify Windows NSIS packaging.
- Verify Linux AppImage and deb packaging.
- Add app icon and metadata checks to release validation.
- Improve database migration discipline.
- Add broader smoke tests around search, persistence, imports, and Continue Working.

## Workspace Experience

- Continue refining Workspace Overview as a work-resume surface.
- Expand pinned resources and workspace search behavior.
- Improve workspace-specific application dock animations.
- Add richer workspace briefings from Activity, Relationships, Calendar, Notifications, and Continuity.

## Resources

- Improve file/folder browsing inside imported folders.
- Add richer previews for more file types.
- Improve resource version history.
- Add stronger recovery flows for moved or missing linked files.

## Notes And Tasks

- Improve native note editing polish and persistence.
- Add deeper task board workflows.
- Improve task reminders and due-date workflows.
- Add stronger task/resource linking.

## Calendar And Events

- Continue Calendar Event development as an Event object, not a Resource.
- Add recurring events.
- Improve reminders.
- Add workspace agenda views.
- Integrate events more deeply with Dashboard and Relationships.

## Relationships

- Improve graph layout and navigation.
- Add richer relationship suggestions.
- Add relationship-aware search expansion.
- Add knowledge graph visualization controls.
- Use relationships as AI context input in future releases.

## Notifications And Reminders

- Expand reminder scheduler behavior.
- Add desktop notification preferences and delivery polish.
- Improve grouping and action routing.
- Add notification search queries.

## Activity

- Improve activity grouping.
- Add object-level history views.
- Add daily and weekly workspace recaps.
- Use activity as the foundation for future workspace briefings.

## Universal Search

- Improve ranking across exact match, recency, workspace context, pinned items, and frequency.
- Add advanced search syntax such as `note:`, `task:`, `workspace:`, and `bookmark:`.
- Add richer previews and action panels.
- Expand command registry integration.

## Settings

- Add validation for more settings.
- Add restart-required state only where truly necessary.
- Improve keyboard shortcut editing and conflict handling.
- Add import/export for settings once stable.

## Release Engineering

- Add release checklist automation.
- Add reproducible build metadata.
- Add notarization pipeline.
- Add update channel structure:
  - `alpha`
  - `beta`
  - `rc`
  - `stable`

Suggested version path:

```text
1.0.0-alpha.1
1.0.0-alpha.2
1.0.0-beta.1
1.0.0-rc.1
1.0.0
```
