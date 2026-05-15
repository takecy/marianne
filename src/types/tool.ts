export const TOOL_KINDS = ["arrow", "rect", "text", "mosaic"] as const;
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
