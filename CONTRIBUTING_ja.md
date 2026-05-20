# Marianne への貢献ガイド

[English](./CONTRIBUTING.md) | **日本語**

貢献に関心を持っていただきありがとうございます。本書には contributor が
最低限知るべき内容のみを記載しています。アーキテクチャ詳細 (座標系の不変条件、
モザイクのエクスポートパイプライン、クロップの原子性、updater の不変条件 等)
は repository ルートの [`CLAUDE.md`](./CLAUDE.md) を参照してください。

## ライセンスについて

Marianne は [PolyForm Noncommercial 1.0.0](./LICENSE) で配布されています。

contribution を提出することで、あなたの contribution も同ライセンスで
カバーされることに同意したものとみなします。商用利用、プロプライエタリ製品
への組み込み、その他個人利用以外の商用用途は **不可** です。

## 前提条件

- **Node.js** は [`.nvmrc`](./.nvmrc) のバージョンを使用
- **pnpm** は [`package.json`](./package.json) の `packageManager` のバージョンを使用
- **Rust** stable: [rustup](https://www.rust-lang.org/tools/install) 経由
- **Xcode Command Line Tools**: `xcode-select --install`
- macOS aarch64 開発機 — 他プラットフォームは未サポート

## セットアップ

```bash
pnpm install --frozen-lockfile
pnpm tauri dev   # Tauri 開発シェル起動
```

## コミット前の検証

```bash
pnpm fmt:check     # deno fmt (Prettier ではない)
pnpm lint          # ESLint v10 flat config
pnpm typecheck     # tsc --noEmit (strict + noUncheckedIndexedAccess)
pnpm test:run      # Vitest + Testing Library
pnpm build         # tsc && vite build
pnpm docs:build    # docs/ または site/ を変更した場合のみ
```

カバレッジはローカルでは `pnpm test:coverage` で計測できます。CI でも同じ
コマンドを実行し、`coverage/coverage-summary.json` を artifact として
アップロードします。

## ブランチ / コミット / PR の規約

- **ブランチ命名**: `feat/<short>` / `fix/<short>` / `chore/<short>` /
  `docs/<short>` / `ci/<short>`。軽微でない変更は `.worktrees/` 配下の
  専用 git worktree で作業してください。
- **コミットメッセージ**: [Conventional Commits](https://www.conventionalcommits.org/)
  形式、**英語** で記述。例: `feat(canvas): add stroke width preset`,
  `fix(menu): drop Backspace accelerator`。破壊的変更には `!` を付与
  (`feat!: remove deprecated API`)。**issue 番号はコミットメッセージに
  含めません** — PR 本文に紐づけます。
- **PR タイトル**: Conventional Commits、**英語** (コミットメッセージと同じスタイル)。
- **PR 本文**: **日本語**。[`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md)
  の構造 (`## 概要` / `## 変更内容` / `## 検証` / `## 関連`) に従ってください。
- **issue 関連付け**: PR 本文の `Closes #N` / `Refs #N` で記載。
- **デフォルトの PR 状態**: draft。CI が green になり、自身でレビュー済みに
  なってから ready for review にしてください。
- **1 PR = 1 つの目的**: PR を 1 つの関心事に集中させてください。

## コードスタイル

- **フォーマッタ**: `deno fmt` (Prettier では **ありません**)。設定は
  `deno.json` (lineWidth 100、スペース 2、ダブルクォート、セミコロンあり)。
- **TypeScript**: `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` +
  `noUnusedParameters` + `noImplicitOverride`。配列インデックスアクセスの
  結果は `T | undefined` なので適切に扱ってください。
- **React**: `react-hooks` の recommended ルールを ESLint で強制しています。
- **テスト**: Vitest + `@testing-library/react` + `@testing-library/jest-dom`。
  `globals: true` を有効にしているため `describe` / `it` / `expect` の
  import は不要です。**テーブルドリブンテストは原則禁止** — 1 ケース 1 `it()`
  にして、失敗時に該当ケースが特定できる形にしてください。
- **import**: `src/` 配下は `@/` パスエイリアスを使ってください。

## 次に読むもの

- [`CLAUDE.md`](./CLAUDE.md) — アーキテクチャ深堀り、不変条件、設計判断、
  既知の罠
- [`SECURITY.md`](./SECURITY.md) — 脆弱性報告ポリシー
- [Marianne docs (日本語)](https://takecy.github.io/marianne/ja/) — ユーザー
  向けドキュメント (機能、ショートカット、画像入力経路)
- [リリース手順](https://takecy.github.io/marianne/ja/releasing/) —
  メンテナー向けリリースワークフロー、署名鍵、GitHub Secrets

## バグ報告・機能要望

GitHub issue (<https://github.com/takecy/marianne/issues>) に登録して
ください。セキュリティに関わる報告は公開 issue ではなく
[`SECURITY.md`](./SECURITY.md) に記載のチャネル経由でお願いします。
