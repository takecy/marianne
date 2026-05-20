# Contributing to Marianne

**English** | [日本語](./CONTRIBUTING_ja.md)

Thanks for your interest in contributing! This guide covers the minimum a
contributor needs to know. For deeper architectural context (coordinate-system
invariants, mosaic export pipeline, crop atomicity, updater invariants, etc.),
read [`CLAUDE.md`](./CLAUDE.md) in the repository root.

## License Notice

Marianne is licensed under [PolyForm Noncommercial 1.0.0](./LICENSE).

By submitting a contribution, you agree that your contribution will also be
covered by this license. Commercial use, redistribution as part of a
proprietary product, or any non-personal commercial application is **not**
permitted.

## Prerequisites

- **Node.js** version from [`.nvmrc`](./.nvmrc)
- **pnpm** version from `packageManager` in [`package.json`](./package.json)
- **Rust** stable via [rustup](https://www.rust-lang.org/tools/install)
- **Xcode Command Line Tools**: `xcode-select --install`
- macOS aarch64 development host — other platforms are not supported

## Setup

```bash
pnpm install --frozen-lockfile
pnpm tauri dev   # launches the Tauri dev shell
```

## Validation (run before committing)

```bash
pnpm fmt:check     # deno fmt (NOT Prettier)
pnpm lint          # ESLint v10 flat config
pnpm typecheck     # tsc --noEmit (strict + noUncheckedIndexedAccess)
pnpm test:run      # Vitest + Testing Library
pnpm build         # tsc && vite build
pnpm docs:build    # only when docs/ or site/ changes
```

Coverage can be collected locally with `pnpm test:coverage`. The CI workflow
also runs this and uploads `coverage/coverage-summary.json` as an artifact.

## Branch / Commit / PR Conventions

- **Branch naming**: `feat/<short>` / `fix/<short>` / `chore/<short>` /
  `docs/<short>` / `ci/<short>`. Work in a dedicated git worktree under
  `.worktrees/` whenever the change is non-trivial.
- **Commit messages**: [Conventional Commits](https://www.conventionalcommits.org/)
  in **English**. Examples: `feat(canvas): add stroke width preset`,
  `fix(menu): drop Backspace accelerator`. Use `!` for breaking changes
  (`feat!: remove deprecated API`). **Issue numbers do not belong in commit
  messages** — they go in the PR body.
- **PR title**: Conventional Commits in **English** (mirrors the commit style).
- **PR body**: **Japanese**, following [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md)
  (`## 概要` / `## 変更内容` / `## 検証` / `## 関連`).
- **Issue linkage**: in the PR body via `Closes #N` / `Refs #N`.
- **Default PR state**: draft. Mark ready for review when CI is green and
  you have self-reviewed.
- **One PR, one purpose**: keep PRs focused on a single concern.

## Code Style

- **Formatter**: `deno fmt`, **not** Prettier. Config in `deno.json`
  (lineWidth 100, 2-space indent, double quotes, semicolons).
- **TypeScript**: `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` +
  `noUnusedParameters` + `noImplicitOverride`. Array index access yields
  `T | undefined` — handle accordingly.
- **React**: `react-hooks` recommended rules are enforced via ESLint.
- **Tests**: Vitest + `@testing-library/react` + `@testing-library/jest-dom`.
  `globals: true` is enabled — no need to import `describe` / `it` / `expect`.
  **Table-driven tests are discouraged**; prefer one `it()` per case so each
  failure points at a specific scenario.
- **Imports**: use the `@/` path alias for anything under `src/`.

## Where to Go Next

- [`CLAUDE.md`](./CLAUDE.md) — architecture deep dive, invariants, design
  decisions, known traps
- [`SECURITY.md`](./SECURITY.md) — vulnerability reporting policy
- [Marianne docs](https://takecy.github.io/marianne/) — user-facing
  documentation (features, shortcuts, image input paths)
- [Releasing](https://takecy.github.io/marianne/releasing/) — maintainer
  release workflow, signing keys, GitHub Secrets

## Reporting Bugs and Requesting Features

Open a GitHub issue at <https://github.com/takecy/marianne/issues>.
For security-sensitive reports, please use the channel described in
[`SECURITY.md`](./SECURITY.md) instead of public issues.
