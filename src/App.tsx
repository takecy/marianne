import { useCallback, useState } from "react";
import { CanvasArea } from "./components/CanvasArea";
import { Toolbar } from "./components/Toolbar";
import { useImageLoader } from "./lib/useImageLoader";
import type { LoadedImage } from "./types/image";
import type { ColorPresetName, ToolKind } from "./types/tool";
import styles from "./App.module.css";

function App() {
  const [activeTool, setActiveTool] = useState<ToolKind>("arrow");
  const [activeColor, setActiveColor] = useState<ColorPresetName>("red");
  const [image, setImage] = useState<LoadedImage | null>(null);

  const handleImageLoaded = useCallback((loaded: LoadedImage) => {
    setImage(loaded);
  }, []);

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
      />
      <CanvasArea image={image} isDraggingOver={isDraggingOver} />
    </div>
  );
}

export default App;
