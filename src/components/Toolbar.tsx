import type { ColorPresetName, ToolKind } from "@/types/tool";
import { COLOR_PRESETS, TOOL_KINDS, TOOL_SHORTCUTS } from "@/types/tool";
import styles from "./Toolbar.module.css";

const TOOL_LABELS: Record<ToolKind, string> = {
  select: "選択",
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
  disabled?: boolean;
  // Extra disable signal for export-only buttons (save / copy). Used while
  // a text shape is being edited inline so users cannot export a stage
  // that has the live text hidden behind a textarea overlay.
  exportDisabled?: boolean;
  onExportToFile?: () => void;
  onExportToClipboard?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function Toolbar(props: ToolbarProps) {
  const {
    activeTool,
    onToolChange,
    activeColor,
    onColorChange,
    disabled = false,
    exportDisabled = false,
    onExportToFile,
    onExportToClipboard,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
  } = props;

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
            aria-keyshortcuts={TOOL_SHORTCUTS[tool]}
            disabled={disabled}
            onClick={() => onToolChange(tool)}
          >
            {TOOL_LABELS[tool]} ({TOOL_SHORTCUTS[tool]})
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
            disabled={disabled}
            onClick={() => onColorChange(preset.name)}
          />
        ))}
      </div>
      <div className={styles.historyGroup} role="group" aria-label="履歴">
        <button
          type="button"
          className={styles.historyButton}
          disabled={disabled || !canUndo}
          onClick={onUndo}
          aria-label="戻る"
        >
          戻る
        </button>
        <button
          type="button"
          className={styles.historyButton}
          disabled={disabled || !canRedo}
          onClick={onRedo}
          aria-label="進む"
        >
          進む
        </button>
      </div>
      <div className={styles.spacer} aria-hidden />
      <div className={styles.exportGroup} role="group" aria-label="書き出し">
        <button
          type="button"
          className={styles.exportButton}
          disabled={disabled || exportDisabled}
          onClick={onExportToFile}
        >
          保存
        </button>
        <button
          type="button"
          className={styles.exportButton}
          disabled={disabled || exportDisabled}
          onClick={onExportToClipboard}
        >
          コピー
        </button>
      </div>
    </header>
  );
}
