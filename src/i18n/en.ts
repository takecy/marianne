export const en = {
  // tool labels (Sidebar TOOL_LABELS)
  "tool.select": "Select",
  "tool.arrow": "Arrow",
  "tool.rect": "Rectangle",
  "tool.text": "Text",
  "tool.mosaic": "Mosaic",

  // stroke width labels (Sidebar STROKE_WIDTH_LABELS)
  "strokeWidth.thin": "Thin",
  "strokeWidth.medium": "Medium",
  "strokeWidth.thick": "Thick",
  "strokeWidth.extraThick": "Extra Thick",

  // sidebar group labels (aria-label)
  "sidebar.toolbar.label": "Toolbar",
  "sidebar.toolGroup.label": "Tools",
  "sidebar.colorGroup.label": "Colors",
  "sidebar.strokeWidthGroup.label": "Stroke width",
  "sidebar.historyGroup.label": "History",
  "sidebar.updateGroup.label": "Updates",
  "sidebar.infoGroup.label": "Information",

  // history + update actions (Sidebar)
  "action.undo.label": "Undo",
  "action.undo.title": "Undo (Cmd/Ctrl+Z)",
  "action.redo.label": "Redo",
  "action.redo.title": "Redo (Cmd/Ctrl+Shift+Z)",
  "action.checkUpdates.label": "Check for updates",
  "action.checkUpdates.idle": "Check for updates",
  "action.checkUpdates.checking": "Checking…",

  // ActionBar (export toolbar)
  "actionBar.label": "Export",
  "action.save.label": "Save",
  "action.save.title": "Save (Cmd/Ctrl+Shift+S)",
  "action.copy.label": "Copy",
  "action.copy.copied": "Copied",
  "action.copy.title": "Copy to clipboard (Cmd/Ctrl+Shift+C)",
  "action.copy.announcement": "Image copied to clipboard",

  // UpdateModal (dynamic interpolation for {version})
  "update.available.title": "A new version {version} is available",
  "update.releaseNotes.label": "What's new:",
  "update.warning.unsaved":
    "⚠ You have unsaved annotations. Updating will restart the app and your work will be lost. Please save first.",
  "update.notice.restart": "Applying the update will restart the app.",
  "update.action.later": "Later",
  "update.action.install": "Install now",
  "update.status.downloading": "Downloading…",
  "update.status.applying": "Installing update…",
  "update.readyToInstall.body": "The app will restart automatically after {version} is installed.",

  // Canvas (empty state + aria)
  "canvas.label": "Canvas",
  "canvas.empty.title": "Load an image",
  "canvas.empty.message":
    "Paste an image from the clipboard (⌘V / Ctrl+V) or drag & drop one here.",

  // StatusBar (SOURCE_LABELS + aria)
  "source.paste": "Pasted from clipboard",
  "source.drop": "Loaded via drag & drop",
  "source.file": "Opened from file",
  "statusBar.imageInfo.label": "Image info",

  // TextInputOverlay
  "textInput.label": "Text input",

  // App.tsx confirm dialogs + ConfirmDialog default
  "dialog.quit.title": "Unsaved annotations",
  "dialog.quit.message": "Annotations being edited will not be saved. Quit anyway?",
  "dialog.quit.confirm": "Quit",
  "dialog.imageReplace.title": "Annotations in progress",
  "dialog.imageReplace.message":
    "Loading a new image will discard the current annotations. Discard and load?",
  "dialog.imageReplace.confirm": "Discard and load",
  "dialog.cancel": "Cancel",

  // Error messages
  "error.imageLoadFailed": "Failed to load image",
  "error.update.generic": "An error occurred during the update process",
  "error.update.infoLost": "Update information was lost. Please check again.",

  // About dialog (Sidebar info button + AboutDialog content)
  "about.button.label": "About",
  "about.button.title": "About Marianne",
  "about.title": "About Marianne",
  "about.tagline": "Skitch-style offline image annotation",
  "about.tribute":
    "A tribute to Skitch (Plasq → Evernote). With Skitch unmaintained and Intel support fading from macOS, Marianne is a forward-looking replacement built in Skitch's spirit.",
  "about.nameOrigin":
    "Named after Marianne (Ms. Goldenweek), a painter character from ONE PIECE by Eiichiro Oda.",
  "about.license.prefix": "Licensed under",
  "about.license.suffix":
    " © 2026 takecy. Personal and noncommercial use is free; proprietary integration and resale are not.",
  "about.tributeLink": "Read the full tribute →",
  "about.disclaimer":
    'Not affiliated with or endorsed by Plasq, Evernote, Shueisha, or Eiichiro Oda. "Skitch" and "ONE PIECE" are trademarks of their respective owners.',
  "about.close": "Close",
} as const;

export type TranslationKey = keyof typeof en;
