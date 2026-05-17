import { useCallback, useEffect, useRef, useState } from "react";
import { dirname, join } from "@tauri-apps/api/path";
import { t } from "./i18n/translate";
import { AboutDialog } from "./components/AboutDialog";
import { ActionBar } from "./components/ActionBar";
import { CanvasArea } from "./components/CanvasArea";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { Sidebar, type UpdateButtonState } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { UpdateModal } from "./components/UpdateModal";
import {
  copyImageToClipboard,
  defaultExportFileName,
  exportToBlob,
  saveBlobToFile,
} from "./lib/exportImage";
import {
  loadLastSaveDirectory,
  loadLastSelectedColor,
  loadLastSelectedStrokeWidth,
  saveLastSaveDirectory,
  saveLastSelectedColor,
  saveLastSelectedStrokeWidth,
} from "./lib/settingsStorage";
import { useImageLoader } from "./lib/useImageLoader";
import { useQuitConfirm } from "./lib/useQuitConfirm";
import { useUpdater } from "./lib/useUpdater";
import { applyWindowSizeForImage } from "./lib/windowResize";
import { useCanvasStore } from "./store/canvasStore";
import type { LoadedImage } from "./types/image";
import type { Shape } from "./types/shape";
import type { ColorPresetName, StrokeWidthPresetName, ToolKind } from "./types/tool";
import styles from "./App.module.css";

const COPY_FEEDBACK_DURATION_MS = 2000;

function deriveUpdateButtonState(
  kind: ReturnType<typeof useUpdater>["state"]["kind"],
): UpdateButtonState {
  if (kind === "checking") {
    return "checking";
  }
  if (kind === "available" || kind === "downloading" || kind === "readyToInstall") {
    return "available";
  }
  return "idle";
}

