import { useCallback, useEffect, useRef, useState } from "react";
import { dirname, join } from "@tauri-apps/api/path";
import { t } from "./i18n/translate";
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
import { useMenuAction } from "./lib/useMenuAction";
import { useQuitConfirm } from "./lib/useQuitConfirm";
import { useUpdater } from "./lib/useUpdater";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { applyWindowSizeForImage } from "./lib/windowResize";
import { cropLoadedImage, type CropRect, transformShapesForCrop } from "./lib/cropImage";
import { DEFAULT_ZOOM_STATE, type ZoomState } from "./lib/zoomGesture";
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
  // View-only canvas zoom (pinch + Cmd+/-/0). Local state, not part of the
  // shape history — undo/redo must not touch zoom. Reset to DEFAULT whenever
  // the underlying HTMLImageElement instance changes (paste / drop / Open
  // With / replace-confirm / crop), so a fresh image always starts at 100%.
  // Uses render-time prev/curr comparison (React docs: "Adjusting state based
  // on prior state") instead of useEffect+setState — same pattern as the
  // tool/image cleanup in CanvasArea.tsx — to avoid the cascading-render
  // warning from react-hooks/set-state-in-effect.
  const [zoomState, setZoomState] = useState<ZoomState>(DEFAULT_ZOOM_STATE);
  const prevImageElForZoomRef = useRef(image?.element);
  if (prevImageElForZoomRef.current !== image?.element) {
    prevImageElForZoomRef.current = image?.element;
    setZoomState(DEFAULT_ZOOM_STATE);
  }

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
  const addShapes = useCanvasStore((s) => s.addShapes);
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
  const resetShapes = useCanvasStore((s) => s.resetShapes);
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

  // Batch variant for mosaic stacking — one drag may emit a base shape plus
  // per-overlap strength overlays, added as one history transaction.
  const handleShapesAdded = useCallback(
    (shapes: Shape[]) => {
      addShapes(shapes);
      setActiveTool("select");
    },
    [addShapes],
  );

  // After paste, return to the select tool so the user can immediately
  // drag the freshly pasted shape — mirroring handleShapeAdded.
  const handleAfterPaste = useCallback(() => {
    setActiveTool("select");
  }, []);

  const handleImageError = useCallback((message: string) => {
    console.error(message);
  }, []);

  // Apply a confirmed crop selection. The crop pipeline replaces the image
  // element with a freshly decoded cropped copy, translates all existing
  // shapes into the new image's natural pixel space (line clipping for
  // arrows, see transformShapesForCrop), and resets the undo/redo history
  // since the previous image's history cannot be replayed against the new
  // image. setActiveTool returns the user to the select tool so they can
  // start adjusting the cropped result immediately.
  const handleCropImage = useCallback(
    async (rect: CropRect) => {
      if (!image) return;
      try {
        const newImage = await cropLoadedImage(image, rect);
        const newShapes = transformShapesForCrop(
          useCanvasStore.getState().shapes,
          rect,
        );
        resetShapes(newShapes);
        setImage(newImage);
        setActiveTool("select");
      } catch (error) {
        console.error("Crop failed:", error);
      }
    },
    [image, resetShapes],
  );

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

  // Drives the `File → Open... (Cmd+O)` menu item. Rust's
  // `pick_and_open_image` command opens the native dialog, validates the
  // chosen path through `safe_image_canonical`, and emits
  // `file-open-requested` for `useImageLoader` to pick up — so the
  // frontend never touches the path string directly.
  //
  // JS `@tauri-apps/plugin-dialog#open` is intentionally not used: it
  // auto-grants fs scope before our Rust validation runs.
  const handleOpenViaDialog = useCallback(async () => {
    if (!isTauri()) return;
    try {
      await invoke("pick_and_open_image");
    } catch (error) {
      console.error("pick_and_open_image failed:", error);
    }
  }, []);

  // Shared de-dupe layer for menu accelerator ↔ JS keydown ↔ toolbar
  // button triple-firing. macOS may or may not suppress keydown when the
  // menu accelerator is consumed; rather than rely on undocumented OS
  // behaviour, we gate undo / redo / copy through a single ref-backed
  // throttle so the second firing within 100ms of the same id is a no-op.
  //
  // For `copy-clipboard` the de-dupe is *source-aware*: the menu route is
  // best-effort (transient user activation may be lost through the
  // emit/listen round-trip) so it does not raise the flag — a subsequent
  // keydown / toolbar firing must still be allowed to rescue the clipboard
  // write. Trusted routes (keydown / toolbar) raise the flag normally so a
  // subsequent menu firing is suppressed.
  const lastFiredRef = useRef<{ id: string; ts: number } | null>(null);
  const shouldSuppress = useCallback(
    (id: string, opts?: { record?: boolean }): boolean => {
      const now = performance.now();
      const last = lastFiredRef.current;
      if (last && last.id === id && now - last.ts < 100) return true;
      if (opts?.record !== false) {
        lastFiredRef.current = { id, ts: now };
      }
      return false;
    },
    [],
  );
  const guardedUndo = useCallback(() => {
    if (!shouldSuppress("undo")) undo();
  }, [undo, shouldSuppress]);
  const guardedRedo = useCallback(() => {
    if (!shouldSuppress("redo")) redo();
  }, [redo, shouldSuppress]);
  const guardedCopyToClipboard = useCallback(
    (source: "menu" | "keydown" | "toolbar") => {
      const record = source !== "menu";
      if (shouldSuppress("copy-clipboard", { record })) return;
      // Must remain synchronous inside the user-gesture handler so the
      // Promise<Blob> handoff into ClipboardItem keeps the WebKit
      // transient user activation alive.
      handleExportToClipboard();
    },
    [handleExportToClipboard, shouldSuppress],
  );
  const handleMenuCopy = useCallback(
    () => guardedCopyToClipboard("menu"),
    [guardedCopyToClipboard],
  );
  const handleToolbarCopy = useCallback(
    () => guardedCopyToClipboard("toolbar"),
    [guardedCopyToClipboard],
  );
  const handleKeydownCopy = useCallback(
    () => guardedCopyToClipboard("keydown"),
    [guardedCopyToClipboard],
  );
  const handleMenuDelete = useCallback(() => {
    if (selectedShapeId !== null) {
      deleteShape(selectedShapeId);
    }
  }, [deleteShape, selectedShapeId]);

  useMenuAction({
    onOpen: () => void handleOpenViaDialog(),
    onSaveAs: () => void handleExportToFile(),
    onCopyToClipboard: handleMenuCopy,
    onUndo: guardedUndo,
    onRedo: guardedRedo,
    onDelete: handleMenuDelete,
  });

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
        onCheckForUpdates={() => void checkForUpdates()}
        updateButtonState={deriveUpdateButtonState(updateState.kind)}
        updateErrorMessage={updateState.kind === "error" ? updateState.message : undefined}
      />
      <div className={styles.mainColumn}>
        <ActionBar
          disabled={image === null || isEditingText}
          onExportToFile={handleExportToFile}
          onExportToClipboard={handleToolbarCopy}
          copyState={copyState}
          onUndo={guardedUndo}
          onRedo={guardedRedo}
          canUndo={canUndo}
          canRedo={canRedo}
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
          onShapesAdded={handleShapesAdded}
          onSelectShape={selectShape}
          onDeleteShape={deleteShape}
          onCropImage={(rect) => void handleCropImage(rect)}
          onUpdateRect={updateRect}
          onUpdateText={updateText}
          onUpdateArrow={updateArrow}
          onUpdateMosaic={updateMosaic}
          onCopyShape={copyShape}
          onPasteShape={pasteShape}
          onAfterPaste={handleAfterPaste}
          onUndo={guardedUndo}
          onRedo={guardedRedo}
          onExportToFile={handleExportToFile}
          onExportToClipboard={handleKeydownCopy}
          onEditingTextChange={setIsEditingText}
          zoomState={zoomState}
          onZoomChange={setZoomState}
        />
        <StatusBar image={image} zoom={zoomState.scale} />
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
    </div>
  );
}

export default App;
