# セキュリティポリシー

[English](./SECURITY.md) | **日本語**

## サポート対象バージョン

最新リリース ([Releases](https://github.com/takecy/marianne/releases) の最新版) のみが
サポート対象です。 アップデートはアプリ内アップデーター (`tauri-plugin-updater`)
経由で配信されるため、古いバージョンへの patch backport は行いません。

## 脆弱性の報告方法

セキュリティに関する報告は **GitHub Private Vulnerability Reporting** を経由
してください:

- <https://github.com/takecy/marianne/security/advisories/new>

公開 issue や pull request で報告 **しない** でください。

トリアージの目安 (best-effort、個人プロジェクトのため厳密な保証はありません):

- **初期応答**: 7 日以内
- **修正方針または mitigation 計画提示**: 30 日以内

報告時には以下を含めてください:

- 影響を受けるバージョン (または commit SHA)
- 再現手順と観測された挙動
- 期待される挙動
- proof-of-concept がある場合はその成果物 (機密性のある内容は明示してください)

## スコープ

### スコープ内 (PVR で報告してください)

- 配布バイナリ (`.dmg` / `.app`) の脆弱性
- updater 経路 (`tauri-plugin-updater` の署名検証、`latest.json` 経路) の bypass
- Rust 側 trust boundary (`safe_image_canonical` 等) を **bypass する新規 exploit**
- 配布署名鍵 (`TAURI_SIGNING_PRIVATE_KEY` / `~/.tauri/marianne.key`) の侵害、
  あるいはそれにつながりうる脆弱性
- ビルド・配布パイプライン (`tagging-release.yaml`, GitHub Actions secrets) の
  compromise

### 既知の残存リスク (具体的な exploit を実証できればスコープ内)

- `safe_image_canonical` の TOCTOU 残存: 検証は **symlink decoy 緩和 +
  path-string canonical 化のみ** で、親ディレクトリを制御できる攻撃者は
  検証後の read との間に race を入れる余地が残ります。これは `CLAUDE.md` に
  明記済みで別 issue で対応中です。親ディレクトリ制御以外の attack model
  での bypass を再現できればスコープ内として扱います。
- Apple notarization 未実施: 初回起動時の Gatekeeper 警告は README に
  記載済みです。notarization 周辺で新規な security implication があれば
  スコープ内として扱います。

### スコープ外

- 報告者環境固有の問題で Marianne の trust boundary 外のもの (報告者自身の
  ローカル `direnv` 設定ミス、報告者の Mac の権限管理不全 等)
- `trivy.yaml` 経由で既に公開済みの upstream CVE: 新規 advisory として
  再報告しないでください