function App() {
  const [activeTool, setActiveTool] = useState<ToolKind>("select");
  const [activeColor, setActiveColor] = useState<ColorPresetName>(
    () => loadLastSelectedColor() ?? "red",
  );
  const [activeStrokeWidth, setActiveStrokeWidth] = useState<StrokeWidthPresetName>(
    () => loadLastSelectedStrokeWidth() ?? "thick",
  );
  const [image, setImage] = useState<LoadedImage | null>(null);
  // Holds a newly-pasted/dropped image while the user confirms whether
  // to discard the current annotations. Mirrored into pendingImageRef so
  // handleImageLoaded can read it without becoming dependent on the state
  // (which would cause useImageLoader's listener to teardown on every
  // toggle).
  const [pendingImage, setPendingImage] = useState<LoadedImage | null>(null);
  const pendingImageRef = useRef<LoadedImage | null>(null);
  useEffect(() => {
    pendingImageRef.current = pendingImage;
  }, [pendingImage]);
  // Driven by CanvasArea via onEditingTextChange. Used to disable export
  // buttons in the Toolbar while a text shape is being inline-edited so
  // the exported PNG does not capture a hidden text node.
  const [isEditingText, setIsEditingText] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "success">("idle");
  const copyResetTimer = useRef<number | null>(null);

  // About dialog state. The version is fetched once at mount via Tauri's
  // getVersion(); failure (e.g. running outside Tauri in tests) leaves it
  // as an empty string and the dialog simply omits the "v…" label.
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        const v = await getVersion();
        if (!cancelled) setAppVersion(v);
      } catch {
        // Non-Tauri environment (tests, web preview) — silently leave empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  // Auto-resize the window to fit the loaded image 1:1 inside the canvas.
  // Depending on `image` (object identity) — not just dimensions — ensures the
  // window snaps back and re-centers even when the user reloads the same-sized
  // image after manually resizing the window.
  useEffect(() => {
    if (!image) return;
    void applyWindowSizeForImage(image.naturalWidth, image.naturalHeight);
  }, [image]);

  const shapes = useCanvasStore((s) => s.shapes);
  const selectedShapeId = useCanvasStore((s) => s.selectedShapeId);
  const addShape = useCanvasStore((s) => s.addShape);
  const selectShape = useCanvasStore((s) => s.selectShape);
  const deleteShape = useCanvasStore((s) => s.deleteShape);
  const updateRect = useCanvasStore((s) => s.updateRect);
  const updateText = useCanvasStore((s) => s.updateText);
  const updateArrow = useCanvasStore((s) => s.updateArrow);
  const updateMosaic = useCanvasStore((s) => s.updateMosaic);
  const setSelectedShapeColor = useCanvasStore((s) => s.setSelectedShapeColor);
  const setSelectedShapeStrokeWidth = useCanvasStore(
    (s) => s.setSelectedShapeStrokeWidth,
  );
  const clearShapes = useCanvasStore((s) => s.clearShapes);
  const copyShape = useCanvasStore((s) => s.copyShape);
  const pasteShape = useCanvasStore((s) => s.pasteShape);
  const hasClipboardShape = useCanvasStore((s) => s.clipboardShape !== null);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);

  // When a shape is selected, repaint it with the chosen color before updating
  // the active color used for new shapes. The store call is a no-op for mosaic,
  // when no shape is selected, or when the color is unchanged.
  const handleColorChange = useCallback((name: ColorPresetName) => {
    setSelectedShapeColor(name);
    setActiveColor(name);
    saveLastSelectedColor(name);
  }, [setSelectedShapeColor]);

  // Symmetric to handleColorChange: try to repaint the selected shape first,
  // then update the active preset used for new rects, then persist. The store
  // call is a silent no-op when the selection is not a rect (text/arrow/mosaic)
  // or when the value is unchanged — see canvasStore.setSelectedShapeStrokeWidth.
  const handleStrokeWidthChange = useCallback((name: StrokeWidthPresetName) => {
    setSelectedShapeStrokeWidth(name);
    setActiveStrokeWidth(name);
    saveLastSelectedStrokeWidth(name);
  }, [setSelectedShapeStrokeWidth]);

  const handleImageLoaded = useCallback(
    (loaded: LoadedImage) => {
      // Ignore additional paste/drop while a confirm dialog is already
      // pending — prevents a decode-order race where two rapid paste
      // events could otherwise resolve out-of-order via img.onload.
      if (pendingImageRef.current !== null) {
        return;
      }
      // Read shapes from the store directly so we don't have to depend on
      // the latest `shapes` snapshot — keeping useImageLoader's listener
      // stable across every annotation edit.
      const hasShapes = useCanvasStore.getState().shapes.length > 0;
      if (hasShapes) {
        setPendingImage(loaded);
        return;
      }
      // Clear annotations when a new image is loaded so they don't bleed onto the next image.
      clearShapes();
      setImage(loaded);
    },
    [clearShapes],
  );

  const handleConfirmReplaceImage = useCallback(() => {
    const next = pendingImageRef.current;
    if (next === null) return;
    clearShapes();
    setImage(next);
    setPendingImage(null);
  }, [clearShapes]);

  const handleCancelReplaceImage = useCallback(() => {
    setPendingImage(null);
  }, []);

  // After a shape is placed, return to the select tool so the user can
  // immediately adjust position/size without an extra toolbar click.
  // Text cancellation does NOT trigger this — it routes through onCancel
  // in TextInputOverlay and never calls onShapeAdded.
  const handleShapeAdded = useCallback(
    (shape: Shape) => {
      addShape(shape);
      setActiveTool("select");
    },
    [addShape],
  );

  // After paste, return to the select tool so the user can immediately
  // drag the freshly pasted shape — mirroring handleShapeAdded.
  const handleAfterPaste = useCallback(() => {
    setActiveTool("select");
  }, []);

  const handleImageError = useCallback((message: string) => {
    console.error(message);
  }, []);

  const { isDraggingOver } = useImageLoader({
    onImageLoaded: handleImageLoaded,
    onError: handleImageError,
  });

  // Updater runs in parallel with the image loader. Both subscribe their own
  // listeners and never overlap. Auto-check on mount keeps the UI quiet
  // unless the modal is needed.
  const {
    state: updateState,
    checkForUpdates,
    downloadAndInstall: installUpdate,
    dismiss: dismissUpdate,
  } = useUpdater({ autoCheckOnMount: true });

  // Cmd+Q / tray "Quit Marianne" / Dock Quit confirmation. The hook
  // listens for `quit-requested` from the Rust side and shows the dialog
  // only when there are unsaved shapes; otherwise it confirms quit
  // immediately so the user does not see a needless dialog flash.
  const {
    state: quitState,
    confirmQuit,
    cancelQuit,
  } = useQuitConfirm({ hasUnsavedShapes: shapes.length > 0 });

  const handleExportToFile = useCallback(async () => {
    if (!image || isEditingText) {
      return;
    }
    try {
      const blob = await exportToBlob(image, shapes);
      const defaultName = defaultExportFileName(image);
      const sourceDir = image.sourcePath !== undefined
        ? await dirname(image.sourcePath)
        : undefined;
      const defaultDir = sourceDir ?? loadLastSaveDirectory();
      const defaultPath = defaultDir ? await join(defaultDir, defaultName) : defaultName;
      const savedPath = await saveBlobToFile(blob, defaultPath);
      if (savedPath) {
        saveLastSaveDirectory(await dirname(savedPath));
      }
    } catch (error) {
      console.error("Export to file failed:", error);
    }
  }, [image, isEditingText, shapes]);

  // Synchronous start: passing the Promise<Blob> directly to ClipboardItem preserves
  // the transient user activation that WebKit/WKWebView requires for clipboard.write.
  // `.then()` after the synchronous write call is safe — the user gesture has already
  // been consumed by the time the promise resolves.
  const handleExportToClipboard = useCallback(() => {
    if (!image || isEditingText) {
      return;
    }
    const blobPromise = exportToBlob(image, shapes);
    copyImageToClipboard(blobPromise)
      .then(() => {
        setCopyState("success");
        if (copyResetTimer.current !== null) {
          window.clearTimeout(copyResetTimer.current);
        }
        copyResetTimer.current = window.setTimeout(() => {
          setCopyState("idle");
          copyResetTimer.current = null;
        }, COPY_FEEDBACK_DURATION_MS);
      })
      .catch((error) => {
        console.error("Copy to clipboard failed:", error);
      });
  }, [image, isEditingText, shapes]);

  return (
    <div className={styles.appShell}>
      <Sidebar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        activeColor={activeColor}
        onColorChange={handleColorChange}
        activeStrokeWidth={activeStrokeWidth}
        onStrokeWidthChange={handleStrokeWidthChange}
        disabled={image === null}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onCheckForUpdates={() => void checkForUpdates()}
        updateButtonState={deriveUpdateButtonState(updateState.kind)}
        updateErrorMessage={updateState.kind === "error" ? updateState.message : undefined}
        onShowAbout={() => setAboutDialogOpen(true)}
      />
      <div className={styles.mainColumn}>
        <ActionBar
          disabled={image === null || isEditingText}
          onExportToFile={handleExportToFile}
          onExportToClipboard={handleExportToClipboard}
          copyState={copyState}
        />
        <CanvasArea
          image={image}
          isDraggingOver={isDraggingOver}
          shapes={shapes}
          activeTool={activeTool}
          activeColor={activeColor}
          activeStrokeWidth={activeStrokeWidth}
          selectedShapeId={selectedShapeId}
          hasClipboardShape={hasClipboardShape}
          onToolChange={setActiveTool}
          onShapeAdded={handleShapeAdded}
          onSelectShape={selectShape}
          onDeleteShape={deleteShape}
          onUpdateRect={updateRect}
          onUpdateText={updateText}
          onUpdateArrow={updateArrow}
          onUpdateMosaic={updateMosaic}
          onCopyShape={copyShape}
          onPasteShape={pasteShape}
          onAfterPaste={handleAfterPaste}
          onUndo={undo}
          onRedo={redo}
          onExportToFile={handleExportToFile}
          onExportToClipboard={handleExportToClipboard}
          onEditingTextChange={setIsEditingText}
        />
        <StatusBar image={image} />
      </div>
      <UpdateModal
        state={updateState}
        hasUnsavedShapes={shapes.length > 0}
        onInstall={() => void installUpdate()}
        onDismiss={dismissUpdate}
      />
      <ConfirmDialog
        open={quitState.kind === "confirming"}
        title={t("dialog.quit.title")}
        message={t("dialog.quit.message")}
        confirmLabel={t("dialog.quit.confirm")}
        destructive
        onConfirm={() => void confirmQuit()}
        onCancel={cancelQuit}
      />
      <ConfirmDialog
        open={pendingImage !== null}
        title={t("dialog.imageReplace.title")}
        message={t("dialog.imageReplace.message")}
        confirmLabel={t("dialog.imageReplace.confirm")}
        destructive
        onConfirm={handleConfirmReplaceImage}
        onCancel={handleCancelReplaceImage}
      />
      <AboutDialog
        open={aboutDialogOpen}
        version={appVersion}
        onClose={() => setAboutDialogOpen(false)}
      />
    </div>
  );
}

export default App;
