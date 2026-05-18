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
import type { CropRect } from "@/lib/cropImage";
import { defaultCropRect, MIN_CROP_DIM } from "@/lib/cropImage";
import { finalizeDraft, moveDraft, startDraft } from "@/lib/drawingGesture";
import {
  applyCenteredZoom,
  applyPointerCenteredZoom,
  DEFAULT_ZOOM_STATE,
  fitPointToStagePoint,
  nextZoomIn,
  nextZoomOut,
  stagePointToFitPoint,
  wheelDeltaToZoomFactor,
  type ZoomState,
} from "@/lib/zoomGesture";
import { splitMosaicByOverlap } from "@/lib/mosaicStrength";
import { partitionShapesByMosaicFirst } from "@/lib/shapeZOrder";
import { useThemeMode } from "@/lib/useThemeMode";
import { t } from "@/i18n/translate";
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
  // Batch variant used for mosaic stacking, where one drag may emit a base
  // shape plus per-overlap strength overlays as a single history transaction.
  onShapesAdded: (shapes: Shape[]) => void;
  onSelectShape: (id: string | null) => void;
  onDeleteShape: (id: string) => void;
  // Invoked when the user confirms a crop selection. The rect is in image
  // natural pixel space. App.tsx replaces the loaded image and resets shapes.
  onCropImage: (rect: CropRect) => void;
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
  // View-only canvas zoom state (Stage scaleX/scaleY/x/y). Owned by App so
  // StatusBar can display the current percentage. Reset to DEFAULT on image
  // swap via App's useEffect — CanvasArea never resets it directly.
  zoomState: ZoomState;
  onZoomChange: (next: ZoomState) => void;
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

