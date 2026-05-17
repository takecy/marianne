# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

`marianne` は完全オフラインで動作する Skitch 風の画像注釈デスクトップアプリ（MVP）。画像に対して矩形 / 矢印 / テキスト / モザイクのアノテーションを付与し、PNG としてファイル保存またはクリップボードへコピーする。外部ネットワーク通信は一切行わない。

技術スタック: **Tauri v2（Rust シェル）+ React 19 + TypeScript + Vite + react-konva + Zustand**。Tauri バックエンドは意図的に最小限（`src-tauri/src/lib.rs` の `greet` / `take_pending_open_paths` / `confirm_quit` / `renderer_ready` の 4 コマンドのみ。`greet` はサンプル、残りは OS 統合用のグルーコード）で、機能開発はほぼ `src/` 内で完結する。

## よく使うコマンド

基本コマンドは @README_ja.md を参照（英語版は @README.md）。CLAUDE 固有の注意点のみ:

- フォーマッタは **`deno fmt`** であって Prettier ではない (`deno.json` 設定済み)
- 単一テスト実行: `pnpm test:run src/store/canvasStore.test.ts` / `pnpm test:run -t "undo"`
- パスエイリアス `@/*` → `./src/*` は `tsconfig.json` / `vite.config.ts` / `vitest.config.ts` の 3 箇所で設定。変更時は全て同期させる。
- ローカルインストール: `pnpm install:local`（macOS 専用。`scripts/install-local.sh` が `pnpm tauri build` 実行後、`/Applications/marianne.app` にコピー。コード署名なしのため初回起動で Gatekeeper 警告 — 右クリック「開く」または `xattr -dr com.apple.quarantine` で回避。詳細は README）

## アーキテクチャ

### 座標系の不変条件（最初に読むこと）

**`Shape`（`src/types/shape.ts`）および `canvasStore` に保存されるシェイプ座標は、すべて画像の自然ピクセル空間（natural pixel space）である。** `(0, 0)` が画像の左上、最大値は `naturalWidth / naturalHeight`。screen 座標との変換は描画境界でのみ行い、`src/lib/imageFit.ts` のヘルパーを使う:

- `fitContain(image, container)` → 画像をレターボックス配置した時の表示矩形（screen px の `FitRect`）
- `imageToScreen` / `screenToImage` — 双方向変換
- `imageToScreenScale` — ストローク幅・フォントサイズ・モザイクピクセルサイズ向けの `scaleX` / `scaleY` を個別に返す
- `clampToImage` — ポインタ由来の座標を画像内にクランプ

新しいシェイプ型やポインタ操作を追加する際、screen 座標を絶対に永続化しないこと。マウスハンドラや `onTransformEnd` の入口で変換し、natural 座標を保存する。`SelectableShape.tsx` と `CanvasArea.tsx` がそのパターンの実例。各 transform 終了後に `node.scaleX(1); node.scaleY(1)` でリセットしている理由は、Konva の一時的な scale が次のレンダーへリークしないようにするため。

### 状態管理: Zustand + identity-preserving な履歴

`src/store/canvasStore.ts` がシェイプ・選択・undo/redo・アプリ内シェイプクリップボードの単一の真実ソース:

- `shapes`, `past: Shape[][]`, `future: Shape[][]`, `selectedShapeId`, `clipboardShape: Shape | null`
- すべての変更は `withHistory(state, nextShapes)` を経由する。挙動:
  1. `nextShapes === state.shapes`（参照等価）なら旧 state をそのまま返す。`patchByType` はマッチが無い時に元配列を再利用するので、ヒットしない `updateXxx()` 呼び出しが履歴を汚すのを防ぐ。
  2. 旧 `shapes` を `past` に push し、`HISTORY_LIMIT = 50` でキャップ、`future` をクリア。
- `undo` / `redo` は `selectedShapeId` をクリアする（しないと Transformer が古いノードに掴みかかるため）。
- `App.tsx` は新しい画像を読み込む際に `clearShapes()` を呼び、前の画像のアノテーションが残らないようにしている（`clearShapes()` は `past` / `future` も同時にクリアするため、画像切替後は前画像のシェイプを undo で復元できない）。

