import { useCallback, useState } from "react";
import { dirname, join } from "@tauri-apps/api/path";
import { CanvasArea } from "./components/CanvasArea";
import { Toolbar } from "./components/Toolbar";
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
import { useCanvasStore } from "./store/canvasStore";
import type { LoadedImage } from "./types/image";
import type { Shape } from "./types/shape";
import type { ColorPresetName, ToolKind } from "./types/tool";
import styles from "./App.module.css";

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
  const handleExportToClipboard = useCallback(() => {
    if (!image || isEditingText) {
      return;
    }
    const blobPromise = exportToBlob(image, shapes);
    copyImageToClipboard(blobPromise).catch((error) => {
      console.error("Copy to clipboard failed:", error);
    });
  }, [image, isEditingText, shapes]);

  return (
    <div className={styles.appShell}>
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        activeColor={activeColor}
        onColorChange={handleColorChange}
        disabled={image === null}
        exportDisabled={isEditingText}
        onExportToFile={handleExportToFile}
        onExportToClipboard={handleExportToClipboard}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
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
        onEditingTextChange={setIsEditingText}
      />
    </div>
  );
}

export default App;
