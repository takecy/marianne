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
```

## ローカルインストール (macOS)

開発機で日常的に使うために、最新ビルドを `/Applications/` に配置して Launchpad / Spotlight から起動できるようにする。

```sh
pnpm install:local
```

このスクリプトは `pnpm tauri build` を実行し、既存の `/Applications/marianne.app` を削除して、新しくビルドした bundle をその場所にコピーする。

> 本ビルドはコード署名なし。macOS 初回起動時に「開発元を確認できないため開けません」と警告される場合は、対象の `.app` を右クリック →「開く」を選ぶか、`xattr -dr com.apple.quarantine /Applications/marianne.app` を一度実行する。

要件: macOS 専用。Linux / Windows ではエラーで終了する。アプリ起動中に実行すると上書きに失敗する場合があるため、事前にアプリを終了しておく。

## ライセンス

[MIT](./LICENSE)
