import type { ColorPresetName, StrokeWidthPresetName } from "./tool";

// All coordinates are stored in image natural pixel space
// (0,0 = image top-left, max = image naturalWidth/Height).
// CanvasArea converts to screen coordinates via imageToScreen at render time.

export interface ShapeBase {
  id: string;
}

export interface RectShape extends ShapeBase {
  type: "rect";
  color: ColorPresetName;
  x: number;
  y: number;
  width: number;
  height: number;
  // Optional for backward compatibility: rects created before this field was
  // introduced (e.g. older test fixtures) resolve to "thick" at render time,
  // which equals the previous SHAPE_STROKE_WIDTH = 18 behaviour.
  strokeWidth?: StrokeWidthPresetName;
}

export interface TextShape extends ShapeBase {
  type: "text";
  color: ColorPresetName;
  x: number;
  y: number;
  text: string;
  fontSize?: number;
}

export interface ArrowShape extends ShapeBase {
  type: "arrow";
  color: ColorPresetName;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

// MosaicShape intentionally has no `color` field — pixelation is not coloured.
export interface MosaicShape extends ShapeBase {
  type: "mosaic";
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Shape = RectShape | TextShape | ArrowShape | MosaicShape;

export type DraftShape =
  | {
    type: "rect";
    color: ColorPresetName;
    strokeWidth: StrokeWidthPresetName;
    x: number;
    y: number;
    width: number;
    height: number;
  }
  | {
    type: "arrow";
    color: ColorPresetName;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  }
  | {
    type: "mosaic";
    x: number;
    y: number;
    width: number;
    height: number;
  };
