# Karya

Karya OS begins as an Electron-hosted shell with service-first operating-system foundations.

## Release docs

The `v1.0.0-alpha.1` release snapshot is documented in `docs/`:

- [Architecture](docs/Architecture.md)
- [Getting Started](docs/GettingStarted.md)
- [Installation](docs/Installation.md)
- [macOS Signing and Notarization](docs/MacOSSigningNotarization.md)
- [Keyboard Shortcuts](docs/KeyboardShortcuts.md)
- [User Guide](docs/UserGuide.md)
- [Known Limitations](docs/KnownLimitations.md)
- [Roadmap](docs/Roadmap.md)
- [Changelog](docs/Changelog.md)

## Product design

- [Karya Mobile Design Language](docs/KaryaMobileDesignLanguage.md)
- [Karya Interaction Patterns](docs/KaryaInteractionPatterns.md)
- [Karya Mobile Implementation Partner](docs/KaryaMobileImplementationPartner.md)

## Platform architecture

- [ADR-0001: Platform-First Architecture](docs/adr/ADR-0001-platform-first-architecture.md)
- [Repository Overview](docs/architecture/RepositoryOverview.md)
- [Architecture Overview](docs/architecture/ArchitectureOverview.md)
- [Dependency Graph](docs/architecture/DependencyGraph.md)
- [Package Responsibilities](docs/architecture/PackageResponsibilities.md)
- [Developer Setup](docs/architecture/DeveloperSetup.md)
- [Phase 1 Migration Notes](docs/architecture/MigrationNotes.md)
- [Architectural Constraints](docs/architecture/Constraints.md)
- [Mobile Composition Root](docs/architecture/MobileCompositionRoot.md)

## Milestone 1

Run the shell:

```bash
pnpm install
pnpm dev
```

The shell is rendered with React, but application behavior is owned by registered services in `packages/`.
