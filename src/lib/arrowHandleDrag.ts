// Pure helpers for the arrow endpoint drag handles. No React, no Konva — so
// the behavioral contract can be exercised under Vitest without a DOM.
//
// The handles live on a selected arrow in select mode. Dragging the "from"
// or "to" handle moves only that endpoint while the other endpoint stays
// pinned. ArrowShapeNode wires these helpers up to Konva drag events.

import type { ArrowGeometryOptions, Point } from "@/lib/arrowGeometry";
import { computeArrowPolygon } from "@/lib/arrowGeometry";
import type { FitRect, Size } from "@/lib/imageFit";
import { clampToImage, screenToImage } from "@/lib/imageFit";

export type ArrowEndpoint = "from" | "to";

// Live preview polygon used during a drag. `movedScreen` is the new screen
// position of the endpoint being dragged; `fixedScreen` is the other endpoint
// (unchanged for the duration of the gesture). Returns the flat number[] that
// callers can write into Konva.Line `points`.
export function previewArrowPolygon(
  which: ArrowEndpoint,
  movedScreen: Point,
  fixedScreen: Point,
  opts: ArrowGeometryOptions,
): number[] {
  if (which === "from") {
    return computeArrowPolygon(movedScreen, fixedScreen, opts);
  }
  return computeArrowPolygon(fixedScreen, movedScreen, opts);
}

export interface ArrowFromPatch {
  fromX: number;
  fromY: number;
}
export interface ArrowToPatch {
  toX: number;
  toY: number;
}

// Patch built at drag end. Converts the handle's screen position back into
// image-natural space and clamps to the image bounds so endpoints can never
// be persisted outside the picture.
export function commitArrowEndpoint(
  which: "from",
  screenPoint: Point,
  fit: FitRect,
  imageSize: Size,
): ArrowFromPatch;
export function commitArrowEndpoint(
  which: "to",
  screenPoint: Point,
  fit: FitRect,
  imageSize: Size,
): ArrowToPatch;
export function commitArrowEndpoint(
  which: ArrowEndpoint,
  screenPoint: Point,
  fit: FitRect,
  imageSize: Size,
): ArrowFromPatch | ArrowToPatch {
  const img = clampToImage(screenToImage(screenPoint, fit, imageSize), imageSize);
  if (which === "from") {
    return { fromX: img.x, fromY: img.y };
  }
  return { toX: img.x, toY: img.y };
}
