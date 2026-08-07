import { t } from "@/i18n/translate";
import type { UpdateNotice } from "@/lib/updateNotice";
import type { ColorPresetName, StrokeWidthPresetName, ToolKind } from "@/types/tool";
import { COLOR_PRESETS, STROKE_WIDTH_PRESETS, TOOL_KINDS, TOOL_SHORTCUTS } from "@/types/tool";
import { ArrowIcon } from "./icons/ArrowIcon";
import { CropIcon } from "./icons/CropIcon";
import { MosaicIcon } from "./icons/MosaicIcon";
import { RectIcon } from "./icons/RectIcon";
import { SelectIcon } from "./icons/SelectIcon";
import { TextIcon } from "./icons/TextIcon";
import { UpdateIcon } from "./icons/UpdateIcon";
import styles from "./Sidebar.module.css";

const TOOL_LABELS: Record<ToolKind, string> = {
  select: t("tool.select"),
  arrow: t("tool.arrow"),
  rect: t("tool.rect"),
  text: t("tool.text"),
  mosaic: t("tool.mosaic"),
  crop: t("tool.crop"),
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
  crop: CropIcon,
};

// Short label under the bell. The sidebar content column is only 64px wide
// (see the width comment in Sidebar.module.css), so the full sentence lives
// in the button's title / aria-label instead.
function noticeLabel(notice: UpdateNotice): string {
  switch (notice.kind) {
    case "available":
      return t("update.notice.available.label", { version: notice.version });
    case "downloading":
      return notice.percent === null
        ? t("update.notice.downloading.labelUnknown")
        : t("update.notice.downloading.label", { percent: notice.percent });
    case "installing":
      return t("update.notice.installing.label");
    case "relaunch":
      return t("update.notice.relaunch.label");
    case "failed":
      return t("update.notice.failed.label");
  }
}

function noticeTitle(notice: UpdateNotice): string {
  switch (notice.kind) {
    case "available":
      return t("update.notice.available.title", { version: notice.version });
    case "downloading":
      return t("update.notice.downloading.title");
    case "installing":
      return t("update.notice.installing.title");
    case "relaunch":
      return t("update.notice.relaunch.title");
    case "failed":
      return t("update.notice.failed.title");
  }
}

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
  // The bottom-left update notice. `null` / omitted renders nothing at all:
  // the slot exists only when there is a new version (or an install to
  // retry), so its mere presence carries the message. Independent of
  // `disabled` — an update is actionable with or without an image loaded.
  updateNotice?: UpdateNotice | null;
  onUpdateNoticeClick?: () => void;
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
    updateNotice,
    onUpdateNoticeClick,
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

      {updateNotice && (
        <div
          className={styles.updateGroup}
          role="group"
          aria-label={t("sidebar.updateGroup.label")}
        >
          <button
            type="button"
            className={`${styles.iconButton} ${styles.updateNoticeButton}`}
            disabled={updateNotice.kind === "downloading" || updateNotice.kind === "installing"}
            onClick={onUpdateNoticeClick}
            aria-label={noticeTitle(updateNotice)}
            title={noticeTitle(updateNotice)}
          >
            <UpdateIcon />
          </button>
          {updateNotice.kind === "failed"
            ? (
              // Announced once, and the raw error text stays in the title so
              // the 64px column keeps a stable width no matter how long the
              // underlying message is.
              <span
                className={`${styles.updateNoticeText} ${styles.updateNoticeTextError}`}
                role="status"
                title={updateNotice.message}
              >
                {noticeLabel(updateNotice)}
              </span>
            )
            : (
              // Deliberately not a live region: announcing every percent tick
              // while downloading would be unusable. The button's aria-label
              // already names the state.
              <span className={styles.updateNoticeText} aria-hidden>
                {noticeLabel(updateNotice)}
              </span>
            )}
        </div>
      )}
    </aside>
  );
}
