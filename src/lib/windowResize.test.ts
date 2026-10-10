import {
  computeWindowPosition,
  computeWindowSize,
  MIN_WINDOW,
  UI_CHROME,
  WINDOW_DECORATION_MARGIN,
} from "./windowResize";

describe("computeWindowSize", () => {
  const largeMonitor = { width: 2000, height: 1400 };

  it("returns natural + chrome when the image fits inside the monitor and exceeds min", () => {
    const size = computeWindowSize({ width: 1200, height: 700 }, largeMonitor);
    expect(size).toEqual({
      width: 1200 + UI_CHROME.sidebarWidth,
      height: 700 + UI_CHROME.actionBarHeight,
    });
  });

  it("clamps up to the minimum window size for small images", () => {
    const size = computeWindowSize({ width: 200, height: 100 }, largeMonitor);
    expect(size).toEqual(MIN_WINDOW);
  });

  it("clamps down to the monitor work area for huge images", () => {
    const size = computeWindowSize({ width: 4000, height: 3000 }, largeMonitor);
    expect(size).toEqual({
      width: largeMonitor.width,
      height: largeMonitor.height - WINDOW_DECORATION_MARGIN,
    });
  });

  it("falls back to min/chrome when monitor is null (e.g. currentMonitor() failed)", () => {
    const size = computeWindowSize({ width: 4000, height: 3000 }, null);
    expect(size).toEqual({
      width: 4000 + UI_CHROME.sidebarWidth,
      height: 3000 + UI_CHROME.actionBarHeight,
    });
  });

  it("subtracts the decoration margin from the height cap to keep outer window inside work area", () => {
    // natural+chrome = (900+85, 990+45) = (985, 1035)
    // work area height 1000, margin 40 → height cap is 960
    const size = computeWindowSize({ width: 900, height: 990 }, { width: 1200, height: 1000 });
    expect(size.width).toBe(985);
    expect(size.height).toBe(960);
  });

  it("rounds the result to integers for LogicalSize compatibility", () => {
    // monitor with a fractional logical height (e.g. retina with scaleFactor 1.5)
    const size = computeWindowSize({ width: 1500, height: 850 }, { width: 1366.6, height: 768.4 });
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });
});

describe("computeWindowPosition", () => {
  // Physical px. y starts below a 50px menu bar.
  const workArea = { x: 0, y: 50, width: 2000, height: 1200 };

  it("keeps the position when the window already fits inside the work area", () => {
    const pos = computeWindowPosition({ x: 300, y: 200 }, { width: 800, height: 600 }, workArea);
    expect(pos).toEqual({ x: 300, y: 200 });
  });

  it("pushes the window back when it overflows the right and bottom edges", () => {
    // right edge 1800+800 = 2600 > 2000, bottom 900+600 = 1500 > 1250
    const pos = computeWindowPosition({ x: 1800, y: 900 }, { width: 800, height: 600 }, workArea);
    expect(pos).toEqual({ x: 2000 - 800, y: 50 + 1200 - 600 });
  });

  it("aligns to the work area start when it overflows the left and top edges", () => {
    // negative y means the title bar sits above the screen (e.g. an unplugged monitor)
    const pos = computeWindowPosition({ x: -300, y: -700 }, { width: 800, height: 600 }, workArea);
    expect(pos).toEqual({ x: 0, y: 50 });
  });

  it("aligns to the work area start when the window is larger than the work area", () => {
    const pos = computeWindowPosition({ x: 500, y: 400 }, { width: 2400, height: 1500 }, workArea);
    expect(pos).toEqual({ x: 0, y: 50 });
  });

  it("clamps against a secondary monitor whose work area origin is not (0, 0)", () => {
    // monitor placed to the left of the primary display
    const secondary = { x: -1920, y: 25, width: 1920, height: 1055 };
    const pos = computeWindowPosition({ x: -500, y: 600 }, { width: 800, height: 600 }, secondary);
    expect(pos).toEqual({ x: -800, y: 25 + 1055 - 600 });
  });
});