新しいシェイプ種別を追加するときは、`patchByType(shapes, id, "<type>", patch)` を呼ぶ型付き `updateXxx` アクションを追加する。型 discriminator が `shape.type` でフィルタするので、型を跨いだパッチは黙って破棄される。

### 描画ジェスチャーのステートマシン

`src/lib/drawingGesture.ts` は純粋モジュール（React 非依存・Konva 非依存）。`CanvasArea.handleMouseDown/Move/Up` の流れ:

1. `startDraft(tool, color, point)` → `DraftShape`
2. mousemove ごとに `moveDraft(draft, point)`
3. `finalizeDraft(draft)` → `Shape | null`（`MIN_*` 閾値未満なら `null` を返す）

`DraftShape` はドラッグ中に `width / height` が負になることを許容する。`finalizeDraft` 内で `Math.min` + `Math.abs` を使い、正の extent を持つシェイプに正規化する。このモジュールは独自の単体テストを持っており、React を import してはいけない。

### Rect の stroke width プリセット

`src/types/tool.ts` の `STROKE_WIDTH_PRESETS` で 4 段階を定義: `thin = 6` / `medium = 12` / `thick = 18` / `extraThick = 28`。`RectShape.strokeWidth` は **optional** で、未指定時は `"thick"` (=18) にフォールバックする。これは新フィールド導入前に保存・テスト fixture 化された矩形を `SHAPE_STROKE_WIDTH = 18` 時代と視覚的に完全一致させるための後方互換規約。新規 RectShape を作るコード (`startDraft` / クローン / ペースト) では明示的に値を入れること。

`strokeWidthValue(name)` が返す数値は **export 時は natural ピクセル、画面描画時は screen ピクセル** の両方として使われる。これは export 側 (`exportImage.ts`) が画像の自然サイズで Stage を構築するため、画面側の `imgScaleX` 乗算なしでもサイズが一致するという設計。on-canvas で `strokeWidth * imgScaleX` をすると 2 重スケールになって極端に太くなるので絶対にやらないこと (`SelectableShape.tsx` / `CanvasArea.renderDraft` のいずれも生の数値を渡している)。

### モザイクの描画 & エクスポートパイプライン

モザイクはパイプラインで最も繊細な部分:

- 画面表示 (`MosaicNode.tsx`): natural ピクセル矩形を `crop` として持つ `Konva.Image` に `filters: [Pixelate]` を適用し、`pixelSize = MOSAIC_NATURAL_PIXEL_SIZE * min(imgScaleX, imgScaleY)` を設定。`useEffect` 内で `cache()` を呼ぶが、その deps にはキャッシュキャンバスに影響する全 prop を含めること。1 つでも漏らすとピクセル化が古いまま固まる。
- エクスポート (`src/lib/exportImage.ts`): 画像の自然サイズで _新しい_ オフスクリーン `Konva.Stage` を構築し、モザイクノードに `MOSAIC_EXPORT_FLAG` のタグを付け、`stage.toCanvas({ pixelRatio: 1 })` の **前に** `.cache({ pixelRatio: 1 })` を呼ぶ。この 2 箇所の `pixelRatio: 1` は必須。指定しないと Retina (DPR=2) でキャッシュキャンバスが 2 倍化し、PNG 上でブロックサイズが小さく見えてしまう。

`MOSAIC_NATURAL_PIXEL_SIZE = 24`（`MosaicNode.tsx` で定義）は natural 画像座標でのブロックサイズ。画面側ノードもエクスポートパイプラインもこの同じ定数を import する。値を変えると過去にエクスポート / 表示済みのモザイクの粗さが変わるので、UX 上の判断として固定運用する。

### クリップボードへのエクスポート — 同期的な Promise ハンドオフ

`App.tsx` の `handleExportToClipboard` は **`async` ではなく**、blob を **`await` しない**:

