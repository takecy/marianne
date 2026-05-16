import { computeWindowSize, MIN_WINDOW, UI_CHROME, WINDOW_DECORATION_MARGIN } from "./windowResize";

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
    const size = computeWindowSize(
      { width: 900, height: 990 },
      { width: 1200, height: 1000 },
    );
    expect(size.width).toBe(985);
    expect(size.height).toBe(960);
  });

  it("rounds the result to integers for LogicalSize compatibility", () => {
    // monitor with a fractional logical height (e.g. retina with scaleFactor 1.5)
    const size = computeWindowSize(
      { width: 1500, height: 850 },
      { width: 1366.6, height: 768.4 },
    );
    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });
});
