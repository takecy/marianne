import type { ColorPresetName, ToolKind } from "@/types/tool";
import { COLOR_PRESETS, TOOL_KINDS, TOOL_SHORTCUTS } from "@/types/tool";
import { ArrowIcon } from "./icons/ArrowIcon";
import { MosaicIcon } from "./icons/MosaicIcon";
import { RectIcon } from "./icons/RectIcon";
import { RedoIcon } from "./icons/RedoIcon";
import { SelectIcon } from "./icons/SelectIcon";
import { TextIcon } from "./icons/TextIcon";
import { UndoIcon } from "./icons/UndoIcon";
import { UpdateIcon } from "./icons/UpdateIcon";
import styles from "./Sidebar.module.css";

const TOOL_LABELS: Record<ToolKind, string> = {
  select: "選択",
  arrow: "矢印",
  rect: "四角",
  text: "テキスト",
  mosaic: "モザイク",
};

const TOOL_ICONS: Record<ToolKind, () => React.ReactElement> = {
  select: SelectIcon,
  arrow: ArrowIcon,
  rect: RectIcon,
  text: TextIcon,
  mosaic: MosaicIcon,
};

// State exposed by the updater hook in `useUpdater`. Used only to set the
// visual indicator on the update button — the modal itself owns the full
// UpdateState.
export type UpdateButtonState = "idle" | "checking" | "available";

interface SidebarProps {
  activeTool: ToolKind;
  onToolChange: (next: ToolKind) => void;
  activeColor: ColorPresetName;
  onColorChange: (next: ColorPresetName) => void;
  disabled?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  // Updater button is independent of `disabled` so the user can check for
  // updates even before loading an image. `checking` disables it briefly.
  onCheckForUpdates?: () => void;
  updateButtonState?: UpdateButtonState;
  // Last update-check failure message. Shown inline below the update
  // button (not as a blocking modal) so the user can keep working. Clicking
  // the button retries the check and clears the message.
  updateErrorMessage?: string;
}

export function Sidebar(props: SidebarProps) {
  const {
    activeTool,
    onToolChange,
    activeColor,
    onColorChange,
    disabled = false,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    onCheckForUpdates,
    updateButtonState = "idle",
    updateErrorMessage,
  } = props;

  return (
    <aside className={styles.sidebar} aria-label="ツールバー">
      <div className={styles.toolGroup} role="group" aria-label="ツール">
        {TOOL_KINDS.map((tool) => {
          const Icon = TOOL_ICONS[tool];
          const label = TOOL_LABELS[tool];
          const shortcut = TOOL_SHORTCUTS[tool];
          return (
            <button
              key={tool}
              type="button"
              className={tool === activeTool
                ? `${styles.toolButton} ${styles.toolButtonActive}`
                : styles.toolButton}
              aria-pressed={tool === activeTool}
              aria-keyshortcuts={shortcut}
              aria-label={label}
              title={`${label} (${shortcut.toUpperCase()})`}
              disabled={disabled}
              onClick={() => onToolChange(tool)}
            >
              <Icon />
            </button>
          );
        })}
      </div>

      <div className={styles.divider} aria-hidden />

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

      <div className={styles.divider} aria-hidden />

      <div className={styles.historyGroup} role="group" aria-label="履歴">
        <button
          type="button"
          className={styles.iconButton}
          disabled={disabled || !canUndo}
          onClick={onUndo}
          aria-label="戻る"
          title="戻る (Cmd/Ctrl+Z)"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          disabled={disabled || !canRedo}
          onClick={onRedo}
          aria-label="進む"
          title="進む (Cmd/Ctrl+Shift+Z)"
        >
          <RedoIcon />
        </button>
      </div>

      {onCheckForUpdates && (
        <div className={styles.updateGroup} role="group" aria-label="更新">
          <button
            type="button"
            className={updateButtonState === "available"
              ? `${styles.iconButton} ${styles.updateButtonAvailable}`
              : styles.iconButton}
            disabled={updateButtonState === "checking"}
            onClick={onCheckForUpdates}
            aria-label="更新を確認"
            title={updateButtonState === "checking" ? "確認中…" : "更新を確認"}
          >
            <UpdateIcon />
            {updateButtonState === "available" && (
              <span className={styles.updateBadge} aria-hidden>●</span>
            )}
          </button>
          {updateErrorMessage && (
            <span
              className={styles.updateError}
              role="status"
              aria-live="polite"
              title={updateErrorMessage}
            >
              ⚠ Failed
            </span>
          )}
        </div>
      )}
    </aside>
  );
}