```ts
const blobPromise = exportToBlob(image, shapes);
copyImageToClipboard(blobPromise); // Promise<Blob> をそのまま ClipboardItem へ渡す
```

`copyImageToClipboard`（`src/lib/exportImage.ts`）は `Promise<Blob>` を直接 `new ClipboardItem({ "image/png": blobPromise })` に渡す。WebKit / WKWebView では `navigator.clipboard.write` をユーザージェスチャーハンドラ内で同期的に開始する必要があり、先に `await` すると transient user activation トークンを失って Tauri webview 上でクリップボード書き込みが無言で失敗する。これを `async/await` にリファクタしないこと。

### シェイプの内部クリップボードと Option+drag による複製

`canvasStore.clipboardShape` は OS クリップボードとは別の、**アプリ内専用のシェイプクリップボード**。`Cmd+C` (Shift なし) で選択中シェイプを格納し、`Cmd+V` (Shift なし) で `clipboardShape` がある時のみ `preventDefault` を呼んで貼付する。`clipboardShape` が空の時は `preventDefault` をスキップするので、ブラウザのデフォルト `paste` イベントが走り `useImageLoader` が OS クリップボード経由の画像ペーストを拾える。OS の画像クリップボードとアプリ内シェイプクリップボードを 1 つの `Cmd+V` で両立させるための分岐。

クローン処理は `src/lib/shapeClipboard.ts` の 2 関数に分かれている (意図的な使い分け):

- `cloneShapeForPaste(source, imageSize)`: 内部クリップボード経由のペースト用。位置を `PASTE_OFFSET = 20` natural ピクセルだけ右下にずらすことで、同じ場所への連続ペーストでも階段状に並ぶ。
- `cloneShapeAt(source, anchor, imageSize)`: Option+drag 用。`onDragEnd` で得た drop 位置を明示的な anchor として渡し、その点をシェイプの新しい原点 (rect/text/mosaic は top-left、arrow は from 端点) に据える。

どちらも `clampToImage` で画像内に収めつつ、新 `id` を `crypto.randomUUID()` で発行する。Arrow は両者とも `to - from` の delta を保ち、向きと長さを保存する。新しいペーストの仕様 (固定オフセット vs 明示位置) を変えたい時は、用途側の関数だけを編集すること — 統合してしまうと逆側の UX が壊れる。

**Option+drag によるシェイプ複製** (`SelectableShape.tsx`) は「**開始時 alt AND 終了時 alt**」の AND 判定。`onDragStart` で `altAtStartRef = event.evt.altKey` を記録し、`onDragEnd` で `altAtStart && event.evt.altKey` の時だけ `cloneShapeAt` を呼んで複製する (源シェイプは動かさず、ドラッグ位置に新クローンを配置)。途中で Option を離せば通常の移動として扱われる (`keyup` リスナで `showAltDragGhost` を即座に閉じる)。「終了時のみ alt」では誤発動するため、AND は必須。元位置に静的な ghost (`showAltDragGhost` state でレンダー) を描くことで「元が動かない」UX を視覚化している。

### 画像の入力

ファイルオープンダイアログは存在しない。画像は次の 3 経路でのみ入る:

- ペースト (`Cmd/Ctrl + V`) — 先頭の `image/*` クリップボード item
- ウィンドウへのドラッグ&ドロップ — 先頭の `image/*` ファイル
- macOS の「このアプリケーションで開く」 — Finder からのファイル関連付け起動。アプリ未起動時は Rust 側の `RunEvent::Opened` でパスをキューし、フロント初期化時に `take_pending_open_paths` を invoke して取り出す (cold-start drain)。既に起動中なら `file-open-requested` イベントで warm-start listen する

`src/lib/useImageLoader.ts` が `paste` / native drag-drop / `file-open-requested` イベントを統合し、`LoadedImage`（HTMLImageElement + 自然サイズ + `source: "paste" | "drop" | "file"` + 任意の絶対パス / ファイル名）を 1 つ発行する。`tauri.conf.json` で `"dragDropEnabled": false` を設定しており、Tauri のネイティブドロップを抑制して Web レイヤで処理している (これにより drop した画像の絶対パスを Rust 側で確定できる)。パス検証 (拡張子 whitelist / symlink 拒否) は Rust 側が trust boundary。フロントの `isImagePath` は defense in depth。

