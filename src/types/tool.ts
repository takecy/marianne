export const TOOL_KINDS = ["select", "arrow", "rect", "text", "mosaic"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const COLOR_PRESETS = [
  { name: "red", hex: "#ef4444" },
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
