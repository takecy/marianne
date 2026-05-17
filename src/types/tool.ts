import { TEXT_STROKE_COLOR_BLACK, TEXT_STROKE_COLOR_WHITE } from "@/constants/shape";

export const TOOL_KINDS = ["select", "arrow", "rect", "text", "mosaic"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const TOOL_SHORTCUTS: Record<ToolKind, string> = {
  select: "v",
  arrow: "a",
  rect: "r",
  text: "t",
  mosaic: "m",
};

export const COLOR_PRESETS = [
  { name: "red", hex: "#ef4444" },
  { name: "orange", hex: "#f97316" },
  { name: "blue", hex: "#3b82f6" },
  { name: "green", hex: "#22c55e" },
  { name: "yellow", hex: "#eab308" },
  { name: "pink", hex: "#ec4899" },
  { name: "black", hex: "#0f172a" },
  { name: "white", hex: "#f8fafc" },
] as const;

export type ColorPresetName = (typeof COLOR_PRESETS)[number]["name"];

const COLOR_HEX_MAP: Record<ColorPresetName, string> = {
  red: "#ef4444",
  orange: "#f97316",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#eab308",
  pink: "#ec4899",
  black: "#0f172a",
  white: "#f8fafc",
};

export function colorHex(name: ColorPresetName): string {
  return COLOR_HEX_MAP[name];
}

// Pick the text outline color that gives the best contrast for a given text
// fill color. Dark text fills (red / blue / black) get a white outline so the
// glyphs read against dark backgrounds; lighter fills use the black outline.
export function textStrokeColorFor(name: ColorPresetName): string {
  if (name === "red" || name === "blue" || name === "black") {
    return TEXT_STROKE_COLOR_WHITE;
  }
  return TEXT_STROKE_COLOR_BLACK;
}

// Stroke width presets for rect shapes. The same numeric value is interpreted as
// image-natural pixels in export (exportImage.ts uses a natural-sized stage) and
// as screen pixels in on-canvas rendering (SelectableShape / CanvasArea.renderDraft
// do not multiply by imgScaleX). "thick" preserves the legacy SHAPE_STROKE_WIDTH = 18
// behaviour exactly so rects with `strokeWidth` undefined (defaulted to "thick")
// remain visually identical to the pre-preset rendering.
export const STROKE_WIDTH_PRESETS = [
  { name: "thin", value: 6 },
  { name: "medium", value: 12 },
  { name: "thick", value: 18 },
  { name: "extraThick", value: 28 },
] as const;

export type StrokeWidthPresetName = (typeof STROKE_WIDTH_PRESETS)[number]["name"];

const STROKE_WIDTH_VALUE_MAP: Record<StrokeWidthPresetName, number> = {
  thin: 6,
  medium: 12,
  thick: 18,
  extraThick: 28,
};

export function strokeWidthValue(name: StrokeWidthPresetName): number {
  return STROKE_WIDTH_VALUE_MAP[name];
}
