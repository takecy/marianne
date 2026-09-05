import { useEffect, useId, useRef } from "react";
import { t } from "@/i18n/translate";
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
    cancelLabel = t("dialog.cancel"),
    destructive = true,
    onConfirm,
    onCancel,
  } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
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

  // Arrow keys move focus between the two buttons; y / n activate them.
  // The listener lives on the <dialog> element rather than window because
  // App.tsx keeps three ConfirmDialog instances mounted at all times — a
  // window listener would fire on the closed ones too. showModal() puts
  // focus on the autoFocused button, so keydown reaches the dialog.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const onKey = (event: KeyboardEvent) => {
      // IME composition must never be mistaken for a shortcut.
      if (event.isComposing) return;
      // Modifier combos belong to the OS / app menu (Cmd+Y etc.).
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      switch (event.key) {
        case "ArrowLeft":
        case "ArrowUp":
          event.preventDefault();
          cancelRef.current?.focus();
          return;
        case "ArrowRight":
        case "ArrowDown":
          event.preventDefault();
          confirmRef.current?.focus();
          return;
      }

      const pressed = event.key.toLowerCase();
      if (pressed === "y") {
        event.preventDefault();
        event.stopPropagation();
        onConfirm();
      } else if (pressed === "n") {
        event.preventDefault();
        event.stopPropagation();
        onCancel();
      }
    };
    dialog.addEventListener("keydown", onKey);
    return () => dialog.removeEventListener("keydown", onKey);
  }, [open, onConfirm, onCancel]);

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
            ref={cancelRef}
            type="button"
            className={styles.secondaryButton}
            onClick={onCancel}
            autoFocus={destructive}
            aria-keyshortcuts="n"
          >
            {cancelLabel}
            {/* Badge stays out of the accessible name; aria-keyshortcuts carries it. */}
            <span className={styles.shortcutHint} aria-hidden>
              N
            </span>
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={styles.primaryButton}
            onClick={onConfirm}
            autoFocus={!destructive}
            aria-keyshortcuts="y"
          >
            {confirmLabel}
            <span className={styles.shortcutHint} aria-hidden>
              Y
            </span>
          </button>
        </div>
      </div>
    </dialog>
  );
}
