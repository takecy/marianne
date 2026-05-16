import { CopyIcon } from "./icons/CopyIcon";
import { SaveIcon } from "./icons/SaveIcon";
import styles from "./ActionBar.module.css";

interface ActionBarProps {
  disabled?: boolean;
  onExportToFile?: () => void;
  onExportToClipboard?: () => void;
}

export function ActionBar(props: ActionBarProps) {
  const { disabled = false, onExportToFile, onExportToClipboard } = props;

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
        className={styles.exportButton}
        disabled={disabled}
        onClick={onExportToClipboard}
        aria-label="コピー"
        aria-keyshortcuts="Meta+Shift+C Control+Shift+C"
        title="クリップボードへコピー (Cmd/Ctrl+Shift+C)"
      >
        <CopyIcon />
      </button>
    </div>
  );
}
