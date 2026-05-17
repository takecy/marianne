import type { MosaicShape, Shape } from "@/types/shape";

// Partition shapes into mosaic-first / others-second draw order. Stable within
// each group (creation order preserved). On-screen render (CanvasArea) and PNG
// export (exportImage) both consume this helper to guarantee identical z-order
// across the two rendering paths.
export function partitionShapesByMosaicFirst(shapes: Shape[]): {
  mosaics: MosaicShape[];
  others: Exclude<Shape, MosaicShape>[];
} {
  const mosaics: MosaicShape[] = [];
  const others: Exclude<Shape, MosaicShape>[] = [];
  for (const shape of shapes) {
    if (shape.type === "mosaic") {
      mosaics.push(shape);
    } else {
      others.push(shape);
    }
  }
  return { mosaics, others };
}
