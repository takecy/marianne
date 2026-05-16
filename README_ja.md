# marianne

[English](./README.md) | **日本語**

Skitch風 画像注釈ローカルデスクトップアプリ（MVP）

完全オフラインで動作する、画像への注釈（アノテーション）に特化した軽量・高速なデスクトップアプリ。機密情報を含むスクリーンショットを安全に扱えるよう、外部サーバーへのアップロードは一切行わない。

参照: [Issue #1](https://github.com/takecy/marianne/issues/1)

## 技術スタック

- **デスクトップフレームワーク:** [Tauri v2](https://v2.tauri.app/)（Rust ベース）
- **フロントエンド:** React 19 + TypeScript + Vite
- **描画エンジン:** [react-konva](https://konvajs.org/docs/react/)（Konva.js の React ラッパー）
- **テスト:** Vitest + Testing Library
- **Lint:** ESLint v10（flat config）
- **フォーマット:** `deno fmt`

## 前提

開発前に以下のツールを用意してください。

| ツール         | 要件                                                           |
| -------------- | -------------------------------------------------------------- |
| Node.js        | ESLint v10 公式 engine 要件 `^20.19.0 \|\| ^22.13.0 \|\| >=24` |
| Rust toolchain | `rustup` で stable をインストール                              |
| Xcode CLT      | macOS バンドル生成用                                           |
| pnpm           | 9 系以上                                                       |
| deno           | フォーマッタとして使用                                         |
| gh CLI         | PR 作成                                                        |

## セットアップ

```sh
pnpm install
```

## 開発

```sh
# Tauri デスクトップアプリを起動（HMR 付き）
pnpm tauri dev

# Vite フロントエンドのみ起動（ブラウザで動作確認）
pnpm dev
```

## 検証コマンド

```sh
pnpm typecheck      # tsc --noEmit
pnpm lint           # ESLint
pnpm fmt            # deno fmt
pnpm fmt:check      # deno fmt --check
pnpm test           # Vitest (watch)
pnpm test:run       # Vitest (single run)
```

## ビルド

```sh
pnpm tauri build    # macOS バンドルを src-tauri/target/release/bundle に出力
pnpm build:dmg      # 配布用 dmg を src-tauri/target/release/bundle/dmg/ から ./dist-bundle/ にコピー
```

**配布物は Apple Silicon (aarch64) Mac 専用**。Intel Mac / Universal binary は未提供。生成される dmg ファイル名は `Marianne_<version>_aarch64.dmg`（例: `dist-bundle/Marianne_0.1.0_aarch64.dmg`）。

### 署名 env の供給（updater 用）

`tauri.conf.json` で `createUpdaterArtifacts: true` を有効にしているため、`pnpm tauri build` / `pnpm install:local` / `pnpm build:dmg` の実行時に updater 用署名鍵が必要。**未設定だとビルドが署名フェーズで失敗する**。

ローカルで supply するには以下のいずれか:

```sh
# direnv (推奨): リポジトリ直下に .envrc を作成（.gitignore 済）
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/marianne.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
```

```sh
# または直接シェルに export してから build を実行
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/marianne.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
pnpm install:local
```

CI では GitHub Secrets として登録した `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` が release.yaml に流れる。

## dmg からのインストール (macOS)

配布された dmg ファイルから Marianne をインストールする手順（エンドユーザー向け）。

**対応機種**: Apple Silicon (M1 / M2 / M3 系) 搭載 Mac、macOS 11.0 (Big Sur) 以降。**Intel Mac は対象外**で、起動時に `Bad CPU type in executable` エラーで失敗する（aarch64 only ビルドのため）。

1. dmg をダブルクリックでマウントする。
2. 開いた Finder ウィンドウから `Marianne.app` を `/Applications` フォルダにドラッグ＆ドロップする。
3. dmg をアンマウントする（Finder サイドバーから取り出し）。
4. Launchpad / Spotlight から Marianne を起動する。

> 本ビルドはコード署名なし。初回起動時に「開発元を確認できないため開けません」と警告される場合は、`/Applications/Marianne.app` を右クリック →「開く」を選ぶか、`xattr -dr com.apple.quarantine /Applications/Marianne.app` をターミナルで一度実行する。

## ローカルインストール (macOS)

開発機で日常的に使うために、最新ビルドを `/Applications/` に配置して Launchpad / Spotlight から起動できるようにする。配布用 dmg を作る場合は上の「ビルド」セクションの `pnpm build:dmg` を参照。

**対応機種**: Apple Silicon Mac、macOS 11.0 (Big Sur) 以降（`pnpm install:local` も aarch64 ビルドのみを生成する）。

```sh
pnpm install:local
```

このスクリプトは `pnpm tauri build` を実行し、既存の `/Applications/Marianne.app` を削除して、新しくビルドした bundle をその場所にコピーする。

> 本ビルドはコード署名なし。macOS 初回起動時に「開発元を確認できないため開けません」と警告される場合は、対象の `.app` を右クリック →「開く」を選ぶか、`xattr -dr com.apple.quarantine /Applications/Marianne.app` を一度実行する。

要件: macOS 専用。Linux / Windows ではエラーで終了する。アプリ起動中に実行すると上書きに失敗する場合があるため、事前にアプリを終了しておく。

## 自動アップデート

エンドユーザーは何もしなくても新バージョンに追従できる。

- 起動時に自動でアップデートを確認し、新バージョンが見つかるとモーダルで通知
- Toolbar の「更新を確認」ボタンから手動チェックも可能
- 「今すぐ更新」を選ぶとダウンロード → 自動インストール → アプリ再起動
- **編集中の注釈は再起動で失われるため**、未保存のものがある場合はモーダルで警告される。先に保存してから更新するのを推奨
- ネットワーク失敗・署名検証失敗などのエラーは Toolbar の更新ボタン横に `⚠ Failed` と小さく表示される（作業はブロックされない）。ホバーで詳細メッセージ。再試行は同じボタンを押すだけ

配信エンドポイントは `https://github.com/takecy/marianne/releases/latest/download/latest.json` 固定。`releases/latest` を見るため、**draft / pre-release のリリースには反応しない**。

## リリース手順 (メンテナー向け)

リリースは GitHub Actions で完結する。

1. リポジトリの **Actions → Bump version → Run workflow** を実行
   - `bump_version` を選択 (patch / minor / major)。Conventional Commits が検出された場合はそちらが優先される
2. ワークフローが自動で以下を実施:
   - 次バージョンを `dry_run` で算出
   - `scripts/bump-version.sh` で `package.json` / `tauri.conf.json` / `Cargo.toml` を 1 コミットで同期
   - main に commit + push
   - `vX.Y.Z` タグを push
3. タグ push をトリガーに **Release** ワークフローが macos-14 (Apple Silicon) で起動
   - `pnpm tauri build --target aarch64-apple-darwin` で署名済みバンドル生成
   - `Marianne.app.tar.gz` + `.sig` + `latest.json` を GitHub Release に publish (draft なし、prerelease なし)
4. 既存ユーザーは次回起動時に自動で `latest.json` を取得し、新バージョンを検出

### 必要な GitHub Secrets

リリースを動かす前に、リポジトリの Settings → Secrets で以下を登録する:

| Name                                 | Value                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `TAURI_SIGNING_PRIVATE_KEY`          | `~/.tauri/marianne.key` の中身全文                                                                     |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 鍵生成時のパスフレーズ（空でも空文字列で登録）                                                         |
| `PAT_FOR_TAG_PUSH`                   | `contents:write` 権限の Personal Access Token (これがないと tag push が release.yaml をトリガーしない) |

### 鍵管理

- 秘密鍵 `~/.tauri/marianne.key` は **絶対にコミットしない** (`.gitignore` 済)
- 1Password 等にバックアップ。紛失すると既存ユーザーが新リリースを検証できなくなる
- `tauri.conf.json` の `pubkey` を変更すると、変更前にインストールしたユーザーのアップデートが拒否される。**鍵は固定運用**が前提

## ライセンス

[MIT](./LICENSE)
