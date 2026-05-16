import { useCallback, useEffect, useRef, useState } from "react";
import { dirname, join } from "@tauri-apps/api/path";
import { ActionBar } from "./components/ActionBar";
import { CanvasArea } from "./components/CanvasArea";
import { Sidebar, type UpdateButtonState } from "./components/Sidebar";
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
  saveLastSaveDirectory,
  saveLastSelectedColor,
} from "./lib/settingsStorage";
import { useImageLoader } from "./lib/useImageLoader";
import { useUpdater } from "./lib/useUpdater";
import { useCanvasStore } from "./store/canvasStore";
import type { LoadedImage } from "./types/image";
import type { Shape } from "./types/shape";
import type { ColorPresetName, ToolKind } from "./types/tool";
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
  const [image, setImage] = useState<LoadedImage | null>(null);
  // Driven by CanvasArea via onEditingTextChange. Used to disable export
  // buttons in the Toolbar while a text shape is being inline-edited so
  // the exported PNG does not capture a hidden text node.
  const [isEditingText, setIsEditingText] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "success">("idle");
  const copyResetTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current !== null) {
        window.clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

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

  const handleImageLoaded = useCallback(
    (loaded: LoadedImage) => {
      // Clear annotations when a new image is loaded so they don't bleed onto the next image.
      clearShapes();
      setImage(loaded);
    },
    [clearShapes],
  );

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
        disabled={image === null}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onCheckForUpdates={() => void checkForUpdates()}
        updateButtonState={deriveUpdateButtonState(updateState.kind)}
        updateErrorMessage={updateState.kind === "error" ? updateState.message : undefined}
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
      </div>
      <UpdateModal
        state={updateState}
        hasUnsavedShapes={shapes.length > 0}
        onInstall={() => void installUpdate()}
        onDismiss={dismissUpdate}
      />
    </div>
  );
}

export default App;
