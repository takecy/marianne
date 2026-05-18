import {
  applyCenteredZoom,
  applyPointerCenteredZoom,
  clampZoomScale,
  DEFAULT_ZOOM,
  DEFAULT_ZOOM_STATE,
  fitPointToStagePoint,
  MAX_ZOOM,
  MIN_ZOOM,
  nextZoomIn,
  nextZoomOut,
  stagePointToFitPoint,
  wheelDeltaToZoomFactor,
  ZOOM_STEP,
  type ZoomState,
} from "./zoomGesture";

describe("wheelDeltaToZoomFactor", () => {
  it("returns >1 for negative deltaY (pinch-in zooms in)", () => {
    expect(wheelDeltaToZoomFactor(-100)).toBeGreaterThan(1);
  });

  it("returns <1 for positive deltaY (pinch-out zooms out)", () => {
    expect(wheelDeltaToZoomFactor(100)).toBeLessThan(1);
  });

  it("returns 1 for zero deltaY", () => {
    expect(wheelDeltaToZoomFactor(0)).toBe(1);
  });
});

describe("clampZoomScale", () => {
  it("returns the input when within [MIN_ZOOM, MAX_ZOOM]", () => {
    expect(clampZoomScale(1)).toBe(1);
    expect(clampZoomScale(0.5)).toBe(0.5);
    expect(clampZoomScale(4)).toBe(4);
  });

  it("clamps values below MIN_ZOOM", () => {
    expect(clampZoomScale(0.01)).toBe(MIN_ZOOM);
    expect(clampZoomScale(-1)).toBe(MIN_ZOOM);
  });

  it("clamps values above MAX_ZOOM", () => {
    expect(clampZoomScale(100)).toBe(MAX_ZOOM);
  });

  it("falls back to DEFAULT_ZOOM for non-finite input", () => {
    expect(clampZoomScale(Number.NaN)).toBe(DEFAULT_ZOOM);
    expect(clampZoomScale(Number.POSITIVE_INFINITY)).toBe(DEFAULT_ZOOM);
  });
});

describe("applyPointerCenteredZoom", () => {
  const pointer = { x: 400, y: 300 };

  it("keeps the natural-space point under the pointer fixed across zoom change", () => {
    const before = DEFAULT_ZOOM_STATE;
    const fitBefore = stagePointToFitPoint(pointer, before);
    const after = applyPointerCenteredZoom(before, pointer, 2);
    const fitAfter = stagePointToFitPoint(pointer, after);
    expect(fitAfter.x).toBeCloseTo(fitBefore.x, 4);
    expect(fitAfter.y).toBeCloseTo(fitBefore.y, 4);
  });

  it("preserves the fixed point when starting from a non-DEFAULT state", () => {
    const before: ZoomState = { scale: 1.5, offsetX: 30, offsetY: 60 };
    const fitBefore = stagePointToFitPoint(pointer, before);
    const after = applyPointerCenteredZoom(before, pointer, 3);
    const fitAfter = stagePointToFitPoint(pointer, after);
    expect(fitAfter.x).toBeCloseTo(fitBefore.x, 4);
    expect(fitAfter.y).toBeCloseTo(fitBefore.y, 4);
    expect(after.scale).toBe(3);
  });

  it("clamps scale to MIN_ZOOM when nextScale is below the limit", () => {
    const result = applyPointerCenteredZoom(DEFAULT_ZOOM_STATE, pointer, 0.01);
    expect(result.scale).toBe(MIN_ZOOM);
  });

  it("clamps scale to MAX_ZOOM when nextScale is above the limit", () => {
    const result = applyPointerCenteredZoom(DEFAULT_ZOOM_STATE, pointer, 100);
    expect(result.scale).toBe(MAX_ZOOM);
  });
});

describe("applyCenteredZoom", () => {
  const stageSize = { width: 800, height: 600 };

  it("anchors at the stage center", () => {
    const center = { x: stageSize.width / 2, y: stageSize.height / 2 };
    const fitBefore = stagePointToFitPoint(center, DEFAULT_ZOOM_STATE);
    const after = applyCenteredZoom(DEFAULT_ZOOM_STATE, stageSize, 2);
    const fitAfter = stagePointToFitPoint(center, after);
    expect(fitAfter.x).toBeCloseTo(fitBefore.x, 4);
    expect(fitAfter.y).toBeCloseTo(fitBefore.y, 4);
  });

  it("clamps scale to MIN_ZOOM / MAX_ZOOM", () => {
    expect(applyCenteredZoom(DEFAULT_ZOOM_STATE, stageSize, 0).scale).toBe(MIN_ZOOM);
    expect(applyCenteredZoom(DEFAULT_ZOOM_STATE, stageSize, 999).scale).toBe(MAX_ZOOM);
  });
});

describe("nextZoomIn / nextZoomOut", () => {
  it("nextZoomIn multiplies by ZOOM_STEP", () => {
    expect(nextZoomIn(1)).toBeCloseTo(ZOOM_STEP, 6);
    expect(nextZoomIn(2)).toBeCloseTo(2 * ZOOM_STEP, 6);
  });

  it("nextZoomIn clamps to MAX_ZOOM", () => {
    expect(nextZoomIn(MAX_ZOOM)).toBe(MAX_ZOOM);
    expect(nextZoomIn(MAX_ZOOM * 2)).toBe(MAX_ZOOM);
  });

  it("nextZoomOut divides by ZOOM_STEP", () => {
    expect(nextZoomOut(1)).toBeCloseTo(1 / ZOOM_STEP, 6);
    expect(nextZoomOut(2)).toBeCloseTo(2 / ZOOM_STEP, 6);
  });

  it("nextZoomOut clamps to MIN_ZOOM", () => {
    expect(nextZoomOut(MIN_ZOOM)).toBe(MIN_ZOOM);
    expect(nextZoomOut(MIN_ZOOM / 2)).toBe(MIN_ZOOM);
  });
});

describe("stagePointToFitPoint / fitPointToStagePoint", () => {
  const point = { x: 150, y: 220 };

  it("stagePointToFitPoint is identity when zoom is DEFAULT_ZOOM_STATE", () => {
    expect(stagePointToFitPoint(point, DEFAULT_ZOOM_STATE)).toEqual(point);
  });

  it("fitPointToStagePoint is identity when zoom is DEFAULT_ZOOM_STATE", () => {
    expect(fitPointToStagePoint(point, DEFAULT_ZOOM_STATE)).toEqual(point);
  });

  it("stagePointToFitPoint compensates Stage scale + offset", () => {
    const zoom: ZoomState = { scale: 2, offsetX: 50, offsetY: 100 };
    const fit = stagePointToFitPoint({ x: 250, y: 320 }, zoom);
    // (250 - 50) / 2 = 100, (320 - 100) / 2 = 110
    expect(fit).toEqual({ x: 100, y: 110 });
  });

  it("fitPointToStagePoint is the exact inverse of stagePointToFitPoint", () => {
    const zoom: ZoomState = { scale: 2.5, offsetX: 30, offsetY: 70 };
    const stage = { x: 480, y: 595 };
    const fit = stagePointToFitPoint(stage, zoom);
    const back = fitPointToStagePoint(fit, zoom);
    expect(back.x).toBeCloseTo(stage.x, 6);
    expect(back.y).toBeCloseTo(stage.y, 6);
  });
});