// Returns the pointer position in fit-internal screen coordinates (i.e. the
// coordinate space `screenToImage` expects). `Stage.getPointerPosition()`
// returns canvas-absolute coords that DO NOT reflect Stage scale/x/y in
// Konva 10.x, so `stagePointToFitPoint` must be applied here for natural-
// space conversions to remain correct under view zoom. With DEFAULT_ZOOM_STATE
// this is the identity, preserving pre-zoom behavior exactly.
function getStagePointer(
  event: KonvaEventObject<MouseEvent>,
  zoom: ZoomState,
): Point | null {
  const stage = event.target.getStage();
  const pos = stage?.getPointerPosition();
  if (!pos) {
    return null;
  }
  return stagePointToFitPoint({ x: pos.x, y: pos.y }, zoom);
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
    onShapesAdded,
    onSelectShape,
    onDeleteShape,
    onCropImage,
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
    zoomState,
    onZoomChange,
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [textInput, setTextInput] = useState<Point | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  // Active crop selection rectangle (natural pixel space). null when crop mode
  // is not active. The rect node is rendered when this is non-null.
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const nodeMap = useRef<Map<string, Konva.Node>>(new Map());
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const cropRectRef = useRef<Konva.Rect | null>(null);
  const cropTransformerRef = useRef<Konva.Transformer | null>(null);
  const themeMode = useThemeMode();
  const mosaicDraftColors = themeMode === "dark"
    ? MOSAIC_DRAFT_COLORS_DARK
    : MOSAIC_DRAFT_COLORS_LIGHT;

  const isSelectMode = activeTool === "select";
  const isCropMode = activeTool === "crop";

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
    const prevTool = prevToolRef.current;
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
    // Initialise the crop selection on entry to crop mode; tear it down on
    // any exit (tool change, image swap). Using the render-time pattern keeps
    // this synchronous with the activeTool change so the Stage already sees
    // the right cropRect on its first render after the transition.
    if (activeTool === "crop" && prevTool !== "crop" && image) {
      setCropRect(
        defaultCropRect({ width: image.naturalWidth, height: image.naturalHeight }),
      );
    } else if (activeTool !== "crop" && cropRect !== null) {
      setCropRect(null);
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

  // Attach the crop transformer to the crop rectangle whenever the cropRect
  // mounts. Detach immediately when crop mode ends so a stale Transformer
  // pointing at a removed node does not throw on the next batchDraw.
  useEffect(() => {
    const transformer = cropTransformerRef.current;
    if (!transformer) {
      return;
    }
    const node = cropRectRef.current;
    if (isCropMode && cropRect !== null && node) {
      transformer.nodes([node]);
    } else {
      transformer.nodes([]);
    }
    transformer.getLayer()?.batchDraw();
  }, [isCropMode, cropRect]);

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

      // Crop mode: Enter confirms, Escape cancels. Handled before the generic
      // shortcuts so they never steal the keys.
      if (isCropMode && cropRect !== null) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (cropRect.width >= MIN_CROP_DIM && cropRect.height >= MIN_CROP_DIM) {
            onCropImage(cropRect);
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onToolChange("select");
          return;
        }
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

      // Cmd/Ctrl + + / - / 0 for view zoom. Both `=` (Cmd+= without shift)
      // and `+` (Cmd+Shift+= on US layouts) are accepted as zoom-in.
      // Ignored when no image is loaded — matches the disabled-toolbar pattern.
      if ((e.metaKey || e.ctrlKey) && (e.key === "+" || e.key === "=")) {
        if (image === null) return;
        e.preventDefault();
        onZoomChange(applyCenteredZoom(zoomState, size, nextZoomIn(zoomState.scale)));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        if (image === null) return;
        e.preventDefault();
        onZoomChange(applyCenteredZoom(zoomState, size, nextZoomOut(zoomState.scale)));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        if (image === null) return;
        e.preventDefault();
        onZoomChange(DEFAULT_ZOOM_STATE);
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
    isCropMode,
    cropRect,
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
    onCropImage,
    zoomState,
    onZoomChange,
    size,
  ]);

  const imageSize: FitSize | null = image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : null;
  const fit: FitRect | null = imageSize ? fitContain(imageSize, size) : null;

  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === selectedShapeId) ?? null,
    [shapes, selectedShapeId],
  );

  // Render mosaics first, then other shapes, so arrows / rects / text stay
  // visible on top of overlapping mosaics. Stable within each group; logical
  // order in the `shapes` array is unchanged (issue #51).
  const { mosaics, others } = useMemo(
    () => partitionShapesByMosaicFirst(shapes),
    [shapes],
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

    // In crop mode the only interactive node is the crop rectangle itself
    // (drag + transformer). Clicking elsewhere on the stage is a no-op so
    // accidental clicks do not exit the mode or start a fresh draft.
    if (isCropMode) {
      return;
    }

    const screen = getStagePointer(event, zoomState);
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
    const screen = getStagePointer(event, zoomState);
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
      if (shape.type === "mosaic") {
        // One mosaic drag may emit a base (level 1) plus per-overlap overlays.
        // splitMosaicByOverlap discards the draft's id and generates new ones
        // for every sub-shape; we wrap them in a single addShapes transaction
        // so undo rewinds the whole gesture in one step.
        onShapesAdded(splitMosaicByOverlap(shape, mosaics));
      } else {
        onShapeAdded(shape);
      }
    }
    setDraft(null);
  };

  // Trackpad pinch and Ctrl+wheel zoom. `ctrlKey` is true for both on macOS
  // WKWebView, where trackpad pinch is synthesized into wheel events with
  // ctrlKey=true. Plain scroll is ignored — pan is out of scope.
  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    if (!image) {
      return;
    }
    const native = event.evt;
    if (!native.ctrlKey) {
      return;
    }
    native.preventDefault();
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition() ?? { x: 0, y: 0 };
    const factor = wheelDeltaToZoomFactor(native.deltaY);
    onZoomChange(applyPointerCenteredZoom(zoomState, pointer, zoomState.scale * factor));
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

  // Screen-space coordinates of the active crop selection, derived from the
  // natural-space cropRect. Used for Konva node positioning and for placing
  // the Confirm / Cancel overlay buttons.
  const cropScreenRect = cropRect && fit && imageSize
    ? (() => {
      const tl = imageToScreen({ x: cropRect.x, y: cropRect.y }, fit, imageSize);
      const { scaleX, scaleY } = imageToScreenScale(fit, imageSize);
      return {
        x: tl.x,
        y: tl.y,
        width: cropRect.width * scaleX,
        height: cropRect.height * scaleY,
      };
    })()
    : null;

  const cropConfirmDisabled = cropRect === null ||
    cropRect.width < MIN_CROP_DIM ||
    cropRect.height < MIN_CROP_DIM;

  const handleCropConfirm = () => {
    if (cropRect === null || cropConfirmDisabled) return;
    onCropImage(cropRect);
  };

  const handleCropCancel = () => {
    onToolChange("select");
  };

  return (
    <div ref={containerRef} className={className} aria-label={t("canvas.label")}>
      {size.width > 0 && size.height > 0
        ? (
          <Stage
            width={size.width}
            height={size.height}
            scaleX={zoomState.scale}
            scaleY={zoomState.scale}
            x={zoomState.offsetX}
            y={zoomState.offsetY}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
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
                ? (
                  <>
                    {mosaics.map((shape) => (
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
                        onAddShape={onShapeAdded}
                        onUpdateRect={onUpdateRect}
                        onUpdateText={onUpdateText}
                        onUpdateArrow={onUpdateArrow}
                        onUpdateMosaic={onUpdateMosaic}
                        registerNode={registerNode}
                      />
                    ))}
                    {others.map((shape) => (
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
                        onAddShape={onShapeAdded}
                        onUpdateRect={onUpdateRect}
                        onUpdateText={onUpdateText}
                        onUpdateArrow={onUpdateArrow}
                        onUpdateMosaic={onUpdateMosaic}
                        registerNode={registerNode}
                      />
                    ))}
                  </>
                )
                : null}
              <Transformer
                ref={transformerRef}
                rotateEnabled={false}
                flipEnabled={false}
                keepRatio={selectedShape?.type === "text"}
                enabledAnchors={enabledAnchors as string[]}
                boundBoxFunc={(oldBox, newBox) => {
                  // newBox dimensions are in Stage-absolute coords. Compare
                  // against the 8px minimum in fit-internal space so the
                  // threshold remains consistent at any view zoom level.
                  const fitWidth = newBox.width / zoomState.scale;
                  const fitHeight = newBox.height / zoomState.scale;
                  return fitWidth >= 8 && fitHeight >= 8 ? newBox : oldBox;
                }}
              />
            </Layer>
            <Layer listening={false}>
              {draft && fit && imageSize
                ? renderDraft(draft, fit, imageSize, mosaicDraftColors)
                : null}
            </Layer>
            <Layer listening={isCropMode}>
              {isCropMode && cropScreenRect && cropRect && fit && imageSize
                ? (
                  <>
                    {
                      /* Dim mask: four strips covering everything outside the
                        crop rectangle (within the image fit area). Non-interactive. */
                    }
                    <Rect
                      x={fit.x}
                      y={fit.y}
                      width={fit.width}
                      height={Math.max(0, cropScreenRect.y - fit.y)}
                      fill="rgba(0,0,0,0.5)"
                      listening={false}
                    />
                    <Rect
                      x={fit.x}
                      y={cropScreenRect.y + cropScreenRect.height}
                      width={fit.width}
                      height={Math.max(
                        0,
                        fit.y + fit.height - (cropScreenRect.y + cropScreenRect.height),
                      )}
                      fill="rgba(0,0,0,0.5)"
                      listening={false}
                    />
                    <Rect
                      x={fit.x}
                      y={cropScreenRect.y}
                      width={Math.max(0, cropScreenRect.x - fit.x)}
                      height={cropScreenRect.height}
                      fill="rgba(0,0,0,0.5)"
                      listening={false}
                    />
                    <Rect
                      x={cropScreenRect.x + cropScreenRect.width}
                      y={cropScreenRect.y}
                      width={Math.max(
                        0,
                        fit.x + fit.width - (cropScreenRect.x + cropScreenRect.width),
                      )}
                      height={cropScreenRect.height}
                      fill="rgba(0,0,0,0.5)"
                      listening={false}
                    />
                    <Rect
                      ref={cropRectRef}
                      x={cropScreenRect.x}
                      y={cropScreenRect.y}
                      width={cropScreenRect.width}
                      height={cropScreenRect.height}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      draggable
                      dragBoundFunc={(pos) => {
                        // `pos` is in Stage-absolute coordinates (post Stage
                        // transform), not the fit-internal space `fit.x..` uses.
                        // Round-trip through fit-internal space so the clamp
                        // works correctly at any zoom level.
                        const fitPos = stagePointToFitPoint(pos, zoomState);
                        const maxX = fit.x + fit.width - cropScreenRect.width;
                        const maxY = fit.y + fit.height - cropScreenRect.height;
                        const clamped = {
                          x: Math.max(fit.x, Math.min(maxX, fitPos.x)),
                          y: Math.max(fit.y, Math.min(maxY, fitPos.y)),
                        };
                        return fitPointToStagePoint(clamped, zoomState);
                      }}
                      onDragEnd={(e) => {
                        const node = e.target;
                        const naturalPos = screenToImage(
                          { x: node.x(), y: node.y() },
                          fit,
                          imageSize,
                        );
                        setCropRect({
                          x: Math.round(naturalPos.x),
                          y: Math.round(naturalPos.y),
                          width: cropRect.width,
                          height: cropRect.height,
                        });
                      }}
                      onTransformEnd={(e) => {
                        const node = e.target as Konva.Rect;
                        const newWidthScreen = node.width() * node.scaleX();
                        const newHeightScreen = node.height() * node.scaleY();
                        const naturalPos = screenToImage(
                          { x: node.x(), y: node.y() },
                          fit,
                          imageSize,
                        );
                        const { scaleX: imgScaleX, scaleY: imgScaleY } = imageToScreenScale(
                          fit,
                          imageSize,
                        );
                        // Reset scale on the node so the next React-driven
                        // render reads our rounded natural-space dimensions
                        // without Konva re-applying scale on top.
                        node.scaleX(1);
                        node.scaleY(1);
                        setCropRect({
                          x: Math.round(naturalPos.x),
                          y: Math.round(naturalPos.y),
                          width: Math.round(newWidthScreen / imgScaleX),
                          height: Math.round(newHeightScreen / imgScaleY),
                        });
                      }}
                    />
                    <Transformer
                      ref={cropTransformerRef}
                      rotateEnabled={false}
                      flipEnabled={false}
                      enabledAnchors={RESIZE_ANCHORS as string[]}
                      boundBoxFunc={(oldBox, newBox) => {
                        // `newBox.{x,y,width,height}` are in Stage-absolute
                        // coords. Convert to fit-internal space before applying
                        // the existing image-range and MIN_CROP_DIM constraints
                        // (which are themselves expressed in fit-internal /
                        // natural-pixel units). zoom=DEFAULT is the identity.
                        const topLeft = stagePointToFitPoint(
                          { x: newBox.x, y: newBox.y },
                          zoomState,
                        );
                        const fitWidth = newBox.width / zoomState.scale;
                        const fitHeight = newBox.height / zoomState.scale;
                        if (fitWidth < MIN_CROP_DIM || fitHeight < MIN_CROP_DIM) {
                          return oldBox;
                        }
                        if (topLeft.x < fit.x - 0.5 || topLeft.y < fit.y - 0.5) {
                          return oldBox;
                        }
                        if (
                          topLeft.x + fitWidth > fit.x + fit.width + 0.5 ||
                          topLeft.y + fitHeight > fit.y + fit.height + 0.5
                        ) {
                          return oldBox;
                        }
                        return newBox;
                      }}
                    />
                  </>
                )
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
      {isCropMode && cropScreenRect
        ? (() => {
          // cropScreenRect is in fit-internal screen coords. Stage zoom
          // transform applies to Konva nodes but not to DOM overlays, so
          // convert the rect's bottom-left to viewport (DOM) coords via
          // fitPointToStagePoint. The 8px gap is added AFTER the transform
          // so it stays at UI scale instead of being multiplied by zoom.
          const cropDomAnchor = fitPointToStagePoint(
            { x: cropScreenRect.x, y: cropScreenRect.y + cropScreenRect.height },
            zoomState,
          );
          return (
            <div
              className={styles.cropOverlay}
              style={{
                left: cropDomAnchor.x,
                top: cropDomAnchor.y + 8,
              }}
            >
              <button
                type="button"
                className={`${styles.cropButton} ${styles.cropButtonConfirm}`}
                onClick={handleCropConfirm}
                disabled={cropConfirmDisabled}
                aria-label={t("crop.confirm.label")}
                title={t("crop.confirm.title")}
              >
                {t("crop.confirm.label")}
              </button>
              <button
                type="button"
                className={styles.cropButton}
                onClick={handleCropCancel}
                aria-label={t("crop.cancel.label")}
                title={t("crop.cancel.title")}
              >
                {t("crop.cancel.label")}
              </button>
            </div>
          );
        })()
        : null}
      {image === null
        ? (
          <div className={styles.emptyState} aria-hidden={false}>
            <div className={styles.emptyStateInner}>
              <p className={styles.emptyStateTitle}>{t("canvas.empty.title")}</p>
              <p className={styles.emptyStateBody}>{t("canvas.empty.message")}</p>
            </div>
          </div>
        )
        : null}
    </div>
  );
}
