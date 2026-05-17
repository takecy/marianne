import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image as KonvaImage, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import {
  clampToImage,
  fitContain,
  imageToScreen,
  imageToScreenScale,
  screenToImage,
} from "@/lib/imageFit";
import type { FitRect, Point, Size as FitSize } from "@/lib/imageFit";
import { finalizeDraft, moveDraft, startDraft } from "@/lib/drawingGesture";
import { useThemeMode } from "@/lib/useThemeMode";
import type { LoadedImage } from "@/types/image";
import type {
  ArrowShape,
  DraftShape,
  MosaicShape,
  RectShape,
  Shape,
  TextShape,
} from "@/types/shape";
import type { ColorPresetName, StrokeWidthPresetName, ToolKind } from "@/types/tool";
import { colorHex, strokeWidthValue, TOOL_KINDS, TOOL_SHORTCUTS } from "@/types/tool";
import {
  ARROW_HEAD_HALF_WIDTH,
  ARROW_HEAD_LENGTH,
  ARROW_NECK_HALF_WIDTH,
  ARROW_NECK_LENGTH,
  ARROW_TAIL_HALF_WIDTH,
  TEXT_FONT_SIZE,
} from "@/constants/shape";
import { computeArrowPolygon } from "@/lib/arrowGeometry";
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
  activeStrokeWidth: StrokeWidthPresetName;
  selectedShapeId: string | null;
  hasClipboardShape: boolean;
  onToolChange: (next: ToolKind) => void;
  onShapeAdded: (shape: Shape) => void;
  onSelectShape: (id: string | null) => void;
  onDeleteShape: (id: string) => void;
  onUpdateRect: (id: string, patch: RectPatch) => void;
  onUpdateText: (id: string, patch: TextPatch) => void;
  onUpdateArrow: (id: string, patch: ArrowPatch) => void;
  onUpdateMosaic: (id: string, patch: MosaicPatch) => void;
  onCopyShape: (id: string) => void;
  onPasteShape: (imageSize: { width: number; height: number }) => void;
  onAfterPaste: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportToFile: () => void;
  onExportToClipboard: () => void;
  onEditingTextChange?: (isEditing: boolean) => void;
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

const TEXT_RESIZE_ANCHORS: readonly string[] = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
];

function getStagePointer(event: KonvaEventObject<MouseEvent>): Point | null {
  const stage = event.target.getStage();
  const pos = stage?.getPointerPosition();
  return pos ? { x: pos.x, y: pos.y } : null;
}

interface MosaicDraftColors {
  fill: string;
  stroke: string;
}

// Mosaic draft is the only Konva-rendered piece that can't pick up theme via
// CSS variables, so colors are passed in from CanvasArea, which subscribes to
// `prefers-color-scheme` through useThemeMode.
const MOSAIC_DRAFT_COLORS_LIGHT: MosaicDraftColors = {
  fill: "rgba(15, 23, 42, 0.35)",
  stroke: "#0f172a",
};
const MOSAIC_DRAFT_COLORS_DARK: MosaicDraftColors = {
  fill: "rgba(241, 245, 249, 0.35)",
  stroke: "#f1f5f9",
};

