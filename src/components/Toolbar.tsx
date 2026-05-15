import type { ColorPresetName, ToolKind } from "@/types/tool";
import { COLOR_PRESETS, TOOL_KINDS } from "@/types/tool";
import styles from "./Toolbar.module.css";

const TOOL_LABELS: Record<ToolKind, string> = {
  arrow: "矢印",
  rect: "四角",
  text: "テキスト",
  mosaic: "モザイク",
};

interface ToolbarProps {
  activeTool: ToolKind;
  onToolChange: (next: ToolKind) => void;
  activeColor: ColorPresetName;
  onColorChange: (next: ColorPresetName) => void;
}

export function Toolbar(props: ToolbarProps) {
  const { activeTool, onToolChange, activeColor, onColorChange } = props;

  return (
    <header className={styles.toolbar} aria-label="ツールバー">
      <div className={styles.toolGroup} role="group" aria-label="ツール">
        {TOOL_KINDS.map((tool) => (
          <button
            key={tool}
            type="button"
            className={tool === activeTool
              ? `${styles.toolButton} ${styles.toolButtonActive}`
              : styles.toolButton}
            aria-pressed={tool === activeTool}
            onClick={() => onToolChange(tool)}
          >
            {TOOL_LABELS[tool]}
          </button>
        ))}
      </div>
      <div className={styles.colorGroup} role="group" aria-label="色">
        {COLOR_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className={preset.name === activeColor
              ? `${styles.colorSwatch} ${styles.colorSwatchActive}`
              : styles.colorSwatch}
            aria-pressed={preset.name === activeColor}
            aria-label={preset.name}
            style={{ backgroundColor: preset.hex }}
            onClick={() => onColorChange(preset.name)}
          />
        ))}
      </div>
    </header>
  );
}
