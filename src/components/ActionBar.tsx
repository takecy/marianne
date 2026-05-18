import { t } from "@/i18n/translate";
import { CheckIcon } from "./icons/CheckIcon";
import { CopyIcon } from "./icons/CopyIcon";
import { RedoIcon } from "./icons/RedoIcon";
import { SaveIcon } from "./icons/SaveIcon";
import { UndoIcon } from "./icons/UndoIcon";
import styles from "./ActionBar.module.css";

export type CopyState = "idle" | "success";

interface ActionBarProps {
  disabled?: boolean;
  onExportToFile?: () => void;
  onExportToClipboard?: () => void;
  copyState?: CopyState;
  // Undo/Redo are intentionally independent of `disabled` — `disabled` here
  // also covers text-editing in progress, while the history controls should
  // remain clickable in that state (matching previous Sidebar behavior).
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export function ActionBar(props: ActionBarProps) {
  const {
    disabled = false,
    onExportToFile,
    onExportToClipboard,
    copyState = "idle",
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
  } = props;
  const isCopied = copyState === "success";
  const copyClassName = isCopied
    ? `${styles.exportButton} ${styles.exportButtonSuccess}`
    : styles.exportButton;

  return (
    <div className={styles.actionBar} role="toolbar" aria-label={t("actionBar.label")}>
      <div
        className={styles.historyGroup}
        role="group"
        aria-label={t("sidebar.historyGroup.label")}
      >
        <button
          type="button"
          className={styles.iconButton}
          disabled={!canUndo}
          onClick={onUndo}
          aria-label={t("action.undo.label")}
          title={t("action.undo.title")}
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          disabled={!canRedo}
          onClick={onRedo}
          aria-label={t("action.redo.label")}
          title={t("action.redo.title")}
        >
          <RedoIcon />
        </button>
      </div>
      <div className={styles.exportGroup}>
        <button
          type="button"
          className={styles.exportButton}
          disabled={disabled}
          onClick={onExportToFile}
          aria-label={t("action.save.label")}
          aria-keyshortcuts="Meta+Shift+S Control+Shift+S"
          title={t("action.save.title")}
        >
          <SaveIcon />
        </button>
        <button
          type="button"
          className={copyClassName}
          disabled={disabled}
          onClick={onExportToClipboard}
          aria-label={t("action.copy.label")}
          aria-keyshortcuts="Meta+Shift+C Control+Shift+C"
          title={isCopied ? t("action.copy.copied") : t("action.copy.title")}
        >
          {isCopied ? <CheckIcon /> : <CopyIcon />}
        </button>
        <span className={styles.copyAnnouncement} role="status" aria-live="polite">
          {isCopied ? t("action.copy.announcement") : ""}
        </span>
      </div>
    </div>
  );
}
