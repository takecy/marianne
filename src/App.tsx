import { useState } from "react";
import { CanvasArea } from "./components/CanvasArea";
import { Toolbar } from "./components/Toolbar";
import type { ColorPresetName, ToolKind } from "./types/tool";
import styles from "./App.module.css";

function App() {
  const [activeTool, setActiveTool] = useState<ToolKind>("arrow");
  const [activeColor, setActiveColor] = useState<ColorPresetName>("red");

  return (
    <div className={styles.appShell}>
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        activeColor={activeColor}
        onColorChange={setActiveColor}
      />
      <CanvasArea />
    </div>
  );
}

export default App;
