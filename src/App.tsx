import { useCallback, useState } from "react";
import { CanvasArea } from "./components/CanvasArea";
import { Toolbar } from "./components/Toolbar";
import {
  copyImageToClipboard,
  downloadBlob,
  exportToBlob,
  generateExportFilename,
} from "./lib/exportImage";
import { useImageLoader } from "./lib/useImageLoader";
import { useCanvasStore } from "./store/canvasStore";
import type { LoadedImage } from "./types/image";
import type { ColorPresetName, ToolKind } from "./types/tool";
import styles from "./App.module.css";

function App() {
  const [activeTool, setActiveTool] = useState<ToolKind>("select");
  const [activeColor, setActiveColor] = useState<ColorPresetName>("red");
  const [image, setImage] = useState<LoadedImage | null>(null);

  const shapes = useCanvasStore((s) => s.shapes);
  const selectedShapeId = useCanvasStore((s) => s.selectedShapeId);
  const addShape = useCanvasStore((s) => s.addShape);
  const selectShape = useCanvasStore((s) => s.selectShape);
  const deleteShape = useCanvasStore((s) => s.deleteShape);
  const updateRect = useCanvasStore((s) => s.updateRect);
  const updateText = useCanvasStore((s) => s.updateText);
  const updateArrow = useCanvasStore((s) => s.updateArrow);
  const updateMosaic = useCanvasStore((s) => s.updateMosaic);
  const clearShapes = useCanvasStore((s) => s.clearShapes);

  const handleImageLoaded = useCallback(
    (loaded: LoadedImage) => {
      // Clear annotations when a new image is loaded so they don't bleed onto the next image.
      clearShapes();
      setImage(loaded);
    },
    [clearShapes],
  );

  const handleImageError = useCallback((message: string) => {
    console.error(message);
  }, []);

  const { isDraggingOver } = useImageLoader({
    onImageLoaded: handleImageLoaded,
    onError: handleImageError,
  });

  const handleExportToFile = useCallback(async () => {
    if (!image) {
      return;
    }
    try {
      const blob = await exportToBlob(image, shapes);
      downloadBlob(blob, generateExportFilename());
    } catch (error) {
      console.error("Export to file failed:", error);
    }
  }, [image, shapes]);

  // Synchronous start: passing the Promise<Blob> directly to ClipboardItem preserves
  // the transient user activation that WebKit/WKWebView requires for clipboard.write.
  const handleExportToClipboard = useCallback(() => {
    if (!image) {
      return;
    }
    const blobPromise = exportToBlob(image, shapes);
    copyImageToClipboard(blobPromise).catch((error) => {
      console.error("Copy to clipboard failed:", error);
    });
  }, [image, shapes]);

  return (
    <div className={styles.appShell}>
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        activeColor={activeColor}
        onColorChange={setActiveColor}
        disabled={image === null}
        onExportToFile={handleExportToFile}
        onExportToClipboard={handleExportToClipboard}
      />
      <CanvasArea
        image={image}
        isDraggingOver={isDraggingOver}
        shapes={shapes}
        activeTool={activeTool}
        activeColor={activeColor}
        selectedShapeId={selectedShapeId}
        onShapeAdded={addShape}
        onSelectShape={selectShape}
        onDeleteShape={deleteShape}
        onUpdateRect={updateRect}
        onUpdateText={updateText}
        onUpdateArrow={updateArrow}
        onUpdateMosaic={updateMosaic}
      />
    </div>
  );
}

export default App;
