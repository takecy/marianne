import { useEffect, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Stage } from "react-konva";
import { fitContain } from "@/lib/imageFit";
import type { LoadedImage } from "@/types/image";
import styles from "./CanvasArea.module.css";

interface CanvasAreaProps {
  image: LoadedImage | null;
  isDraggingOver: boolean;
}

export function CanvasArea(props: CanvasAreaProps) {
  const { image, isDraggingOver } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const className = isDraggingOver
    ? `${styles.canvasArea} ${styles.canvasAreaDragging}`
    : styles.canvasArea;

  const fit = image
    ? fitContain(
      { width: image.naturalWidth, height: image.naturalHeight },
      { width: size.width, height: size.height },
    )
    : null;

  return (
    <div ref={containerRef} className={className} aria-label="キャンバス">
      {size.width > 0 && size.height > 0
        ? (
          <Stage width={size.width} height={size.height}>
            <Layer>
              {image && fit
                ? (
                  <KonvaImage
                    image={image.element}
                    x={fit.x}
                    y={fit.y}
                    width={fit.width}
                    height={fit.height}
                    listening={false}
                  />
                )
                : null}
            </Layer>
          </Stage>
        )
        : null}
      {image === null
        ? (
          <div className={styles.emptyState} aria-hidden={false}>
            <div className={styles.emptyStateInner}>
              <p className={styles.emptyStateTitle}>画像を読み込み</p>
              <p className={styles.emptyStateBody}>
                画像をクリップボードから貼り付け（⌘V /
                Ctrl+V）するか、ここにドラッグ＆ドロップしてください。
              </p>
            </div>
          </div>
        )
        : null}
    </div>
  );
}
