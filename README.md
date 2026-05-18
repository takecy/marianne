# Marianne

**English** | [日本語](./README_ja.md)

> Skitch-style offline image annotation app (for Apple Silicon)

<div align="center">
  <img src="./assets/design/marianne_app.png" alt="Marianne app screenshot" width="400" />
</div>

## Why build yet another image annotation app?

- **Skitch is going away**: I have been a long-time Skitch (by Evernote) user — launching it many times a day to slap arrows and text onto images. But Skitch is no longer actively maintained and ships only as an Intel-only build. When [macOS started phasing out Intel support](https://developer.apple.com/documentation/apple-silicon/about-the-rosetta-translation-environment/) and the warning popped up that Skitch would soon stop working, I decided to build an Apple Silicon-native successor that carries Skitch's spirit forward.
- **A minimal feature set**: There are many great Skitch alternatives, but for my workflow they all do too much. Arrows, text, and the occasional mosaic on a screenshot is all I really need.
- **The arrow shape**: I love the shape of Skitch's arrows. I could not find any annotation app that draws that exact arrow — or text in that familiar style — so I built one myself.

### About the name

The real name of "[Ms. Goldenweek](https://one-piece.com/character/Ms_Goldenweek/index.html)", a painter character from my favourite manga ONE PIECE.

## Design philosophy

- **Offline**: no login, no telemetry, no cloud sync, no external server calls (update check only).
- **Simple**: arrows, rectangles, text, mosaic, and a bit of cropping — that's the whole toolbox.
- **Small and fast**: built on [TAURI](https://v2.tauri.app/), the app is under 20MB and launches in a flash.

## Screenshots

<div align="center">
  <img src="./assets/design/example_01.png" alt="Marianne annotation example" width="600" />
</div>

## Quick install

> [!NOTE]
> Apple Silicon Macs only.

1. Download the latest `Marianne_<version>_aarch64.dmg` from [Releases](https://github.com/takecy/marianne/releases).
2. Mount the dmg and drag `Marianne.app` into `/Applications`.
3. First launch: right-click the app and choose **Open** to clear the Gatekeeper warning (the build is not codesigned). Alternative: `xattr -dr com.apple.quarantine /Applications/Marianne.app` once in a terminal.

Paste a screenshot (`Cmd + V`), drag an image into the window, or use **Open with this application** from an image's right-click menu to start annotating.

## Documentation

- **For users**: [Marianne docs](https://takecy.github.io/marianne/) — features, keyboard shortcuts, image input paths, export options
- **For contributors**: [Getting started](https://takecy.github.io/marianne/getting-started/) — tech stack, dev environment, verification commands, worktree workflow
- **For maintainers**: [Releasing](https://takecy.github.io/marianne/releasing/) — release workflow, signing keys, GitHub Secrets

> The docs site is built with Astro Starlight and served from this repo's `/docs` directory. The live URLs above become active once GitHub Pages is enabled. **Until then**, browse the source on GitHub: [user guide](https://github.com/takecy/marianne/tree/main/site/src/content/docs), [getting started](https://github.com/takecy/marianne/blob/main/site/src/content/docs/getting-started.mdx), [releasing](https://github.com/takecy/marianne/blob/main/site/src/content/docs/releasing.mdx).

## License

[PolyForm Noncommercial 1.0.0](./LICENSE)

Personal and noncommercial use is permitted. Use in proprietary products and resale are not.\
This project is not affiliated with or endorsed by Plasq, Evernote, Shueisha, or Eiichiro Oda. "Skitch" and "ONE PIECE" are trademarks of their respective owners.
