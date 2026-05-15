import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arrow, Image as KonvaImage, Layer, Rect, Stage, Transformer } from "react-konva";
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
import type {
  ArrowShape,
  DraftShape,
  MosaicShape,
  RectShape,
  Shape,
  TextShape,
} from "@/types/shape";
import type { ColorPresetName, ToolKind } from "@/types/tool";
import { colorHex } from "@/types/tool";
import { SelectableShape } from "./SelectableShape";
import { TextInputOverlay } from "./TextInputOverlay";
import styles from "./CanvasArea.module.css";

type RectPatch = Partial<Omit<RectShape, "id" | "type">>;
type TextPatch = Partial<Omit<TextShape, "id" | "type">>;
type ArrowPatch = Partial<Omit<ArrowShape, "id" | "type">>;
type MosaicPatch = Partial<Omit<MosaicShape, "id" | "type">>;

interface CanvasAreaProps {
  image: LoadedImage | null;
  isDraggingOver: boolean;
  shapes: Shape[];
  activeTool: ToolKind;
  activeColor: ColorPresetName;
  selectedShapeId: string | null;
  onShapeAdded: (shape: Shape) => void;
  onSelectShape: (id: string | null) => void;
  onDeleteShape: (id: string) => void;
  onUpdateRect: (id: string, patch: RectPatch) => void;
  onUpdateText: (id: string, patch: TextPatch) => void;
  onUpdateArrow: (id: string, patch: ArrowPatch) => void;
  onUpdateMosaic: (id: string, patch: MosaicPatch) => void;
  onUndo: () => void;
  onRedo: () => void;
}

const RESIZE_ANCHORS: readonly string[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

function getStagePointer(event: KonvaEventObject<MouseEvent>): Point | null {
  const stage = event.target.getStage();
  const pos = stage?.getPointerPosition();
  return pos ? { x: pos.x, y: pos.y } : null;
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
  const {
    image,
    isDraggingOver,
    shapes,
    activeTool,
    activeColor,
    selectedShapeId,
    onShapeAdded,
    onSelectShape,
    onDeleteShape,
    onUpdateRect,
    onUpdateText,
    onUpdateArrow,
    onUpdateMosaic,
    onUndo,
    onRedo,
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [textInput, setTextInput] = useState<Point | null>(null);
  const nodeMap = useRef<Map<string, Konva.Node>>(new Map());
  const transformerRef = useRef<Konva.Transformer | null>(null);

  const isSelectMode = activeTool === "select";

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

  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (node) {
      nodeMap.current.set(id, node);
    } else {
      nodeMap.current.delete(id);
    }
  }, []);

  // Attach Transformer to the currently selected shape's node.
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }
    if (isSelectMode && selectedShapeId) {
      const node = nodeMap.current.get(selectedShapeId);
      transformer.nodes(node ? [node] : []);
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [isSelectMode, selectedShapeId, shapes]);

  // Keyboard shortcuts:
  // - Cmd/Ctrl + Z         => undo
  // - Cmd/Ctrl + Shift + Z => redo
  // - Delete / Backspace   => remove selected shape (select-mode only)
  // We bail out when text input is active or when focus is in an editable field
  // so the browser's native textarea undo (and key bindings) keeps working.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (textInput !== null) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      if (!isSelectMode) {
        return;
      }
      if (!selectedShapeId) {
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onDeleteShape(selectedShapeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSelectMode, selectedShapeId, textInput, onDeleteShape, onUndo, onRedo]);

  const imageSize: FitSize | null = image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : null;
  const fit: FitRect | null = imageSize ? fitContain(imageSize, size) : null;

  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === selectedShapeId) ?? null,
    [shapes, selectedShapeId],
  );

  const enabledAnchors =
    selectedShape && (selectedShape.type === "rect" || selectedShape.type === "mosaic")
      ? RESIZE_ANCHORS
      : [];

  const handleMouseDown = (event: KonvaEventObject<MouseEvent>) => {
    if (textInput !== null) {
      return;
    }
    if (!image || !fit || !imageSize) {
      return;
    }

    // In select mode: clicking blank canvas deselects, clicking a shape is handled by the shape itself.
    if (isSelectMode) {
      if (event.target === event.target.getStage()) {
        onSelectShape(null);
      }
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
            <Layer listening={isSelectMode}>
              {fit && imageSize
                ? shapes.map((shape) => (
                  <SelectableShape
                    key={shape.id}
                    shape={shape}
                    fit={fit}
                    imageSize={imageSize}
                    image={image}
                    isSelectMode={isSelectMode}
                    onSelect={onSelectShape}
                    onUpdateRect={onUpdateRect}
                    onUpdateText={onUpdateText}
                    onUpdateArrow={onUpdateArrow}
                    onUpdateMosaic={onUpdateMosaic}
                    registerNode={registerNode}
                  />
                ))
                : null}
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                flipEnabled={false}
                enabledAnchors={enabledAnchors as string[]}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width >= 8 && newBox.height >= 8 ? newBox : oldBox}
              />
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
