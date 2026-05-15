import type { ArrowShape, DraftShape, MosaicShape, RectShape, Shape } from "@/types/shape";
import type { ColorPresetName } from "@/types/tool";

const MIN_RECT_DIM = 2;
const MIN_ARROW_LENGTH = 4;
const MIN_MOSAIC_DIM = 4;

export function startDraft(
  tool: "rect" | "arrow" | "mosaic",
  color: ColorPresetName,
  point: { x: number; y: number },
): DraftShape {
  if (tool === "rect") {
    return {
      type: "rect",
      color,
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    };
  }
  if (tool === "arrow") {
    return {
      type: "arrow",
      color,
      fromX: point.x,
      fromY: point.y,
      toX: point.x,
      toY: point.y,
    };
  }
  // mosaic: color is accepted in the signature for call-site uniformity but
  // intentionally not stored on the resulting shape.
  return {
    type: "mosaic",
    x: point.x,
    y: point.y,
    width: 0,
    height: 0,
  };
}

export function moveDraft(draft: DraftShape, point: { x: number; y: number }): DraftShape {
  if (draft.type === "rect" || draft.type === "mosaic") {
    return {
      ...draft,
      width: point.x - draft.x,
      height: point.y - draft.y,
    };
  }
  return {
    ...draft,
    toX: point.x,
    toY: point.y,
  };
}

export function finalizeDraft(
  draft: DraftShape,
  idGen: () => string = () => crypto.randomUUID(),
): Shape | null {
  if (draft.type === "rect") {
    const width = Math.abs(draft.width);
    const height = Math.abs(draft.height);
    if (width < MIN_RECT_DIM || height < MIN_RECT_DIM) {
      return null;
    }
    const x = Math.min(draft.x, draft.x + draft.width);
    const y = Math.min(draft.y, draft.y + draft.height);
    const rect: RectShape = {
      id: idGen(),
      type: "rect",
      color: draft.color,
      x,
      y,
      width,
      height,
    };
    return rect;
  }
  if (draft.type === "mosaic") {
    const width = Math.abs(draft.width);
    const height = Math.abs(draft.height);
    if (width < MIN_MOSAIC_DIM || height < MIN_MOSAIC_DIM) {
      return null;
    }
    const x = Math.min(draft.x, draft.x + draft.width);
    const y = Math.min(draft.y, draft.y + draft.height);
    const mosaic: MosaicShape = {
      id: idGen(),
      type: "mosaic",
      x,
      y,
      width,
      height,
    };
    return mosaic;
  }
  const dx = draft.toX - draft.fromX;
  const dy = draft.toY - draft.fromY;
  const length = Math.hypot(dx, dy);
  if (length < MIN_ARROW_LENGTH) {
    return null;
  }
  const arrow: ArrowShape = {
    id: idGen(),
    type: "arrow",
    color: draft.color,
    fromX: draft.fromX,
    fromY: draft.fromY,
    toX: draft.toX,
    toY: draft.toY,
  };
  return arrow;
}
