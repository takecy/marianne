# Marianne

**English** | [日本語](./README_ja.md)

> Skitch-style offline image annotation for macOS. Built for screenshots that contain sensitive content.

![Marianne in action](./assets/design/marianne_app.png)

## Why Marianne?

- **Privacy-first**: Annotations and screenshots never leave your machine. The only outbound calls are auto-update checks against GitHub Releases — once on launch and again when you click the manual "Check for updates" button in the toolbar.
- **A spiritual successor to Skitch**: After Skitch was discontinued, lightweight, fast, fully offline screenshot-annotation tools became rare. Marianne fills that gap.
- **Mosaic for visual redaction**: Mosaic blocks are rasterised into the exported PNG — the underlying pixels are not recoverable from the exported file. Use this for visually obscuring screenshot regions; for high-stakes secrets (passwords, full tokens) consider a separate pre-export tool that overwrites the pixels with a solid colour.

## Design philosophy

- **Fully offline**: no telemetry, no cloud sync, no external server calls (except the updater hitting GitHub Releases).
- **Lean dependency tree**: prefer platform primitives over npm packages. Browser, Node, and Konva cover most cases — only add deps when the platform cannot.
- **Skitch-like simplicity**: four tools, eight colors, four stroke widths. A small fixed surface beats a kitchen-sink toolbar.
- **AI-friendly stack**: TypeScript + React + Konva chosen for high LLM affinity — coding agents (Cursor, Claude Code, etc.) produce accurate code with this combination.

## Screenshots

![Marianne app screenshot](./assets/design/marianne_app.png)

![Menu bar tray icon](./assets/design/marianne_menubar.png)

_Animated demo GIFs are planned for a future release._

## Quick install

**Apple Silicon Macs only** (M1 / M2 / M3, macOS 11+).

1. Download the latest `Marianne_<version>_aarch64.dmg` from [Releases](https://github.com/takecy/marianne/releases).
2. Mount the dmg and drag `Marianne.app` into `/Applications`.
3. First launch: right-click the app and choose **Open** to clear the Gatekeeper warning (the build is not codesigned). Alternative: `xattr -dr com.apple.quarantine /Applications/Marianne.app` once in a terminal.

Once installed, paste a screenshot (`Cmd + V`) or drag an image into the window to start annotating.

→ Full installation guide: [Marianne docs / Installation](https://takecy.github.io/marianne/installation/)

## Documentation

- **For users**: [Marianne docs](https://takecy.github.io/marianne/) — features, keyboard shortcuts, image input paths, export options
- **For contributors**: [Getting started](https://takecy.github.io/marianne/getting-started/) — tech stack, dev environment, verification commands, worktree workflow
- **For maintainers**: [Releasing](https://takecy.github.io/marianne/releasing/) — release workflow, signing keys, GitHub Secrets

> The docs site is built with Astro Starlight and served from this repo's `/docs` directory. The live URLs above become active once GitHub Pages is enabled. **Until then**, browse the source on GitHub: [user guide](https://github.com/takecy/marianne/tree/main/site/src/content/docs), [getting started](https://github.com/takecy/marianne/blob/main/site/src/content/docs/getting-started.mdx), [releasing](https://github.com/takecy/marianne/blob/main/site/src/content/docs/releasing.mdx).

## License

[MIT](./LICENSE) © 2026 takecy
