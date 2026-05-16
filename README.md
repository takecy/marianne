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
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

```sh
# or export inline before running a build
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/marianne.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
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

Releases are fully automated by GitHub Actions.

1. Go to **Actions → Bump version → Run workflow** in this repository.
   - Pick `bump_version` (patch / minor / major). Conventional Commits detection takes precedence if applicable.
2. The workflow:
   - Computes the next version via `dry_run`.
   - Runs `scripts/bump-version.sh` to sync `package.json`, `tauri.conf.json`, and `Cargo.toml` in a single commit.
   - Pushes the bump commit to main.
   - Pushes the `vX.Y.Z` tag.
3. The tag push triggers the **Release** workflow on macos-14 (Apple Silicon):
   - `pnpm tauri build --target aarch64-apple-darwin` produces signed bundles.
   - Publishes `Marianne.app.tar.gz`, `.sig`, and `latest.json` to a GitHub Release (not a draft, not a prerelease).
4. Existing installations fetch `latest.json` on their next launch and prompt to update.

### Required GitHub Secrets

Register these in Settings → Secrets before the workflow can complete:

| Name                                 | Value                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | Full contents of `~/.tauri/marianne.key`                                                                                   |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase used to generate the key (empty string is fine if no passphrase)                                                |
| `PAT_FOR_TAG_PUSH`                   | Personal Access Token with `contents:write`. Without it, tag pushes from tagging.yaml will not chain-trigger release.yaml. |

### Key management

- Never commit `~/.tauri/marianne.key` (`.gitignore` covers it).
- Back up the private key + passphrase to 1Password or similar. Losing the key means existing installations can no longer verify any future release.
- Rotating the `pubkey` in `tauri.conf.json` breaks updates for everyone who installed before the rotation. **Treat the key as fixed-for-life.**

## License

[MIT](./LICENSE)
