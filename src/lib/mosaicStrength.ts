import { MOSAIC_NATURAL_PIXEL_SIZE } from "@/components/MosaicNode";
import type { MosaicShape } from "@/types/shape";

// Additional natural-pixel block size contributed by each stacking level above
// 1. level=1 -> 24, level=2 -> 36, level=3 -> 48, ... Linear growth (24*level)
// reaches unusable coarseness too quickly; additive growth gives users a
// predictable "one more notch" feeling.
export const MOSAIC_PIXEL_INCREMENT = 12;

interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function mosaicPixelSize(strengthLevel: number | undefined): number {
  const level = strengthLevel ?? 1;
  return MOSAIC_NATURAL_PIXEL_SIZE + MOSAIC_PIXEL_INCREMENT * (level - 1);
}

// Splits one user-drawn mosaic into a base shape plus per-overlap "stronger"
// overlay shapes. Each overlay covers only the intersection with one existing
// mosaic and renders at that existing mosaic's level + 1. The non-overlapping
// portion of the drag stays at level 1 via the base shape, so users only see
// the strength bump where they actually re-mosaic'd an existing region.
//
// Overlays are returned in ascending level order. Callers must append them in
// that order so that, where two overlays themselves overlap, the higher-level
// one renders on top and dominates the visual result.
export function splitMosaicByOverlap(
  draft: AABB,
  existingMosaics: readonly MosaicShape[],
  idGen: () => string = () => crypto.randomUUID(),
): MosaicShape[] {
  const base: MosaicShape = {
    id: idGen(),
    type: "mosaic",
    x: draft.x,
    y: draft.y,
    width: draft.width,
    height: draft.height,
    strengthLevel: 1,
  };

  const overlays: MosaicShape[] = [];
  for (const existing of existingMosaics) {
    const intersection = intersectRect(draft, existing);
    if (intersection === null) {
      continue;
    }
    overlays.push({
      id: idGen(),
      type: "mosaic",
      x: intersection.x,
      y: intersection.y,
      width: intersection.width,
      height: intersection.height,
      strengthLevel: (existing.strengthLevel ?? 1) + 1,
    });
  }
  overlays.sort((a, b) => (a.strengthLevel ?? 1) - (b.strengthLevel ?? 1));

  return [base, ...overlays];
}

// Strict inequality: edge-only contact does not produce an intersection. This
// keeps adjacent (non-overlapping) mosaics at their own independent strength.
function intersectRect(a: AABB, b: AABB): AABB | null {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x1 >= x2 || y1 >= y2) {
    return null;
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}
