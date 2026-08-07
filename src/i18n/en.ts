export const en = {
  // tool labels (Sidebar TOOL_LABELS)
  "tool.select": "Select",
  "tool.arrow": "Arrow",
  "tool.rect": "Rectangle",
  "tool.text": "Text",
  "tool.mosaic": "Mosaic",
  "tool.crop": "Crop",

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

  // history actions (Sidebar)
  "action.undo.label": "Undo",
  "action.undo.title": "Undo (Cmd/Ctrl+Z)",
  "action.redo.label": "Redo",
  "action.redo.title": "Redo (Cmd/Ctrl+Shift+Z)",

  // ActionBar (export toolbar)
  "actionBar.label": "Export",
  "action.save.label": "Save",
  "action.save.title": "Save (Cmd/Ctrl+Shift+S)",
  "action.copy.label": "Copy",
  "action.copy.copied": "Copied",
  "action.copy.title": "Copy to clipboard (Cmd/Ctrl+Shift+C)",
  "action.copy.announcement": "Image copied to clipboard",

  // Update notice slot at the bottom of the Sidebar. Labels must stay short
  // enough for the 64px content width; the full sentence goes in the title /
  // aria-label instead.
  "update.notice.available.label": "v{version}",
  "update.notice.available.title": "v{version} is available. Click to update and restart.",
  "update.notice.downloading.label": "{percent}%",
  "update.notice.downloading.labelUnknown": "…",
  "update.notice.downloading.title": "Downloading the update…",
  "update.notice.installing.label": "Restart…",
  "update.notice.installing.title": "Installing the update. The app will restart shortly.",
  "update.notice.relaunch.label": "Restart",
  "update.notice.relaunch.title":
    "The update is installed. Click to restart and finish — annotations will be lost.",
  "update.notice.failed.label": "⚠ Failed",
  "update.notice.failed.title": "The update failed. Click to retry.",

  // Transient StatusBar feedback for a manual check (Marianne → Check for
  // Updates...). An automatic check never reports anything.
  "update.upToDate.status": "You're up to date",
  "update.upToDate.statusWithVersion": "You're up to date (v{version})",
  "update.checkFailed.status": "Could not check for updates",

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
  // Shown only when shapes exist: installing an update relaunches the app,
  // which is equivalent to quitting, so it gets the same guard as Cmd+Q.
  "dialog.update.title": "Updating will discard your annotations",
  "dialog.update.message":
    "Updating will restart the app and the annotations being edited will be lost. Continue?",
  "dialog.update.confirm": "Update and restart",
  "dialog.cancel": "Cancel",

  // Crop mode (CanvasArea overlay)
  "crop.confirm.label": "Apply",
  "crop.confirm.title": "Apply (Enter)",
  "crop.cancel.label": "Cancel",
  "crop.cancel.title": "Cancel (Esc)",

  // Error messages
  "error.imageLoadFailed": "Failed to load image",
  "error.update.generic": "An error occurred during the update process",
  "error.update.infoLost": "Update information was lost. Please check again.",
} as const;

export type TranslationKey = keyof typeof en;
