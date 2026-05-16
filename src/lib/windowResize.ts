import { isTauri } from "@tauri-apps/api/core";

// Occupied size of the UI chrome around the canvas (`box-sizing: content-box`).
// Sidebar: flex-basis 64 + padding 10*2 + border 1 = 85.
// ActionBar: flex-basis 44 + border 1 = 45.
// Keep in sync with src/components/Sidebar.module.css and ActionBar.module.css.
export const UI_CHROME = { sidebarWidth: 85, actionBarHeight: 45 } as const;

export const MIN_WINDOW = { width: 600, height: 400 } as const;

// `setSize` adjusts inner (content) size only. On macOS the native title bar
// adds ~28px on top, so a window whose inner height equals the work area
// would overflow vertically. Subtract a small margin from the height cap
// to keep the outer window inside the work area.
export const WINDOW_DECORATION_MARGIN = 40;

export interface MonitorWorkArea {
  width: number;
  height: number;
}

export function computeWindowSize(
  natural: { width: number; height: number },
  monitor: MonitorWorkArea | null,
  chrome: { sidebarWidth: number; actionBarHeight: number } = UI_CHROME,
  min: { width: number; height: number } = MIN_WINDOW,
  decorationMargin: number = WINDOW_DECORATION_MARGIN,
): { width: number; height: number } {
  let width = natural.width + chrome.sidebarWidth;
  let height = natural.height + chrome.actionBarHeight;

  if (monitor) {
    const maxHeight = Math.max(0, monitor.height - decorationMargin);
    if (width > monitor.width) width = monitor.width;
    if (height > maxHeight) height = maxHeight;
  }

  if (width < min.width) width = min.width;
  if (height < min.height) height = min.height;

  return { width: Math.round(width), height: Math.round(height) };
}

export async function applyWindowSizeForImage(
  naturalWidth: number,
  naturalHeight: number,
): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    const { getCurrentWindow, currentMonitor, LogicalSize } = await import(
      "@tauri-apps/api/window"
    );

    const monitor = await currentMonitor();
    let workArea: MonitorWorkArea | null = null;
    if (monitor) {
      const logical = monitor.workArea.size.toLogical(monitor.scaleFactor);
      workArea = { width: logical.width, height: logical.height };
    }

    const target = computeWindowSize(
      { width: naturalWidth, height: naturalHeight },
      workArea,
    );

    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(target.width, target.height));
    await win.center();
  } catch (err) {
    console.warn("Window resize for image failed:", err);
  }
}
