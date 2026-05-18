import type { Point, Size } from "@/lib/imageFit";

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