### キーボードショートカット

`CanvasArea.tsx` の `keydown` リスナが管理（テキスト入力にフォーカスが当たっている時 / textarea や input にフォーカスがある時はネイティブの編集を尊重するため bail out する）:

| キー                        | 動作                                               | 補足                                                                                    |
| --------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Cmd/Ctrl + Shift + S`      | PNG をファイル保存                                 | ネイティブの保存ダイアログを開く                                                        |
| `Cmd/Ctrl + Shift + C`      | PNG をシステムクリップボードへコピー               | 同期的 Promise ハンドオフが必須 (後述)                                                  |
| `Cmd/Ctrl + Z`              | undo                                               |                                                                                         |
| `Cmd/Ctrl + Shift + Z`      | redo                                               |                                                                                         |
| `Cmd/Ctrl + C`              | 選択中シェイプをアプリ内クリップボードへコピー     | 選択モードかつシェイプ選択時のみ                                                        |
| `Cmd/Ctrl + V`              | アプリ内クリップボードのシェイプを貼付             | `clipboardShape` が無い時は `preventDefault` を呼ばないので OS の画像ペーストが動作する |
| `v` / `a` / `r` / `t` / `m` | ツール切替 (select / arrow / rect / text / mosaic) | 画像未読み込み時は無視。`TOOL_SHORTCUTS` (`src/types/tool.ts`) で定義                   |
| `Delete` / `Backspace`      | 選択中シェイプの削除                               | 選択モード時のみ                                                                        |

`Cmd+C` / `Cmd+V` (Shift なし) は OS クリップボードには触れずアプリ内専用クリップボードで動作する一方、`Cmd+Shift+C` は PNG 出力という別経路の機能。エクスポートを `Cmd+E` に振り直すなどしないこと: 既存ユーザーの筋肉記憶を壊すうえ、`Cmd+V` の挙動と意味的に対をなしている。

## 規約

- **フォーマッタは `deno fmt`（Prettier ではない）。** 設定は `deno.json`（lineWidth 100、スペース 2、ダブルクォート、セミコロンあり）。コミット前に `pnpm fmt:check` を回すこと。
- **ESLint v10 flat config**（`eslint.config.js`）。`tseslint.configs.strict` + `stylistic` に `react-hooks` の recommended を加えた構成。`tsconfig.json` で `noUncheckedIndexedAccess` と `noUnusedLocals` を有効にしているため、配列インデックスの結果は `T | undefined` として扱う必要がある。
- **テスト**は Vitest + jsdom + `@testing-library/react` + `@testing-library/jest-dom`（`src/test/setup.ts` で自動 import）。`vitest.config.ts` で `globals: true` を有効化しているため `describe` / `it` / `expect` の import 不要。純粋モジュール（`drawingGesture`、`imageFit`、`canvasStore` など）は単体テスト、React コンポーネントは Testing Library でテストする。
- **`src/` 内の import** は長い相対パスではなく `@/` エイリアスを使うこと。
- **色プリセット**は `src/types/tool.ts` の `COLOR_PRESETS` / `colorHex` に集約されている。コンポーネント内に hex 文字列をハードコードしないこと。
- **外部依存はプラットフォーム機能で代替できる場合は追加しない。** プロジェクト方針に従い、ブラウザ / Node / Konva で済むものはライブラリ追加を避ける。

## Tauri 統合の注意点

- 開発 URL は `http://localhost:1420` 固定（`vite.config.ts` の `strictPort: true` と `tauri.conf.json` が対応）。片方だけ変更しないこと。
- `src-tauri/capabilities/default.json` の permissions リストは現在 `core:default` / `core:window:allow-set-size` / `core:window:allow-center` / `opener:default` / `dialog:allow-save` / `fs:allow-write-file` / `fs:allow-read-file` / `updater:default` / `process:default` の 9 個。`core:window:*` は `src/lib/windowResize.ts` が画像読み込み時にウィンドウサイズを自動調整するために使う。Rust 側プラグインを追加するときは capability も同時に追加すること（怠ると `invoke` が ACL で拒否される）。
- フロントは `dist/` にビルドされ、`tauri.conf.json` の `frontendDist` 設定で `../dist` から提供される。

