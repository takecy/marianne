import { useEffect, useRef } from "react";
import type { UpdateState } from "@/lib/useUpdater";
import styles from "./UpdateModal.module.css";

interface UpdateModalProps {
  state: UpdateState;
  hasUnsavedShapes: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  onRetry: () => void;
}

function shouldOpen(state: UpdateState): boolean {
  return state.kind === "available" || state.kind === "downloading" ||
    state.kind === "readyToInstall" || state.kind === "error";
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
  const { state, hasUnsavedShapes, onInstall, onDismiss, onRetry } = props;
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
              新しいバージョン {state.version} が利用可能です
            </h2>
            {state.notes && (
              <div className={styles.notes}>
                <div className={styles.notesLabel}>変更内容:</div>
                <pre className={styles.notesBody}>{state.notes}</pre>
              </div>
            )}
            {hasUnsavedShapes && (
              <p className={styles.warning} role="alert">
                ⚠ 未保存の注釈があります。更新するとアプリが再起動し、編集中の内容は失われます。
                先に保存してから更新してください。
              </p>
            )}
            <p className={styles.note}>更新を適用するとアプリが再起動します。</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={onDismiss}
              >
                後で
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onInstall}
                autoFocus
              >
                今すぐ更新
              </button>
            </div>
          </>
        )}

        {state.kind === "downloading" && (
          <>
            <h2 id="update-modal-title" className={styles.title}>
              ダウンロード中…
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
              更新を適用しています
            </h2>
            <p className={styles.note}>
              {state.version} のインストール後、アプリが自動で再起動します。
            </p>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h2 id="update-modal-title" className={styles.title}>
              更新に失敗しました
            </h2>
            <p className={styles.errorBody}>{state.message}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={onDismiss}
              >
                閉じる
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={onRetry}
              >
                再試行
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
