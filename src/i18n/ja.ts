import type { TranslationKey } from "./en";

export const ja: Record<TranslationKey, string> = {
  // tool labels (Sidebar TOOL_LABELS)
  "tool.select": "選択",
  "tool.arrow": "矢印",
  "tool.rect": "四角",
  "tool.text": "テキスト",
  "tool.mosaic": "モザイク",
  "tool.crop": "クロップ",

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

  // history actions (Sidebar)
  "action.undo.label": "戻る",
  "action.undo.title": "戻る (Cmd/Ctrl+Z)",
  "action.redo.label": "進む",
  "action.redo.title": "進む (Cmd/Ctrl+Shift+Z)",

  // ActionBar (export toolbar)
  "actionBar.label": "書き出し",
  "action.save.label": "保存",
  "action.save.title": "保存 (Cmd/Ctrl+Shift+S)",
  "action.copy.label": "コピー",
  "action.copy.copied": "コピーしました",
  "action.copy.title": "クリップボードへコピー (Cmd/Ctrl+Shift+C)",
  "action.copy.announcement": "クリップボードへコピーしました",

  // Update notice slot at the bottom of the Sidebar. Labels must stay short
  // enough for the 64px content width; the full sentence goes in the title /
  // aria-label instead.
  "update.notice.available.label": "v{version}",
  "update.notice.available.title": "v{version} が利用可能です。クリックすると更新して再起動します",
  "update.notice.downloading.label": "{percent}%",
  "update.notice.downloading.labelUnknown": "…",
  "update.notice.downloading.title": "更新をダウンロードしています…",
  "update.notice.installing.label": "再起動…",
  "update.notice.installing.title": "更新を適用しています。まもなくアプリが再起動します",
  "update.notice.relaunch.label": "再起動",
  "update.notice.relaunch.title":
    "更新はインストール済みです。クリックで再起動して完了します（注釈は失われます）",
  "update.notice.failed.label": "⚠ 失敗",
  "update.notice.failed.title": "更新に失敗しました。クリックで再試行します",

  // Transient StatusBar feedback for a manual check (Marianne → Check for
  // Updates...). An automatic check never reports anything.
  "update.upToDate.status": "最新版です",
  "update.upToDate.statusWithVersion": "最新版です (v{version})",
  "update.checkFailed.status": "更新の確認に失敗しました",

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
  // Shown only when shapes exist: installing an update relaunches the app,
  // which is equivalent to quitting, so it gets the same guard as Cmd+Q.
  "dialog.update.title": "更新すると注釈が失われます",
  "dialog.update.message": "更新するとアプリが再起動し、編集中の注釈は失われます。続行しますか?",
  "dialog.update.confirm": "更新して再起動",
  "dialog.cancel": "キャンセル",

  // Crop mode (CanvasArea overlay)
  "crop.confirm.label": "適用",
  "crop.confirm.title": "適用 (Enter)",
  "crop.cancel.label": "中止",
  "crop.cancel.title": "中止 (Esc)",

  // Error messages
  "error.imageLoadFailed": "画像の読み込みに失敗しました",
  "error.update.generic": "更新処理でエラーが発生しました",
  "error.update.infoLost": "更新情報が失われました。再度確認してください。",
};
