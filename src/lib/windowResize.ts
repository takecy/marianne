import { isTauri } from "@tauri-apps/api/core";
import type { Monitor, PhysicalPosition, Window } from "@tauri-apps/api/window";

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

// Work area rectangle in physical pixels, as reported by `Monitor.workArea`.
export interface WorkAreaRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Pull the window back inside the work area. All values are physical pixels
// (`outerPosition` / `outerSize` / `Monitor.workArea`), so the outer size
// already includes the title bar and no decoration margin is needed. A window
// larger than the work area is aligned to its start so the top-left (title
// bar and toolbar) stays reachable.
export function computeWindowPosition(
  position: { x: number; y: number },
  outerSize: { width: number; height: number },
  workArea: WorkAreaRect,
): { x: number; y: number } {
  const clampAxis = (pos: number, size: number, start: number, extent: number): number => {
    if (size >= extent) return start;
    return Math.min(Math.max(pos, start), start + extent - size);
  };
  return {
    x: clampAxis(position.x, outerSize.width, workArea.x, workArea.width),
    y: clampAxis(position.y, outerSize.height, workArea.y, workArea.height),
  };
}

function physicalWorkArea(monitor: Monitor): WorkAreaRect {
  const { position, size } = monitor.workArea;
  return { x: position.x, y: position.y, width: size.width, height: size.height };
}

async function clampWindowWithin(
  win: Window,
  workArea: WorkAreaRect,
  PhysicalPositionCtor: typeof PhysicalPosition,
): Promise<void> {
  const [position, size] = await Promise.all([win.outerPosition(), win.outerSize()]);
  const next = computeWindowPosition(
    { x: position.x, y: position.y },
    { width: size.width, height: size.height },
    workArea,
  );
  if (next.x === position.x && next.y === position.y) return;
  await win.setPosition(new PhysicalPositionCtor(next.x, next.y));
}

// Correct a window position restored by tauri-plugin-window-state. The plugin
// restores the saved position whenever any corner of the saved rect lies on a
// connected monitor, so after unplugging an external display the title bar can
// end up off-screen. Called once on app mount.
export async function clampWindowToWorkArea(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    const { getCurrentWindow, currentMonitor, primaryMonitor, PhysicalPosition } = await import(
      "@tauri-apps/api/window"
    );
    const monitor = (await currentMonitor()) ?? (await primaryMonitor());
    if (!monitor) return;
    await clampWindowWithin(getCurrentWindow(), physicalWorkArea(monitor), PhysicalPosition);
  } catch (err) {
    console.warn("Window position clamp failed:", err);
  }
}

// Resize the window to fit the image while keeping its current position;
// it is only nudged back when the new size would overflow the work area.
export async function applyWindowSizeForImage(
  naturalWidth: number,
  naturalHeight: number,
): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    const { getCurrentWindow, currentMonitor, LogicalSize, PhysicalPosition } = await import(
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
    if (monitor) {
      await clampWindowWithin(win, physicalWorkArea(monitor), PhysicalPosition);
    }
  } catch (err) {
    console.warn("Window resize for image failed:", err);
  }
}
