import { imageToScreen } from "@/lib/imageFit";
import type { FitRect, Point, Size } from "@/lib/imageFit";

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8.0;
export const DEFAULT_ZOOM = 1.0;
export const ZOOM_STEP = 1.25;

export interface ZoomState {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export const DEFAULT_ZOOM_STATE: ZoomState = {
  scale: DEFAULT_ZOOM,
  offsetX: 0,
  offsetY: 0,
};

const WHEEL_ZOOM_SPEED = 0.01;

export function wheelDeltaToZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * WHEEL_ZOOM_SPEED);
}

export function clampZoomScale(scale: number): number {
  if (!Number.isFinite(scale)) {
    return DEFAULT_ZOOM;
  }
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
}

// Anchor zoom around `pointerScreen` (canvas-absolute coords from
// `Stage.getPointerPosition()` — Konva 10.x does NOT apply Stage scale/x/y here).
// The natural-space point under the pointer is preserved across the zoom change.
export function applyPointerCenteredZoom(
  current: ZoomState,
  pointerScreen: Point,
  nextScale: number,
): ZoomState {
  const clamped = clampZoomScale(nextScale);
  if (current.scale <= 0) {
    return { scale: clamped, offsetX: 0, offsetY: 0 };
  }
  const fitX = (pointerScreen.x - current.offsetX) / current.scale;
  const fitY = (pointerScreen.y - current.offsetY) / current.scale;
  return {
    scale: clamped,
    offsetX: pointerScreen.x - fitX * clamped,
    offsetY: pointerScreen.y - fitY * clamped,
  };
}

export function applyCenteredZoom(
  current: ZoomState,
  stageSize: Size,
  nextScale: number,
): ZoomState {
  return applyPointerCenteredZoom(
    current,
    { x: stageSize.width / 2, y: stageSize.height / 2 },
    nextScale,
  );
}

export function nextZoomIn(scale: number): number {
  return clampZoomScale(scale * ZOOM_STEP);
}

export function nextZoomOut(scale: number): number {
  return clampZoomScale(scale / ZOOM_STEP);
}

// Stage-absolute -> fit-internal screen coords (inverse of Stage scale/x/y).
// Use before passing pointer coords to `screenToImage()` so natural-space
// coordinates remain unaffected by view zoom.
export function stagePointToFitPoint(stageAbsolute: Point, zoom: ZoomState): Point {
  if (zoom.scale <= 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: (stageAbsolute.x - zoom.offsetX) / zoom.scale,
    y: (stageAbsolute.y - zoom.offsetY) / zoom.scale,
  };
}

// Inverse of `stagePointToFitPoint`. Used inside Konva `dragBoundFunc(pos)` and
// `Transformer.boundBoxFunc(oldBox, newBox)` to convert clamped fit-internal
// coords back to absolute coords expected by those callbacks.
export function fitPointToStagePoint(fitPoint: Point, zoom: ZoomState): Point {
  return {
    x: zoom.offsetX + zoom.scale * fitPoint.x,
    y: zoom.offsetY + zoom.scale * fitPoint.y,
  };
}

// Natural image-space -> DOM viewport coords. Composes `imageToScreen`
// (natural -> fit-internal screen) with `fitPointToStagePoint`
// (fit-internal -> Stage-absolute). Use for placing DOM overlays
// (e.g. <textarea>) whose visible position must match Konva-rendered
// shapes across view zoom. Konva nodes inside the Stage receive the
// scale/x/y transform automatically; DOM siblings outside do not.
export function naturalToDomScreen(
  natural: Point,
  fit: FitRect,
  imageSize: Size,
  zoom: ZoomState,
): Point {
  return fitPointToStagePoint(imageToScreen(natural, fit, imageSize), zoom);
}

// Constrain a ZoomState's offset so the image cannot escape the Stage.
// Per-axis behavior:
//   - boundsRange [minOffset, maxOffset] where
//       minOffset = stageSize - (fit + fit.size) * scale  (image right/bottom edge glued to Stage)
//       maxOffset = -fit * scale                          (image left/top edge glued to Stage)
//   - When the image overflows the Stage on this axis (minOffset <= maxOffset),
//     clamp into boundsRange (hard clamp).
//   - When the image fits within the Stage (minOffset > maxOffset), the
//     containment range [maxOffset, minOffset] is inverted; preserve the
//     offset when it already lies inside, otherwise minimally correct it
//     to the nearest containmentRange edge using
//     `Math.max(maxOffset, Math.min(minOffset, offset))`.
// Pure and idempotent: a state already in range round-trips unchanged.
//
// The "two-finger swipe is a no-op while the image fits" UX requirement is
// enforced at the call site (handleWheel pan branch zeros the wheel delta
// on a fit axis), not here, so this function stays a single-mode contract.
export function clampPan(zoom: ZoomState, stageSize: Size, fit: FitRect): ZoomState {
  const minOffsetX = stageSize.width - (fit.x + fit.width) * zoom.scale;
  const maxOffsetX = -fit.x * zoom.scale;
  const offsetX = minOffsetX <= maxOffsetX
    ? Math.max(minOffsetX, Math.min(maxOffsetX, zoom.offsetX))
    : Math.max(maxOffsetX, Math.min(minOffsetX, zoom.offsetX));

  const minOffsetY = stageSize.height - (fit.y + fit.height) * zoom.scale;
  const maxOffsetY = -fit.y * zoom.scale;
  const offsetY = minOffsetY <= maxOffsetY
    ? Math.max(minOffsetY, Math.min(maxOffsetY, zoom.offsetY))
    : Math.max(maxOffsetY, Math.min(minOffsetY, zoom.offsetY));

  return { scale: zoom.scale, offsetX, offsetY };
}