function renderDraft(
  draft: DraftShape,
  fit: FitRect,
  imageSize: FitSize,
  mosaicDraftColors: MosaicDraftColors,
) {
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
        strokeWidth={strokeWidthValue(draft.strokeWidth)}
        lineJoin="round"
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
        fill={mosaicDraftColors.fill}
        stroke={mosaicDraftColors.stroke}
        strokeWidth={1}
        dash={[4, 4]}
        listening={false}
      />
    );
  }
  const hex = colorHex(draft.color);
  const from = imageToScreen({ x: draft.fromX, y: draft.fromY }, fit, imageSize);
  const to = imageToScreen({ x: draft.toX, y: draft.toY }, fit, imageSize);
  const arrowScale = Math.min(scaleX, scaleY);
  const polygon = computeArrowPolygon(from, to, {
    tailHalfWidth: ARROW_TAIL_HALF_WIDTH * arrowScale,
    neckHalfWidth: ARROW_NECK_HALF_WIDTH * arrowScale,
    headHalfWidth: ARROW_HEAD_HALF_WIDTH * arrowScale,
    neckLength: ARROW_NECK_LENGTH * arrowScale,
    headLength: ARROW_HEAD_LENGTH * arrowScale,
  });
  return (
    <Line
      points={polygon}
      closed
      fill={hex}
      shadowBlur={6 * arrowScale}
      shadowColor="rgba(0,0,0,0.45)"
      shadowOffsetX={1 * arrowScale}
      shadowOffsetY={2 * arrowScale}
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
    activeStrokeWidth,
    selectedShapeId,
    hasClipboardShape,
    onToolChange,
    onShapeAdded,
    onSelectShape,
    onDeleteShape,
    onUpdateRect,
    onUpdateText,
    onUpdateArrow,
    onUpdateMosaic,
    onCopyShape,
    onPasteShape,
    onAfterPaste,
    onUndo,
    onRedo,
    onExportToFile,
    onExportToClipboard,
    onEditingTextChange,
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [textInput, setTextInput] = useState<Point | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const nodeMap = useRef<Map<string, Konva.Node>>(new Map());
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const themeMode = useThemeMode();
  const mosaicDraftColors = themeMode === "dark"
    ? MOSAIC_DRAFT_COLORS_DARK
    : MOSAIC_DRAFT_COLORS_LIGHT;

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
    if (editingTextId !== null) {
      setEditingTextId(null);
    }
  }

  const registerNode = useCallback((id: string, node: Konva.Node | null) => {
    if (node) {
      nodeMap.current.set(id, node);
    } else {
      nodeMap.current.delete(id);
    }
  }, []);

  // Attach Transformer to the currently selected shape's node. Suppress
  // attachment while the same shape is being text-edited so the resize
  // handles do not overlap the textarea overlay.
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }
    if (isSelectMode && selectedShapeId && selectedShapeId !== editingTextId) {
      const node = nodeMap.current.get(selectedShapeId);
      transformer.nodes(node ? [node] : []);
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [isSelectMode, selectedShapeId, editingTextId, shapes]);

  // Clear editingTextId during render if the target shape vanished from
  // `shapes` (e.g. after undo replays an older snapshot that did not
  // include it). We follow the same render-time pattern used for the
  // tool/image cleanup block above so the React Hooks set-state-in-effect
  // lint passes; the React docs call this "Adjusting state based on
  // prior state". Without this, isEditingText would remain true forever
  // and the Toolbar export would stay disabled.
  if (editingTextId !== null) {
    const stillExists = shapes.some(
      (s) => s.id === editingTextId && s.type === "text",
    );
    if (!stillExists) {
      setEditingTextId(null);
    }
  }

  // Propagate editing state to the parent so the Toolbar can gate export.
  // This is a true side effect (calling an external callback), so the
  // useEffect-based path is correct here even though the lint rule would
  // also fire on a setState inside this effect — there is none.
  useEffect(() => {
    onEditingTextChange?.(editingTextId !== null);
  }, [editingTextId, onEditingTextChange]);

  // Keyboard shortcuts:
  // - Cmd/Ctrl + Shift + S => export to file (opens native save dialog)
  // - Cmd/Ctrl + Shift + C => export to clipboard (copy PNG image)
  // - Cmd/Ctrl + Z         => undo
  // - Cmd/Ctrl + Shift + Z => redo
  // - Cmd/Ctrl + C         => copy selected shape to internal clipboard (select mode only)
  // - Cmd/Ctrl + V         => paste shape from internal clipboard
  // - v / a / r / t / m    => switch tool (select / arrow / rect / text / mosaic), ignored when no image
  // - Delete / Backspace   => remove selected shape (select-mode only)
  // We bail out when text input is active or when focus is in an editable field
  // so the browser's native textarea undo (and key bindings) keeps working.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (textInput !== null || editingTextId !== null) {
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

      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "s" || e.key === "S")
      ) {
        e.preventDefault();
        onExportToFile();
        return;
      }

      // Cmd/Ctrl + Shift + C: export PNG to system clipboard. Distinct from
      // the plain Cmd/Ctrl + C below, which copies the selected shape to the
      // internal clipboard (for in-app duplication via Cmd+V).
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        (e.key === "c" || e.key === "C")
      ) {
        e.preventDefault();
        onExportToClipboard();
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

      // Cmd/Ctrl + C: copy the selected shape (select mode only).
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        (e.key === "c" || e.key === "C")
      ) {
        if (isSelectMode && selectedShapeId !== null && image !== null) {
          e.preventDefault();
          onCopyShape(selectedShapeId);
        }
        return;
      }

      // Cmd/Ctrl + V: paste the clipboard shape only when something is in the
      // in-memory clipboard. preventDefault here suppresses the corresponding
      // `paste` event, so useImageLoader does not also fire. When the
      // clipboard is empty, we do NOT preventDefault — the paste event then
      // runs normally so OS-clipboard image paste keeps working.
      // imageSize is built inline from image to avoid TDZ on the `imageSize`
      // const declared later in this component.
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        (e.key === "v" || e.key === "V")
      ) {
        if (image !== null && hasClipboardShape) {
          e.preventDefault();
          onPasteShape({ width: image.naturalWidth, height: image.naturalHeight });
          onAfterPaste();
        }
        return;
      }

      // Tool switching via single-key shortcut. Modifier-less only so we never
      // hijack Cmd+T / Shift+R / etc. and so a one-key match in TOOL_SHORTCUTS
      // can win over later branches. Disabled while no image is loaded to
      // match the Toolbar's disabled state.
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && image !== null) {
        const pressed = e.key.toLowerCase();
        for (const tool of TOOL_KINDS) {
          if (TOOL_SHORTCUTS[tool] === pressed) {
            e.preventDefault();
            onToolChange(tool);
            return;
          }
        }
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
  }, [
    isSelectMode,
    selectedShapeId,
    textInput,
    editingTextId,
    image,
    hasClipboardShape,
    onToolChange,
    onDeleteShape,
    onCopyShape,
    onPasteShape,
    onAfterPaste,
    onUndo,
    onRedo,
    onExportToFile,
    onExportToClipboard,
  ]);

  const imageSize: FitSize | null = image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : null;
  const fit: FitRect | null = imageSize ? fitContain(imageSize, size) : null;

  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === selectedShapeId) ?? null,
    [shapes, selectedShapeId],
  );

  const enabledAnchors = !selectedShape
    ? []
    : selectedShape.type === "text"
    ? TEXT_RESIZE_ANCHORS
    : selectedShape.type === "rect" || selectedShape.type === "mosaic"
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
      setDraft(startDraft(activeTool, activeColor, activeStrokeWidth, imagePoint));
      return;
    }
    if (activeTool === "text") {
      // Prevent the browser from shifting focus on mousedown's downstream
      // mouseup/click. Without this, the freshly mounted textarea is blurred
      // immediately and the overlay disappears before the user can type.
      event.evt.preventDefault();
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

  const handleStartEditText = useCallback((id: string) => {
    setEditingTextId(id);
  }, []);

  // Confirm an edit: apply the new text only if it differs from the
  // current value. Empty input is treated as "cancel" (preserve original)
  // — this is intentional and matches the create-flow's empty-string
  // semantics, so users cannot accidentally blank out a placed shape.
  const confirmEditText = (newText: string) => {
    if (editingTextId === null) {
      return;
    }
    if (newText.length === 0) {
      setEditingTextId(null);
      return;
    }
    const target = shapes.find((s) => s.id === editingTextId);
    if (target?.type === "text" && target.text !== newText) {
      onUpdateText(editingTextId, { text: newText });
    }
    setEditingTextId(null);
  };

  const cancelEditText = () => {
    setEditingTextId(null);
  };

  const className = isDraggingOver
    ? `${styles.canvasArea} ${styles.canvasAreaDragging}`
    : styles.canvasArea;

  const textInputScreen = textInput && fit && imageSize
    ? imageToScreen(textInput, fit, imageSize)
    : null;

  const editingShape: TextShape | null = editingTextId
    ? (shapes.find((s): s is TextShape => s.id === editingTextId && s.type === "text") ?? null)
    : null;
  const editingScreen = editingShape && fit && imageSize
    ? imageToScreen({ x: editingShape.x, y: editingShape.y }, fit, imageSize)
    : null;
  const editingFontSize = editingShape && fit && imageSize
    ? (() => {
      const { scaleX, scaleY } = imageToScreenScale(fit, imageSize);
      return (editingShape.fontSize ?? TEXT_FONT_SIZE) * Math.min(scaleX, scaleY);
    })()
    : undefined;

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
                    isSelected={shape.id === selectedShapeId}
                    isEditing={shape.id === editingTextId}
                    onSelect={onSelectShape}
                    onStartEditText={handleStartEditText}
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
                keepRatio={selectedShape?.type === "text"}
                enabledAnchors={enabledAnchors as string[]}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width >= 8 && newBox.height >= 8 ? newBox : oldBox}
              />
            </Layer>
            <Layer listening={false}>
              {draft && fit && imageSize
                ? renderDraft(draft, fit, imageSize, mosaicDraftColors)
                : null}
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
        : editingShape && editingScreen
        ? (
          // `key` forces remount when the edited shape changes so the
          // overlay's internal `useState(initialText)` is re-initialized.
          // Without it, switching to another text via double-click would
          // leak the previous value into the new edit session.
          <TextInputOverlay
            key={editingShape.id}
            x={editingScreen.x}
            y={editingScreen.y}
            color={editingShape.color}
            initialText={editingShape.text}
            fontSize={editingFontSize}
            onConfirm={confirmEditText}
            onCancel={cancelEditText}
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
