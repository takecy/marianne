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

## ライセンス

[MIT](./LICENSE)
