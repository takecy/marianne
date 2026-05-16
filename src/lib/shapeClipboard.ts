import { clampToImage, type Size } from "@/lib/imageFit";
import type { Shape } from "@/types/shape";

export const PASTE_OFFSET = 20;

// Deep-clone a shape for paste: assign a new id and shift the anchor by
// PASTE_OFFSET (natural pixels). The anchor is clamped to image bounds so
// the new shape never starts outside the canvas; arrow endpoints preserve
// their relative delta to keep direction and length intact.
export function cloneShapeForPaste(source: Shape, imageSize: Size): Shape {
  const newId = crypto.randomUUID();
  switch (source.type) {
    case "rect":
    case "mosaic":
    case "text": {
      const anchor = clampToImage(
        { x: source.x + PASTE_OFFSET, y: source.y + PASTE_OFFSET },
        imageSize,
      );
      return { ...source, id: newId, x: anchor.x, y: anchor.y };
    }
    case "arrow": {
      const anchor = clampToImage(
        { x: source.fromX + PASTE_OFFSET, y: source.fromY + PASTE_OFFSET },
        imageSize,
      );
      const dx = source.toX - source.fromX;
      const dy = source.toY - source.fromY;
      return {
        ...source,
        id: newId,
        fromX: anchor.x,
        fromY: anchor.y,
        toX: anchor.x + dx,
        toY: anchor.y + dy,
      };
    }
  }
}
