import type { ArrowShape, DraftShape, RectShape, Shape } from "@/types/shape";
import type { ColorPresetName } from "@/types/tool";

const MIN_RECT_DIM = 2;
const MIN_ARROW_LENGTH = 4;

export function startDraft(
  tool: "rect" | "arrow",
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
  return {
    type: "arrow",
    color,
    fromX: point.x,
    fromY: point.y,
    toX: point.x,
    toY: point.y,
  };
}

export function moveDraft(draft: DraftShape, point: { x: number; y: number }): DraftShape {
  if (draft.type === "rect") {
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
