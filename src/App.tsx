import { useCallback, useState } from "react";
import { CanvasArea } from "./components/CanvasArea";
import { Toolbar } from "./components/Toolbar";
import { useImageLoader } from "./lib/useImageLoader";
import { useCanvasStore } from "./store/canvasStore";
import type { LoadedImage } from "./types/image";
import type { ColorPresetName, ToolKind } from "./types/tool";
import styles from "./App.module.css";

function App() {
  const [activeTool, setActiveTool] = useState<ToolKind>("arrow");
  const [activeColor, setActiveColor] = useState<ColorPresetName>("red");
  const [image, setImage] = useState<LoadedImage | null>(null);

  const shapes = useCanvasStore((s) => s.shapes);
  const addShape = useCanvasStore((s) => s.addShape);
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

  return (
    <div className={styles.appShell}>
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        activeColor={activeColor}
        onColorChange={setActiveColor}
        disabled={image === null}
      />
      <CanvasArea
        image={image}
        isDraggingOver={isDraggingOver}
        shapes={shapes}
        activeTool={activeTool}
        activeColor={activeColor}
        onShapeAdded={addShape}
      />
    </div>
  );
}

export default App;
