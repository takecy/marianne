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
```

## License

[MIT](./LICENSE)
