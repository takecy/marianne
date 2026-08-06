import { t } from "@/i18n/translate";
import type { LoadedImage } from "@/types/image";
import styles from "./StatusBar.module.css";

interface StatusBarProps {
  image: LoadedImage | null;
  zoom: number;
  // Transient message for user-initiated update checks (Marianne → Check for
  // Updates...). Lives here rather than in the bottom-left slot so that slot
  // keeps meaning exactly one thing: a new version exists.
  notice?: string | null;
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

// `role="status"` is intentionally NOT set on the container: WAI-ARIA 1.2
// defines it as an implicit polite live region (aria-live=polite,
// aria-atomic=true), which would announce dimension/path changes every time
// the image is swapped. `aria-label` alone gives the element an accessible
// name without the live semantics. The transient `notice` span below is a
// different case — it is a one-shot message, so it does carry the live
// region, scoped to itself.
//
// The image parts are rendered conditionally rather than early-returning on
// `image === null`: a manual update check is usually run before any image is
// loaded, and an early return would swallow `notice` in exactly that case.
// The notice span is always mounted (empty when idle) so the live region
// exists before its text changes — same approach as ActionBar's copy
// announcement. While empty it is zero-width; it only costs one extra flex
// gap, which `.left` absorbs.
export function StatusBar({ image, zoom, notice }: StatusBarProps) {
  return (
    <div className={styles.statusBar} aria-label={t("statusBar.imageInfo.label")}>
      {image !== null && <ImagePath image={image} />}
      <span className={styles.notice} role="status" aria-live="polite">
        {notice ?? ""}
      </span>
      {image !== null && <ImageMetrics image={image} zoom={zoom} />}
    </div>
  );
}

function ImagePath({ image }: { image: LoadedImage }) {
  const leftText = image.sourcePath ?? SOURCE_LABELS[image.source];
  return <span className={styles.left} title={leftText}>{leftText}</span>;
}

function ImageMetrics({ image, zoom }: { image: LoadedImage; zoom: number }) {
  const ext = extensionOf(image.sourceFileName);
  const dimensions = `${image.naturalWidth}×${image.naturalHeight}`;
  const rightText = ext ? `${ext} : ${dimensions}` : dimensions;
  const zoomText = `${Math.round(zoom * 100)}%`;
  return (
    <>
      <span className={styles.zoom}>{zoomText}</span>
      <span className={styles.right}>{rightText}</span>
    </>
  );
}
