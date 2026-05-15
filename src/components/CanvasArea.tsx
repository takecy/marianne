import { useEffect, useRef, useState } from "react";
import { Layer, Stage } from "react-konva";
import styles from "./CanvasArea.module.css";

export function CanvasArea() {
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

  return (
    <div ref={containerRef} className={styles.canvasArea} aria-label="キャンバス">
      {size.width > 0 && size.height > 0
        ? (
          <Stage width={size.width} height={size.height}>
            <Layer />
          </Stage>
        )
        : null}
    </div>
  );
}
