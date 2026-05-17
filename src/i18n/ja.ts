import type { TranslationKey } from "./en";

export const ja: Record<TranslationKey, string> = {
  // tool labels (Sidebar TOOL_LABELS)
  "tool.select": "選択",
  "tool.arrow": "矢印",
  "tool.rect": "四角",
  "tool.text": "テキスト",
  "tool.mosaic": "モザイク",

  // stroke width labels (Sidebar STROKE_WIDTH_LABELS)
  "strokeWidth.thin": "細",
  "strokeWidth.medium": "中",
  "strokeWidth.thick": "太",
  "strokeWidth.extraThick": "極太",

  // sidebar group labels (aria-label)
  "sidebar.toolbar.label": "ツールバー",
  "sidebar.toolGroup.label": "ツール",
  "sidebar.colorGroup.label": "色",
  "sidebar.strokeWidthGroup.label": "太さ",
  "sidebar.historyGroup.label": "履歴",
  "sidebar.updateGroup.label": "更新",

  // history + update actions (Sidebar)
  "action.undo.label": "戻る",
  "action.undo.title": "戻る (Cmd/Ctrl+Z)",
  "action.redo.label": "進む",
  "action.redo.title": "進む (Cmd/Ctrl+Shift+Z)",
  "action.checkUpdates.label": "更新を確認",
  "action.checkUpdates.idle": "更新を確認",
  "action.checkUpdates.checking": "確認中…",

  // ActionBar (export toolbar)
  "actionBar.label": "書き出し",
  "action.save.label": "保存",
  "action.save.title": "保存 (Cmd/Ctrl+Shift+S)",
  "action.copy.label": "コピー",
  "action.copy.copied": "コピーしました",
  "action.copy.title": "クリップボードへコピー (Cmd/Ctrl+Shift+C)",
  "action.copy.announcement": "クリップボードへコピーしました",

  // UpdateModal (dynamic interpolation for {version})
  "update.available.title": "新しいバージョン {version} が利用可能です",
  "update.releaseNotes.label": "変更内容:",
  "update.warning.unsaved":
    "⚠ 未保存の注釈があります。更新するとアプリが再起動し、編集中の内容は失われます。先に保存してから更新してください。",
  "update.notice.restart": "更新を適用するとアプリが再起動します。",
  "update.action.later": "後で",
  "update.action.install": "今すぐ更新",
  "update.status.downloading": "ダウンロード中…",
  "update.status.applying": "更新を適用しています",
  "update.readyToInstall.body": "{version} のインストール後、アプリが自動で再起動します。",

  // Canvas (empty state + aria)
  "canvas.label": "キャンバス",
  "canvas.empty.title": "画像を読み込み",
  "canvas.empty.message":
    "画像をクリップボードから貼り付け（⌘V / Ctrl+V）するか、ここにドラッグ＆ドロップしてください。",

  // StatusBar (SOURCE_LABELS + aria)
  "source.paste": "クリップボードから貼り付け",
  "source.drop": "ドラッグ&ドロップで読み込み",
  "source.file": "ファイルを開く",
  "statusBar.imageInfo.label": "画像情報",

  // TextInputOverlay
  "textInput.label": "テキスト入力",

  // App.tsx confirm dialogs + ConfirmDialog default
  "dialog.quit.title": "未保存の注釈があります",
  "dialog.quit.message": "編集中の注釈は保存されません。本当に終了しますか?",
  "dialog.quit.confirm": "終了する",
  "dialog.imageReplace.title": "編集中の注釈があります",
  "dialog.imageReplace.message":
    "新しい画像を読み込むと、現在の注釈は破棄されます。破棄して読み込みますか?",
  "dialog.imageReplace.confirm": "破棄して読み込み",
  "dialog.cancel": "キャンセル",

  // Error messages
  "error.imageLoadFailed": "画像の読み込みに失敗しました",
  "error.update.generic": "更新処理でエラーが発生しました",
  "error.update.infoLost": "更新情報が失われました。再度確認してください。",
};
