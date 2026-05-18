import { t } from "@/i18n/translate";
import type { LoadedImage } from "@/types/image";
import styles from "./StatusBar.module.css";

interface StatusBarProps {
  image: LoadedImage | null;
  zoom: number;
}

const SOURCE_LABELS: Record<LoadedImage["source"], string> = {
  paste: t("source.paste"),
  drop: t("source.drop"),
  file: t("source.file"),
};

function extensionOf(fileName: string | undefined): string {
  if (!fileName) {
    return "";
  }
  const idx = fileName.lastIndexOf(".");
  if (idx < 0 || idx === fileName.length - 1) {
    return "";
  }
  return fileName.slice(idx + 1).toLowerCase();
}

// `role="status"` is intentionally NOT set: WAI-ARIA 1.2 defines it as an
// implicit polite live region (aria-live=polite, aria-atomic=true), which
// would announce dimension/path changes every time the image is swapped.
// `aria-label` alone gives the element an accessible name without the live
// semantics.
export function StatusBar({ image, zoom }: StatusBarProps) {
  if (image === null) {
    return <div className={styles.statusBar} aria-label={t("statusBar.imageInfo.label")} />;
  }

  const leftText = image.sourcePath ?? SOURCE_LABELS[image.source];
  const ext = extensionOf(image.sourceFileName);
  const dimensions = `${image.naturalWidth}×${image.naturalHeight}`;
  const rightText = ext ? `${ext} : ${dimensions}` : dimensions;
  const zoomText = `${Math.round(zoom * 100)}%`;

  return (
    <div className={styles.statusBar} aria-label={t("statusBar.imageInfo.label")}>
      <span className={styles.left} title={leftText}>{leftText}</span>
      <span className={styles.zoom}>{zoomText}</span>
      <span className={styles.right}>{rightText}</span>
    </div>
  );
}
