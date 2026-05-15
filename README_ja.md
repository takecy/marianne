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

## ライセンス

[MIT](./LICENSE)
