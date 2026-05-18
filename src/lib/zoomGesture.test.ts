import { fitContain, type FitRect, type Size } from "./imageFit";
import {
  applyCenteredZoom,
  applyPointerCenteredZoom,
  clampPan,
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

describe("clampPan", () => {
  // A symmetric configuration: a 1000x800 stage with a 400x300 image
  // produces fit = { x: 300, y: 250, width: 400, height: 300 } when zoom = 1.
  // At scale = 2 the image overflows neither axis (800x600 still fits in 1000x800),
  // so this gives us a clean "fit axis" scenario for both X and Y.
  const stageSize: Size = { width: 1000, height: 800 };
  const fit: FitRect = fitContain({ width: 400, height: 300 }, stageSize);

  it("is identity on DEFAULT_ZOOM_STATE", () => {
    const result = clampPan(DEFAULT_ZOOM_STATE, stageSize, fit);
    expect(result.scale).toBe(DEFAULT_ZOOM);
    expect(result.offsetX).toBeCloseTo(0, 6);
    expect(result.offsetY).toBeCloseTo(0, 6);
  });

  it("preserves a valid in-containment offset when image fits within stage on this axis", () => {
    // scale = 2: X containment range = [maxOffsetX, minOffsetX] = [-fit.x*2, stageW - (fit.x+fit.width)*2]
    // fit.x = 300, fit.width = 400 -> maxOffsetX = -600, minOffsetX = 1000 - 1400 = -400.
    // Any offsetX in [-600, -400] places the image fully within the Stage; pick -500.
    const zoom: ZoomState = { scale: 2, offsetX: -500, offsetY: 0 };
    const result = clampPan(zoom, stageSize, fit);
    expect(result.offsetX).toBe(-500);
  });

  it("minimally corrects offset that escapes Stage right (fit axis)", () => {
    // offsetX = -250 is outside containmentRange [-600, -400] (image right edge sticks out);
    // expect snap to minOffsetX = -400.
    const zoom: ZoomState = { scale: 2, offsetX: -250, offsetY: 0 };
    const result = clampPan(zoom, stageSize, fit);
    expect(result.offsetX).toBe(-400);
  });

  it("minimally corrects offset that escapes Stage left (fit axis)", () => {
    // offsetX = -700 is below maxOffsetX = -600; expect snap to -600.
    const zoom: ZoomState = { scale: 2, offsetX: -700, offsetY: 0 };
    const result = clampPan(zoom, stageSize, fit);
    expect(result.offsetX).toBe(-600);
  });

  it("clamps offsetX to maxOffsetX when panned too far right (overflow axis)", () => {
    // scale = 4: scaled width = 1600 > 1000, so X overflows.
    // maxOffsetX = -fit.x * 4 = -1200, minOffsetX = 1000 - (300 + 400) * 4 = -1800.
    const zoom: ZoomState = { scale: 4, offsetX: 999999, offsetY: 0 };
    const result = clampPan(zoom, stageSize, fit);
    expect(result.offsetX).toBe(-fit.x * 4);
  });

  it("clamps offsetX to minOffsetX when panned too far left (overflow axis)", () => {
    const zoom: ZoomState = { scale: 4, offsetX: -999999, offsetY: 0 };
    const result = clampPan(zoom, stageSize, fit);
    expect(result.offsetX).toBe(stageSize.width - (fit.x + fit.width) * 4);
  });

  it("processes X and Y independently (X fits with non-center offset, Y overflows)", () => {
    // A tall image scaled so Y overflows the Stage but X stays in containment.
    // Use a 200x800 image in a 1000x800 stage; fitContain caps at ratio 1 (image fits),
    // giving fit = { x: 400, y: 0, width: 200, height: 800 }.
    // At scale = 2 -> scaledWidth = 400 <= 1000 (X fits), scaledHeight = 1600 > 800 (Y overflows).
    const tallFit = fitContain({ width: 200, height: 800 }, stageSize);
    expect(tallFit).toEqual({ x: 400, y: 0, width: 200, height: 800 });
    // X containment: maxOffsetX = -800, minOffsetX = 1000 - 1200 = -200 -> range [-800, -200].
    // Pick offsetX = -500 (in range, preserved).
    // Y overflow: maxOffsetY = 0, minOffsetY = 800 - 1600 = -800 -> clamp +Infinity to 0.
    const zoom: ZoomState = { scale: 2, offsetX: -500, offsetY: 999999 };
    const result = clampPan(zoom, stageSize, tallFit);
    expect(result.offsetX).toBe(-500);
    // Use toBeCloseTo because `-fit.y * scale` evaluates to -0 here (fit.y === 0),
    // and JS distinguishes +0 from -0 via Object.is.
    expect(result.offsetY).toBeCloseTo(0, 6);
  });

  it("passes through valid offsets within the clamp range unchanged (overflow axis)", () => {
    // scale = 4, X overflows: range [-1800, -1200]. Y also overflows when scaledHeight 1200 > 800:
    // maxOffsetY = -fit.y * 4 = -1000, minOffsetY = 800 - (250+300)*4 = -1400.
    const zoom: ZoomState = { scale: 4, offsetX: -1500, offsetY: -1200 };
    const result = clampPan(zoom, stageSize, fit);
    expect(result.offsetX).toBe(-1500);
    expect(result.offsetY).toBe(-1200);
  });
});