### セルフアップデートに関する不変条件

`tauri-plugin-updater` を運用する上で、以下を破ると壊れる:

1. **3 ファイルの version 同期**: `package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` の version は常に一致していること。updater は `tauri.conf.json` 内の version をローカル基準にしてリモートの `latest.json` と比較する。手動でバンプせず必ず `scripts/bump-version.sh` を使う（tagging.yaml も内部で呼ぶ）。
2. **公開鍵 (`plugins.updater.pubkey`) は固定**: 既に配布したアプリは埋め込んだ pubkey でしか署名検証しない。途中で鍵を差し替えると既存ユーザー全員が永遠に更新できなくなる。秘密鍵 `~/.tauri/marianne.key` は 1Password 等にバックアップ必須。
3. **`.tauri/` / `*.key` / `*.key.pub` / `.envrc` / `.env*` はコミット禁止**: `.gitignore` 済。
4. **ローカル build に signing env が必要**: `createUpdaterArtifacts: true` 設定のため、`pnpm tauri build` / `install:local` / `build:dmg` 実行時に `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` env が無いと署名フェーズで落ちる。direnv 等で供給する。
5. **リリースは `tagging-release.yaml` の `workflow_dispatch` 経由のみ**: `tagging` (ubuntu) → `release` (macos-14, `needs: tagging`) の 2 ジョブ構成で 1 ワークフロー内で完結する。`GITHUB_TOKEN` だけで動くため PAT は不要。**手動の `git push origin vX.Y.Z` は禁忌** — bump-version.sh による 3 ファイル同期 + tauri-action の署名フローを通っていないタグはリリースとして成立せず updater が空振りする。
6. **`tagging-release.yaml` の `releaseDraft: false` / `prerelease: false` は必須**: updater endpoint が `releases/latest/download/latest.json` を見るため、draft / prerelease のリリースだと 404 になり全ユーザーで更新が失敗する。
7. **`relaunch()` は `await update.downloadAndInstall(...)` の解決後にのみ呼ぶ**: progress callback の `Finished` イベントは download 完了の signal であって install 完了ではない。callback 内で `relaunch()` を呼ぶと install が中断される。詳細は `src/lib/useUpdater.ts` のコメント参照。

### その他の CI ワークフロー

リリース用の `tagging-release.yaml` 以外に 2 つの CI ワークフローが PR / push を保護している:

- `.github/workflows/ci.yml`: `main` への push と PR で起動。`pnpm install` → `lint` → `typecheck` → `fmt:check` → `test:run` → `build` → `docs:build` を 15 分タイムアウトで実行する (`docs:build` は Astro Starlight + Mermaid SSR を含むため、Playwright Chromium を pnpm-lock.yaml ハッシュ単位でキャッシュした上で必要時のみインストールする)。これが赤いと PR はマージできない。ローカルでも `pnpm fmt:check` / `pnpm lint` / `pnpm typecheck` / `pnpm test:run` を回しておくと CI 待ちを減らせる。`docs/` 配下を変更した場合は `pnpm docs:build` も手元で通しておく (Mermaid 生成 SVG の `id` と Astro の content-hashed ファイル名が毎回変わるので strict diff 検証はせず、build 成功のみが CI のチェック対象)。
- `.github/workflows/trivy.yaml`: PR と `workflow_dispatch` で起動。`CRITICAL` / `HIGH` の CVE のみを検出してファイルシステム全体をスキャンする。検出時は依存更新 (`pnpm up <pkg>` または `cargo update -p <crate>`) で対処。`MEDIUM` 以下は無視する設定なので、警告レベルの脆弱性で PR が止まることはない。
