import { TEXT_STROKE_COLOR_BLACK, TEXT_STROKE_COLOR_WHITE } from "@/constants/shape";

export const TOOL_KINDS = ["select", "arrow", "rect", "text", "mosaic"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

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
