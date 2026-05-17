import { t } from "@/i18n/translate";
import type { ColorPresetName, StrokeWidthPresetName, ToolKind } from "@/types/tool";
import { COLOR_PRESETS, STROKE_WIDTH_PRESETS, TOOL_KINDS, TOOL_SHORTCUTS } from "@/types/tool";
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
  select: t("tool.select"),
  arrow: t("tool.arrow"),
  rect: t("tool.rect"),
  text: t("tool.text"),
  mosaic: t("tool.mosaic"),
};

const STROKE_WIDTH_LABELS: Record<StrokeWidthPresetName, string> = {
  thin: t("strokeWidth.thin"),
  medium: t("strokeWidth.medium"),
  thick: t("strokeWidth.thick"),
  extraThick: t("strokeWidth.extraThick"),
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
  // Stroke width preset applied to new rect draws AND to the currently
  // selected rect (the store-side handler is rect-only — text/arrow/mosaic
  // selections are silent no-ops, matching the Issue #1 "矩形用" requirement).
  activeStrokeWidth: StrokeWidthPresetName;
  onStrokeWidthChange: (next: StrokeWidthPresetName) => void;
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
    activeStrokeWidth,
    onStrokeWidthChange,
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
    <aside className={styles.sidebar} aria-label={t("sidebar.toolbar.label")}>
      <div className={styles.toolGroup} role="group" aria-label={t("sidebar.toolGroup.label")}>
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

      <div className={styles.colorGroup} role="group" aria-label={t("sidebar.colorGroup.label")}>
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

      <div
        className={styles.strokeWidthGroup}
        role="group"
        aria-label={t("sidebar.strokeWidthGroup.label")}
      >
        {STROKE_WIDTH_PRESETS.map((preset) => {
          const label = STROKE_WIDTH_LABELS[preset.name];
          const isActive = preset.name === activeStrokeWidth;
          return (
            <button
              key={preset.name}
              type="button"
              className={isActive
                ? `${styles.strokeWidthButton} ${styles.strokeWidthButtonActive}`
                : styles.strokeWidthButton}
              aria-pressed={isActive}
              aria-label={label}
              title={label}
              disabled={disabled}
              onClick={() => onStrokeWidthChange(preset.name)}
            >
              <span
                className={styles.strokeWidthBar}
                style={{ height: `${preset.value / 2.5}px` }}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div className={styles.divider} aria-hidden />

      <div
        className={styles.historyGroup}
        role="group"
        aria-label={t("sidebar.historyGroup.label")}
      >
        <button
          type="button"
          className={styles.iconButton}
          disabled={disabled || !canUndo}
          onClick={onUndo}
          aria-label={t("action.undo.label")}
          title={t("action.undo.title")}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          disabled={disabled || !canRedo}
          onClick={onRedo}
          aria-label={t("action.redo.label")}
          title={t("action.redo.title")}
        >
          <RedoIcon />
        </button>
      </div>

      {onCheckForUpdates && (
        <div
          className={styles.updateGroup}
          role="group"
          aria-label={t("sidebar.updateGroup.label")}
        >
          <button
            type="button"
            className={updateButtonState === "available"
              ? `${styles.iconButton} ${styles.updateButtonAvailable}`
              : styles.iconButton}
            disabled={updateButtonState === "checking"}
            onClick={onCheckForUpdates}
            aria-label={t("action.checkUpdates.label")}
            title={updateButtonState === "checking"
              ? t("action.checkUpdates.checking")
              : t("action.checkUpdates.idle")}
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
