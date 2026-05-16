import { useEffect, useId, useRef } from "react";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /**
   * Whether the confirm action is destructive (causes data loss).
   * When true (default), the Cancel button receives autoFocus so an
   * accidental Enter does not trigger the destructive action.
   */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  const {
    open,
    title,
    message,
    confirmLabel,
    cancelLabel = "キャンセル",
    destructive = true,
    onConfirm,
    onCancel,
  } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Per-instance aria-labelledby id so multiple dialogs can be mounted
  // simultaneously without colliding (e.g. quit-confirm + a future
  // image-replace confirm at the same time). useId is stable across
  // renders and unique per component instance.
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Treat Escape as "Cancel" so it cannot be mistaken for Confirm.
        event.preventDefault();
        onCancel();
      }}
    >
      <div className={styles.body}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <p className={styles.note}>{message}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
            autoFocus={destructive}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onConfirm}
            autoFocus={!destructive}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
