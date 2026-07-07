# Karya

Karya OS begins as an Electron-hosted shell with service-first operating-system foundations.

## Release docs

The `v1.0.0-alpha.1` release snapshot is documented in `docs/`:

- [Architecture](docs/Architecture.md)
- [Getting Started](docs/GettingStarted.md)
- [Installation](docs/Installation.md)
- [Keyboard Shortcuts](docs/KeyboardShortcuts.md)
- [User Guide](docs/UserGuide.md)
- [Known Limitations](docs/KnownLimitations.md)
- [Roadmap](docs/Roadmap.md)
- [Changelog](docs/Changelog.md)

## Milestone 1

Run the shell:

```bash
pnpm install
pnpm dev
```

The shell is rendered with React, but application behavior is owned by registered services in `packages/`.
