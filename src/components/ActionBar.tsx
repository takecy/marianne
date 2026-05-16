import { CheckIcon } from "./icons/CheckIcon";
import { CopyIcon } from "./icons/CopyIcon";
import { SaveIcon } from "./icons/SaveIcon";
import styles from "./ActionBar.module.css";

export type CopyState = "idle" | "success";

interface ActionBarProps {
  disabled?: boolean;
  onExportToFile?: () => void;
  onExportToClipboard?: () => void;
  copyState?: CopyState;
}

export function ActionBar(props: ActionBarProps) {
  const {
    disabled = false,
    onExportToFile,
    onExportToClipboard,
    copyState = "idle",
  } = props;
  const isCopied = copyState === "success";
  const copyClassName = isCopied
    ? `${styles.exportButton} ${styles.exportButtonSuccess}`
    : styles.exportButton;

  return (
    <div className={styles.actionBar} role="toolbar" aria-label="書き出し">
      <button
        type="button"
        className={styles.exportButton}
        disabled={disabled}
        onClick={onExportToFile}
        aria-label="保存"
        aria-keyshortcuts="Meta+Shift+S Control+Shift+S"
        title="保存 (Cmd/Ctrl+Shift+S)"
      >
        <SaveIcon />
      </button>
      <button
        type="button"
        className={copyClassName}
        disabled={disabled}
        onClick={onExportToClipboard}
        aria-label="コピー"
        aria-keyshortcuts="Meta+Shift+C Control+Shift+C"
        title={isCopied ? "コピーしました" : "クリップボードへコピー (Cmd/Ctrl+Shift+C)"}
      >
        {isCopied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <span className={styles.copyAnnouncement} role="status" aria-live="polite">
        {isCopied ? "クリップボードへコピーしました" : ""}
      </span>
    </div>
  );
}
