import { useEffect, useRef } from "react";
import { t } from "@/i18n/translate";
import type { UpdateState } from "@/lib/useUpdater";
import styles from "./UpdateModal.module.css";

interface UpdateModalProps {
  state: UpdateState;
  hasUnsavedShapes: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

// `error` is intentionally excluded: failed update checks surface as inline
// text on the Toolbar instead of a blocking dialog so the user can keep
// editing while ignoring the failure. Retry is driven by the toolbar
// button (which simply calls checkForUpdates again).
function shouldOpen(state: UpdateState): boolean {
  return state.kind === "available" || state.kind === "downloading" ||
    state.kind === "readyToInstall";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function UpdateModal(props: UpdateModalProps) {
  const { state, hasUnsavedShapes, onInstall, onDismiss } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (shouldOpen(state)) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [state]);

  // jsdom does not implement <dialog>.showModal, so we render the dialog
  // unconditionally and rely on the effect above to drive open/close.
  // Tests inspect content via getByRole("dialog") which only matches when
  // the element is open in the DOM tree.
  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-labelledby="update-modal-title"
      onCancel={(event) => {
        // Block escape-to-close while downloading so an accidental key
        // press cannot leave the user wondering if the update finished.
        if (state.kind === "downloading") {
          event.preventDefault();
        } else {
          onDismiss();
        }
      }}
    >
      <div className={styles.body}>
        {state.kind === "available" && (
          <>
            <h2 id="update-modal-title" className={styles.title}>
              {t("update.available.title", { version: state.version })}
            </h2>
            {state.notes && (
              <div className={styles.notes}>
                <div className={styles.notesLabel}>{t("update.releaseNotes.label")}</div>
                <pre className={styles.notesBody}>{state.notes}</pre>
              </div>
            )}
            {hasUnsavedShapes && (
              <p className={styles.warning} role="alert">
                {t("update.warning.unsaved")}
              </p>
            )}
            <p className={styles.note}>{t("update.notice.restart")}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={onDismiss}
              >
                {t("update.action.later")}
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onInstall}
                autoFocus
              >
                {t("update.action.install")}
              </button>
            </div>
          </>
        )}

        {state.kind === "downloading" && (
          <>
            <h2 id="update-modal-title" className={styles.title}>
              {t("update.status.downloading")}
            </h2>
            <div className={styles.progressWrap} aria-live="polite">
              {state.contentLength !== undefined
                ? (
                  <>
                    <progress
                      className={styles.progress}
                      value={state.downloaded}
                      max={state.contentLength}
                    />
                    <div className={styles.progressLabel}>
                      {formatBytes(state.downloaded)} / {formatBytes(state.contentLength)}
                    </div>
                  </>
                )
                : (
                  <>
                    <progress className={styles.progress} />
                    <div className={styles.progressLabel}>{formatBytes(state.downloaded)}</div>
                  </>
                )}
            </div>
          </>
        )}

        {state.kind === "readyToInstall" && (
          <>
            <h2 id="update-modal-title" className={styles.title}>
              {t("update.status.applying")}
            </h2>
            <p className={styles.note}>
              {t("update.readyToInstall.body", { version: state.version })}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
