# Marianne

[English](./README.md) | 日本語

> Skitch 風オフライン画像アノテーション用アプリケーション (Apple Silicon向け)

<div align="center">
  <img src="./assets/design/marianne_app.png" alt="Marianne アプリのスクリーンショット" width="400" />
</div>

## なぜ今さら別の画像アノテーションアプリを作ったのか？

- **Skitch が使えなくなる**: 長年 Skitch (Evernote製) を愛用してきた。毎日何度も起動し、画像に矢印とテキストをつけまくってきた。しかし、Skitchは今はメンテナンスおらず、Intel CPU 向けのみ。[macOS から Intel サポートが消え](https://developer.apple.com/documentation/apple-silicon/about-the-rosetta-translation-environment/)、Skitchが動かなくなる警告が表示されたことをきっかけに、Skitch の精神を継ぐApple Silicon対応アプリとして作成。
- **最小限の機能**: Skitchの代替アプリケーションは多く存在し、どれも素晴らしい出来だが、私の用途には機能が多すぎた。手元の画像に矢印とテキスト、たまにモザイクが入れられば十分だった。
- **矢印の形**: Skitchの矢印の形が本当に大好きだった。あの矢印の形をアノテーションできるアプリを見つけられず、自作することにした。あの見慣れたスタイルのテキストも。

### 名前について

私が大好きな漫画「ONE PIECE」に登場する画家「[ミス・ゴールデンウィーク](https://one-piece.com/character/Ms_Goldenweek/index.html)」の本名。

## 設計思想

- **オフライン**: ログインなし、テレメトリ・クラウド同期・外部サーバー通信なし (アップデートチェックのみ)。
- **シンプル**: 矢印、矩形、テキストのアノテーションにモザイク、それとちょっとしたクロップができるだけ。
- **小さく高速**: [TAURI](https://v2.tauri.app/) をベースにアプリサイズは20MB以下。 起動も爆速。
- **AI機能なし**: AI関連の機能はない。私(人間)が画像に矢印を入れるためのもの。

## スクリーンショット

<div align="center">
  <img src="./assets/design/example_01.png" alt="Marianne でのアノテーション例" width="600" />
</div>

## インストール

### リリースから

> [!NOTE]\
> Apple Silicon Mac 専用です

1. [Releases](https://github.com/takecy/marianne/releases) から最新の `Marianne_<version>_aarch64.dmg` をダウンロード。
2. dmg をマウントし、`Marianne.app` を `/Applications` フォルダにドラッグ。
3. 初回起動時、Gatekeeper の警告が出たらアプリを右クリック →「開く」で承認する (Apple税($99/年)を未払いのため)。または `xattr -dr com.apple.quarantine /Applications/Marianne.app` をターミナルで一度実行する。

スクリーンショットをペースト (`Cmd + V`) 、ウィンドウに画像をドラッグ、画像の右クリックメニューの`このアプリケーションで開く`から注釈作業を始められる。

### ソースコードから

1. 以下がインストールされていることを確認 (macOS の Tauri v2 公式前提に準拠)
   - Xcode Command Line Tools: `xcode-select --install`
   - Rust: [公式サイト](https://www.rust-lang.org/tools/install)
   - pnpm: [公式サイト](https://pnpm.io/installation)
1. このリポジトリをクローン
1. `pnpm install --frozen-lockfile` で依存関係をインストール
1. `pnpm install:local:unsigned` で `/Applications/Marianne.app` にインストール
1. 初回起動時、Gatekeeper の警告が出たらアプリを右クリック →「開く」で承認する。または `xattr -dr com.apple.quarantine /Applications/Marianne.app` をターミナルで一度実行する。

> [!NOTE]\
> このビルドは自動アップデートが無効です。新しいバージョンに上げるには `git pull && pnpm install:local:unsigned` を再実行してください。

## ドキュメント

- **ユーザー向け**: [Marianne docs](https://takecy.github.io/marianne/ja/) — 機能、キーボードショートカット、画像入力経路、エクスポート方法
- **contributor 向け**: [はじめに](https://takecy.github.io/marianne/ja/getting-started/) — 技術スタック、開発環境、検証コマンド、worktree ワークフロー
- **メンテナー向け**: [リリース手順](https://takecy.github.io/marianne/ja/releasing/) — リリースワークフロー、署名鍵、GitHub Secrets

## ライセンス

[PolyForm Noncommercial 1.0.0](./LICENSE)

個人利用および非商用利用は自由。プロプライエタリな製品への組込や再販は不可。\
本プロジェクトは Plasq、Evernote、集英社、尾田栄一郎いずれとも無関係。「Skitch」「ONE PIECE」は各権利者の商標。
