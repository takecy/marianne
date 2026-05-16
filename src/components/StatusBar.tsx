import type { LoadedImage } from "@/types/image";
import styles from "./StatusBar.module.css";

interface StatusBarProps {
  image: LoadedImage | null;
}

// Fallback labels for the left text when sourcePath is unavailable. The
// natural-language strings are kept inline here (matching the project's
// hardcoded-Japanese-UI convention; see Sidebar.tsx TOOL_LABELS).
const SOURCE_LABELS: Record<LoadedImage["source"], string> = {
  paste: "クリップボードから貼り付け",
  drop: "ドラッグ&ドロップで読み込み",
  file: "ファイルを開く",
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
export function StatusBar({ image }: StatusBarProps) {
  if (image === null) {
    return <div className={styles.statusBar} aria-label="画像情報" />;
  }

  const leftText = image.sourcePath ?? SOURCE_LABELS[image.source];
  const ext = extensionOf(image.sourceFileName);
  const dimensions = `${image.naturalWidth}×${image.naturalHeight}`;
  const rightText = ext ? `${ext} : ${dimensions}` : dimensions;

  return (
    <div className={styles.statusBar} aria-label="画像情報">
      <span className={styles.left} title={leftText}>{leftText}</span>
      <span className={styles.right}>{rightText}</span>
    </div>
  );
}
