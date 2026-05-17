# marianne

**English** | [日本語](./README_ja.md)

A Skitch-style local desktop app for image annotation (MVP).

A lightweight, fast desktop app focused on annotating images, designed to run fully offline. It never uploads to any external server, so screenshots that contain sensitive information stay on your machine.

Reference: [Issue #1](https://github.com/takecy/marianne/issues/1)

## Tech stack

- **Desktop framework:** [Tauri v2](https://v2.tauri.app/) (Rust-based)
- **Frontend:** React 19 + TypeScript + Vite
- **Drawing engine:** [react-konva](https://konvajs.org/docs/react/) (React wrapper for Konva.js)
- **Testing:** Vitest + Testing Library
- **Lint:** ESLint v10 (flat config)
- **Formatter:** `deno fmt`

## Features

- **Four annotation tools:** rectangle, arrow, text, and mosaic (pixelation for redaction)
- **8-color preset palette:** red / orange / blue / green / yellow / pink / black / white — applied to rectangles, arrows, and text
- **Four stroke-width presets for rectangles:** thin (6) / medium (12) / thick (18) / extraThick (28). Mosaic blocks use a fixed natural-pixel size
- **Three image-input paths:** paste from clipboard (`Cmd/Ctrl + V`), drag-and-drop onto the window, or macOS "Open With Marianne" from Finder (works both when the app is cold-started and when it is already running)
- **Two export paths:** save as a PNG file (native save dialog) or copy as PNG to the system clipboard
- **Option + drag to duplicate:** with a shape selected, hold Option (Alt) while dragging to clone it at the drop point. The source stays put and the new clone becomes the selection
- **Internal shape clipboard:** `Cmd/Ctrl + C` and `Cmd/Ctrl + V` copy and paste a single shape inside the app. The OS image-paste path still works when the internal clipboard is empty
- **Undo / redo:** up to 50 steps per session, cleared whenever a new image is loaded
- **Status bar:** shows the image source (file path / drag-drop / paste) and natural dimensions
- **Auto-update:** the app checks for new releases on launch and applies them with one click
- **Fully offline:** the only network call is the updater hitting `releases/latest/download/latest.json` on GitHub. No image data ever leaves your machine

## Keyboard shortcuts

`Cmd` is shown for macOS; `Ctrl` is the equivalent on other platforms. All shortcuts are suppressed while a text-annotation edit overlay or any native `input` / `textarea` has focus, so the browser's native editing keys keep working.

| Shortcut                    | Action                                                  | Notes                                                                      |
| --------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Cmd + Shift + S`           | Save PNG to file                                        | Opens the native save dialog                                               |
| `Cmd + Shift + C`           | Copy PNG to system clipboard                            | Distinct from the plain `Cmd + C` below                                    |
| `Cmd + Z`                   | Undo                                                    | Up to 50 steps                                                             |
| `Cmd + Shift + Z`           | Redo                                                    |                                                                            |
| `Cmd + C`                   | Copy the selected shape to the app's internal clipboard | Select mode only                                                           |
| `Cmd + V`                   | Paste from the internal shape clipboard                 | Falls back to the OS image-paste flow when the internal clipboard is empty |
| `v` / `a` / `r` / `t` / `m` | Switch tool (select / arrow / rect / text / mosaic)     | Ignored when no image is loaded                                            |
| `Delete` / `Backspace`      | Delete the selected shape                               | Select mode only                                                           |

## Prerequisites

Install the following before development:

| Tool           | Requirement                                                       |
| -------------- | ----------------------------------------------------------------- |
| Node.js        | ESLint v10 engine requirement: `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| Rust toolchain | Install stable via `rustup`                                       |
| Xcode CLT      | Required for producing macOS bundles                              |
| pnpm           | 9 or later                                                        |
| deno           | Used as the formatter                                             |
| gh CLI         | For opening pull requests                                         |

## Setup

```sh
pnpm install
```

## Development

```sh
# Launch the Tauri desktop app with HMR
pnpm tauri dev

# Launch only the Vite frontend (for in-browser checks)
pnpm dev
```

## Verification commands

```sh
pnpm typecheck      # tsc --noEmit
pnpm lint           # ESLint
pnpm fmt            # deno fmt
pnpm fmt:check      # deno fmt --check
pnpm test           # Vitest (watch)
pnpm test:run       # Vitest (single run)
```

## Build

```sh
pnpm tauri build    # Emits the macOS bundle under src-tauri/target/release/bundle
pnpm build:dmg      # Copies the distributable dmg from src-tauri/target/release/bundle/dmg/ into ./dist-bundle/
```

**The distributable is Apple Silicon (aarch64) only.** Intel Mac and Universal binaries are not provided. The output file name is `Marianne_<version>_aarch64.dmg` (e.g. `dist-bundle/Marianne_0.1.0_aarch64.dmg`).

### Supplying the signing key (for the updater)

`tauri.conf.json` enables `createUpdaterArtifacts: true`, so `pnpm tauri build` / `pnpm install:local` / `pnpm build:dmg` need the updater signing key. **Builds fail in the signing phase if the env is missing.**

Supply it locally with one of:

```sh
# direnv (recommended): create .envrc in the repo root (already gitignored)
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/marianne.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<strong-passphrase-stored-in-1password>"
```

```sh
# or export inline before running a build
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/marianne.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<strong-passphrase-stored-in-1password>"
pnpm install:local
```

In CI these come from the `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` GitHub Secrets, wired into release.yaml.

## Installing from the dmg (macOS)

Steps for end users who received a built dmg.

**Supported hardware**: Apple Silicon (M1 / M2 / M3 series) Macs running macOS 11.0 (Big Sur) or later. **Intel Macs are not supported** — launching will fail with `Bad CPU type in executable` because the build is aarch64 only.

1. Double-click the dmg to mount it.
2. From the Finder window that opens, drag `Marianne.app` into the `/Applications` folder.
3. Unmount the dmg (eject from the Finder sidebar).
4. Launch Marianne from Launchpad / Spotlight.

> The build is not codesigned. On first launch macOS may block it with "cannot be opened because the developer cannot be verified". Workaround: right-click `/Applications/Marianne.app` and choose "Open", or run `xattr -dr com.apple.quarantine /Applications/Marianne.app` once in a terminal.

## Local installation (macOS)

Install the latest build into `/Applications/` so the app shows up in Launchpad and Spotlight on your dev machine. To produce a distributable dmg for others, see the `pnpm build:dmg` entry in [Build](#build) above instead.

**Supported hardware**: Apple Silicon Macs running macOS 11.0 (Big Sur) or later (`pnpm install:local` also produces an aarch64 build only).

```sh
pnpm install:local
```

The script runs `pnpm tauri build`, removes any existing `/Applications/Marianne.app`, and copies the freshly built bundle into place.

> The build is not codesigned. On first launch macOS may block it with "Marianne cannot be opened because the developer cannot be verified". Workaround: right-click the app and choose "Open", or run `xattr -dr com.apple.quarantine /Applications/Marianne.app` once.

Requirements: macOS only. The script exits with an error on Linux / Windows. Quit the app before reinstalling — overwriting a running `.app` may fail.

## Auto-update

End users keep up with new releases without any manual steps.

- The app checks for an update on launch and shows a modal when a newer version is found.
- A "更新を確認" button in the toolbar triggers a manual check on demand.
- Choosing "今すぐ更新" downloads → installs → relaunches the app.
- **Unsaved annotations are lost on relaunch**, so the modal warns when shapes are present. Save first if you have work in progress.
- Network or signature-verification failures surface as a small `⚠ Failed` next to the update button (non-blocking). Hover for the full error message. Retry by clicking the same button.

The endpoint is fixed to `https://github.com/takecy/marianne/releases/latest/download/latest.json`. Because this URL resolves the `releases/latest` view, **draft and pre-release releases are ignored**.

## Release procedure (maintainers)

Releases are fully automated by a single GitHub Actions workflow at `.github/workflows/tagging-release.yaml`.

1. Go to **Actions → Tag and Release → Run workflow** in this repository.
   - Pick `bump_version` (patch / minor / major). Conventional Commits detection takes precedence if applicable.
2. The **`tagging` job** (ubuntu-latest):
   - Computes the next version via `dry_run`.
   - Runs `scripts/bump-version.sh` to sync `package.json`, `tauri.conf.json`, and `Cargo.toml` in a single commit.
   - Pushes the bump commit to main.
   - Pushes the `vX.Y.Z` tag.
3. The **`release` job** (macos-14, `needs: tagging`) runs automatically next:
   - Checks out the just-tagged commit.
   - `pnpm tauri build --target aarch64-apple-darwin` produces signed bundles.
   - Publishes `Marianne.app.tar.gz`, `.sig`, and `latest.json` to a GitHub Release (not a draft, not a prerelease).
4. Existing installations fetch `latest.json` on their next launch and prompt to update.

> **Manual `git push origin vX.Y.Z` is unsafe**: a tag that did not go through `bump-version.sh` and the signing flow is not a valid release. Always cut releases via the Run workflow button above.

### Required GitHub Secrets

Register these in Settings → Secrets before the workflow can complete:

| Name                                 | Value                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `TAURI_SIGNING_PRIVATE_KEY`          | Full contents of `~/.tauri/marianne.key`                                       |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase used to generate the key (use a strong 32+ character random string) |

> The single-workflow design means everything runs within one workflow run, so the default `GITHUB_TOKEN` is enough — no PAT is needed to chain workflows.

### Key management

- Never commit `~/.tauri/marianne.key` (`.gitignore` covers it).
- Back up the private key + passphrase to 1Password or similar. Losing the key means existing installations can no longer verify any future release.
- Rotating the `pubkey` in `tauri.conf.json` breaks updates for everyone who installed before the rotation. **Treat the key as fixed-for-life.**

## License

[MIT](./LICENSE)
