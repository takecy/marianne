import type { KonvaEventObject } from "konva/lib/Node";
import { useEffect, useRef, useState } from "react";
import { Arrow, Image as KonvaImage, Layer, Rect, Stage, Text } from "react-konva";
import {
  clampToImage,
  fitContain,
  imageToScreen,
  imageToScreenScale,
  screenToImage,
} from "@/lib/imageFit";
import type { FitRect, Point, Size as FitSize } from "@/lib/imageFit";
import { finalizeDraft, moveDraft, startDraft } from "@/lib/drawingGesture";
import type { LoadedImage } from "@/types/image";
import type { DraftShape, Shape, TextShape } from "@/types/shape";
import type { ColorPresetName, ToolKind } from "@/types/tool";
import { colorHex } from "@/types/tool";
import { MOSAIC_NATURAL_PIXEL_SIZE, MosaicNode } from "./MosaicNode";
import { TextInputOverlay } from "./TextInputOverlay";
import styles from "./CanvasArea.module.css";

interface CanvasAreaProps {
  image: LoadedImage | null;
  isDraggingOver: boolean;
  shapes: Shape[];
  activeTool: ToolKind;
  activeColor: ColorPresetName;
  onShapeAdded: (shape: Shape) => void;
}

function getStagePointer(event: KonvaEventObject<MouseEvent>): Point | null {
  const stage = event.target.getStage();
  const pos = stage?.getPointerPosition();
  return pos ? { x: pos.x, y: pos.y } : null;
}

function renderShape(
  shape: Shape,
  fit: FitRect,
  imageSize: FitSize,
  image: LoadedImage | null,
) {
  const { scaleX, scaleY } = imageToScreenScale(fit, imageSize);
  if (shape.type === "rect") {
    const hex = colorHex(shape.color);
    const topLeft = imageToScreen({ x: shape.x, y: shape.y }, fit, imageSize);
    return (
      <Rect
        key={shape.id}
        x={topLeft.x}
        y={topLeft.y}
        width={shape.width * scaleX}
        height={shape.height * scaleY}
        stroke={hex}
        strokeWidth={4}
        listening={false}
      />
    );
  }
  if (shape.type === "text") {
    const hex = colorHex(shape.color);
    const topLeft = imageToScreen({ x: shape.x, y: shape.y }, fit, imageSize);
    const fontScale = Math.min(scaleX, scaleY);
    return (
      <Text
        key={shape.id}
        x={topLeft.x}
        y={topLeft.y}
        text={shape.text}
        fontSize={24 * fontScale}
        fontFamily="sans-serif"
        fill={hex}
        listening={false}
      />
    );
  }
  if (shape.type === "mosaic") {
    if (!image) {
      return null;
    }
    const topLeft = imageToScreen({ x: shape.x, y: shape.y }, fit, imageSize);
    // Konva filter operates on cached canvas (screen) pixels, so scale the
    // natural-pixel target to keep block size constant in image coords.
    const pixelSize = MOSAIC_NATURAL_PIXEL_SIZE * Math.min(scaleX, scaleY);
    return (
      <MosaicNode
        key={shape.id}
        image={image.element}
        screenX={topLeft.x}
        screenY={topLeft.y}
        screenWidth={shape.width * scaleX}
        screenHeight={shape.height * scaleY}
        cropX={shape.x}
        cropY={shape.y}
        cropWidth={shape.width}
        cropHeight={shape.height}
        pixelSize={pixelSize}
      />
    );
  }
  // arrow
  const hex = colorHex(shape.color);
  const from = imageToScreen({ x: shape.fromX, y: shape.fromY }, fit, imageSize);
  const to = imageToScreen({ x: shape.toX, y: shape.toY }, fit, imageSize);
  return (
    <Arrow
      key={shape.id}
      points={[from.x, from.y, to.x, to.y]}
      stroke={hex}
      strokeWidth={4}
      fill={hex}
      pointerLength={14}
      pointerWidth={14}
      shadowBlur={6}
      shadowColor="rgba(0,0,0,0.45)"
      shadowOffsetX={1}
      shadowOffsetY={2}
      listening={false}
    />
  );
}

