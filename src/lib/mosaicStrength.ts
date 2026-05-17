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

export function computeMosaicStrengthLevel(
  newRect: AABB,
  existingMosaics: readonly MosaicShape[],
): number {
  let maxOverlappingLevel = 0;
  for (const mosaic of existingMosaics) {
    if (aabbOverlap(newRect, mosaic)) {
      maxOverlappingLevel = Math.max(maxOverlappingLevel, mosaic.strengthLevel ?? 1);
    }
  }
  return maxOverlappingLevel + 1;
}

// Strict inequality: edge-only contact does not count as overlap. This keeps
// adjacent (non-overlapping) mosaics at their own independent strength.
function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;
}
