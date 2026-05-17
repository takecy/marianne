import { useEffect, useId, useRef } from "react";
import { t } from "@/i18n/translate";
import styles from "./AboutDialog.module.css";

interface AboutDialogProps {
  open: boolean;
  /**
   * App version string from Tauri's getVersion(). Empty string means the
   * version is unknown (loading, or running outside Tauri in tests) — the
   * label is then omitted instead of showing a placeholder.
   */
  version: string;
  onClose: () => void;
}

const TRIBUTE_URL_EN = "https://takecy.github.io/marianne/tribute/";
const LICENSE_URL = "https://github.com/takecy/marianne/blob/main/LICENSE";

export function AboutDialog(props: AboutDialogProps) {
  const { open, version, onClose } = props;
  const dialogRef = useRef<HTMLDialogElement>(null);
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
        event.preventDefault();
        onClose();
      }}
    >
      <div className={styles.body}>
        <h2 id={titleId} className={styles.title}>
          {t("about.title")}
          {version && <span className={styles.version}>v{version}</span>}
        </h2>
        <p className={styles.tagline}>{t("about.tagline")}</p>

        <p className={styles.paragraph}>{t("about.tribute")}</p>
        <p className={styles.paragraph}>{t("about.nameOrigin")}</p>

        <p className={styles.paragraph}>
          {t("about.license.prefix")}{" "}
          <a
            className={styles.link}
            href={LICENSE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            PolyForm Noncommercial 1.0.0
          </a>
          {t("about.license.suffix")}{" "}
          <a
            className={styles.link}
            href={TRIBUTE_URL_EN}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("about.tributeLink")}
          </a>
        </p>

        <p className={styles.disclaimer}>{t("about.disclaimer")}</p>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={onClose}
            autoFocus
          >
            {t("about.close")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