function renderDraft(draft: DraftShape, fit: FitRect, imageSize: FitSize) {
  const { scaleX, scaleY } = imageToScreenScale(fit, imageSize);
  if (draft.type === "rect") {
    const hex = colorHex(draft.color);
    const left = Math.min(draft.x, draft.x + draft.width);
    const top = Math.min(draft.y, draft.y + draft.height);
    const w = Math.abs(draft.width);
    const h = Math.abs(draft.height);
    const topLeft = imageToScreen({ x: left, y: top }, fit, imageSize);
    return (
      <Rect
        x={topLeft.x}
        y={topLeft.y}
        width={w * scaleX}
        height={h * scaleY}
        stroke={hex}
        strokeWidth={4}
        listening={false}
        opacity={0.7}
      />
    );
  }
  if (draft.type === "mosaic") {
    const left = Math.min(draft.x, draft.x + draft.width);
    const top = Math.min(draft.y, draft.y + draft.height);
    const w = Math.abs(draft.width);
    const h = Math.abs(draft.height);
    const topLeft = imageToScreen({ x: left, y: top }, fit, imageSize);
    // Lightweight preview during drag; full Pixelate caching happens after
    // mouse up (see MosaicNode) to avoid per-frame cache thrashing.
    return (
      <Rect
        x={topLeft.x}
        y={topLeft.y}
        width={w * scaleX}
        height={h * scaleY}
        fill="rgba(15, 23, 42, 0.35)"
        stroke="#0f172a"
        strokeWidth={1}
        dash={[4, 4]}
        listening={false}
      />
    );
  }
  // arrow
  const hex = colorHex(draft.color);
  const from = imageToScreen({ x: draft.fromX, y: draft.fromY }, fit, imageSize);
  const to = imageToScreen({ x: draft.toX, y: draft.toY }, fit, imageSize);
  return (
    <Arrow
      points={[from.x, from.y, to.x, to.y]}
      stroke={hex}
      strokeWidth={4}
      fill={hex}
      pointerLength={14}
      pointerWidth={14}
      shadowBlur={6}
      shadowColor="rgba(0,0,0,0.45)"
      shadowOffsetX={1}
      shadowOffsetY={2}
      listening={false}
      opacity={0.7}
    />
  );
}

export function CanvasArea(props: CanvasAreaProps) {
  const { image, isDraggingOver, shapes, activeTool, activeColor, onShapeAdded } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [textInput, setTextInput] = useState<Point | null>(null);

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

  // Cancel any in-flight draft/text input when the tool or image changes.
  // This is the "store previous prop value" pattern from the React 19 docs:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes

  const prevToolRef = useRef(activeTool);

  const prevImageElRef = useRef(image?.element);
  // eslint-disable-next-line react-hooks/refs
  if (prevToolRef.current !== activeTool || prevImageElRef.current !== image?.element) {
    // eslint-disable-next-line react-hooks/refs
    prevToolRef.current = activeTool;

    prevImageElRef.current = image?.element;
    if (draft !== null) {
      setDraft(null);
    }
    if (textInput !== null) {
      setTextInput(null);
    }
  }

  const imageSize: FitSize | null = image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : null;
  const fit: FitRect | null = imageSize ? fitContain(imageSize, size) : null;

  const handleMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    if (textInput !== null) {
      return;
    }
    if (!image || !fit || !imageSize) {
      return;
    }
    const screen = getStagePointer(event);
    if (!screen) {
      return;
    }
    const imagePoint = clampToImage(screenToImage(screen, fit, imageSize), imageSize);
    if (activeTool === "rect" || activeTool === "arrow" || activeTool === "mosaic") {
      setDraft(startDraft(activeTool, activeColor, imagePoint));
      return;
    }
    if (activeTool === "text") {
      setTextInput(imagePoint);
    }
  };

  const handleMouseMove = (event: KonvaEventObject<MouseEvent>) => {
    if (!draft || !fit || !imageSize) {
      return;
    }
    const screen = getStagePointer(event);
    if (!screen) {
      return;
    }
    const imagePoint = clampToImage(screenToImage(screen, fit, imageSize), imageSize);
    setDraft(moveDraft(draft, imagePoint));
  };

  const handleMouseUp = () => {
    if (!draft) {
      return;
    }
    const shape = finalizeDraft(draft);
    if (shape) {
      onShapeAdded(shape);
    }
    setDraft(null);
  };

  const confirmText = (text: string) => {
    if (!textInput) {
      return;
    }
    const shape: TextShape = {
      id: crypto.randomUUID(),
      type: "text",
      color: activeColor,
      x: textInput.x,
      y: textInput.y,
      text,
    };
    onShapeAdded(shape);
    setTextInput(null);
  };

  const cancelText = () => {
    setTextInput(null);
  };

  const className = isDraggingOver
    ? `${styles.canvasArea} ${styles.canvasAreaDragging}`
    : styles.canvasArea;

  const textInputScreen = textInput && fit && imageSize
    ? imageToScreen(textInput, fit, imageSize)
    : null;

  return (
    <div ref={containerRef} className={className} aria-label="キャンバス">
      {size.width > 0 && size.height > 0
        ? (
          <Stage
            width={size.width}
            height={size.height}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <Layer listening={false}>
              {image && fit
                ? (
                  <KonvaImage
                    image={image.element}
                    x={fit.x}
                    y={fit.y}
                    width={fit.width}
                    height={fit.height}
                  />
                )
                : null}
            </Layer>
            <Layer listening={false}>
              {fit && imageSize
                ? shapes.map((shape) => renderShape(shape, fit, imageSize, image))
                : null}
            </Layer>
            <Layer listening={false}>
              {draft && fit && imageSize ? renderDraft(draft, fit, imageSize) : null}
            </Layer>
          </Stage>
        )
        : null}
      {textInput && textInputScreen
        ? (
          <TextInputOverlay
            x={textInputScreen.x}
            y={textInputScreen.y}
            color={activeColor}
            onConfirm={confirmText}
            onCancel={cancelText}
          />
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
