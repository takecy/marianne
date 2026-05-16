// Lightweight localStorage wrappers for persisted user settings.
// Each helper is wrapped in try/catch so jsdom/SSR or quota-exceeded
// environments do not crash the app — a missing or unreadable setting simply
// falls back to undefined and a failing write is silently dropped.

import { COLOR_PRESETS, type ColorPresetName } from "@/types/tool";

const LAST_SAVE_DIRECTORY_KEY = "marianne.lastSaveDir";
const LAST_SELECTED_COLOR_KEY = "marianne.lastSelectedColor";

export function loadLastSaveDirectory(): string | undefined {
  try {
    const value = localStorage.getItem(LAST_SAVE_DIRECTORY_KEY);
    return value ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveLastSaveDirectory(dir: string): void {
  try {
    localStorage.setItem(LAST_SAVE_DIRECTORY_KEY, dir);
  } catch {
    // quota exceeded, disabled storage, or running in a non-DOM context.
  }
}

// Runtime allow-list derived from COLOR_PRESETS — the authoritative source.
// Removing a preset there automatically invalidates any stored value pointing
// to it on the next load.
const COLOR_PRESET_NAMES: ReadonlySet<ColorPresetName> = new Set(
  COLOR_PRESETS.map((preset) => preset.name),
);

function isColorPresetName(value: unknown): value is ColorPresetName {
  return typeof value === "string" && COLOR_PRESET_NAMES.has(value as ColorPresetName);
}

export function loadLastSelectedColor(): ColorPresetName | undefined {
  try {
    const value = localStorage.getItem(LAST_SELECTED_COLOR_KEY);
    return isColorPresetName(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function saveLastSelectedColor(name: ColorPresetName): void {
  try {
    localStorage.setItem(LAST_SELECTED_COLOR_KEY, name);
  } catch {
    // quota exceeded, disabled storage, or running in a non-DOM context.
  }
}
