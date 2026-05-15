import {
  ARROW_HEAD_HALF_WIDTH,
  ARROW_HEAD_LENGTH,
  ARROW_NECK_HALF_WIDTH,
  ARROW_NECK_LENGTH,
  ARROW_TAIL_HALF_WIDTH,
} from "@/constants/shape";
import { computeArrowPolygon } from "@/lib/arrowGeometry";
import type { ArrowGeometryOptions } from "@/lib/arrowGeometry";
import { commitArrowEndpoint, previewArrowPolygon } from "@/lib/arrowHandleDrag";
import type { FitRect, Size } from "@/lib/imageFit";

const OPTS: ArrowGeometryOptions = {
  tailHalfWidth: ARROW_TAIL_HALF_WIDTH,
  neckHalfWidth: ARROW_NECK_HALF_WIDTH,
  headHalfWidth: ARROW_HEAD_HALF_WIDTH,
  neckLength: ARROW_NECK_LENGTH,
  headLength: ARROW_HEAD_LENGTH,
};

// 1000x500 image rendered into a 500x250 viewport offset by (100, 50).
// imageToScreen scale = 0.5, so a screen delta of 1 == image delta of 2.
const IMAGE_SIZE: Size = { width: 1000, height: 500 };
const FIT: FitRect = { x: 100, y: 50, width: 500, height: 250 };

describe("previewArrowPolygon", () => {
  it("delegates to computeArrowPolygon with moved-from + fixed-to when dragging 'from'", () => {
    const moved = { x: 10, y: 20 };
    const fixed = { x: 200, y: 80 };
    const got = previewArrowPolygon("from", moved, fixed, OPTS);
    const want = computeArrowPolygon(moved, fixed, OPTS);
    expect(got).toEqual(want);
  });

  it("delegates to computeArrowPolygon with fixed-from + moved-to when dragging 'to'", () => {
    const moved = { x: 300, y: 150 };
    const fixed = { x: 50, y: 60 };
    const got = previewArrowPolygon("to", moved, fixed, OPTS);
    const want = computeArrowPolygon(fixed, moved, OPTS);
    expect(got).toEqual(want);
  });

  it("returns an empty array when both endpoints coincide (delegated to computeArrowPolygon)", () => {
    const p = { x: 100, y: 100 };
    expect(previewArrowPolygon("from", p, p, OPTS)).toEqual([]);
    expect(previewArrowPolygon("to", p, p, OPTS)).toEqual([]);
  });
});

describe("commitArrowEndpoint", () => {
  it("returns only fromX/fromY for 'from' (never includes toX/toY)", () => {
    // Screen (200, 100): image origin + (100, 50) handed off via screenToImage.
    // (200 - 100) * 2 = 200 image-px X; (100 - 50) * 2 = 100 image-px Y.
    const patch = commitArrowEndpoint("from", { x: 200, y: 100 }, FIT, IMAGE_SIZE);
    expect(patch).toStrictEqual({ fromX: 200, fromY: 100 });
    expect("toX" in patch).toBe(false);
    expect("toY" in patch).toBe(false);
  });

  it("returns only toX/toY for 'to' (never includes fromX/fromY)", () => {
    const patch = commitArrowEndpoint("to", { x: 350, y: 175 }, FIT, IMAGE_SIZE);
    expect(patch).toStrictEqual({ toX: 500, toY: 250 });
    expect("fromX" in patch).toBe(false);
    expect("fromY" in patch).toBe(false);
  });

  it("clamps screen points outside the image to the image boundary", () => {
    // Screen (50, 25) is well above-left of the fit (which starts at 100, 50).
    // screenToImage maps to negative image coords -> clampToImage snaps to 0.
    const upperLeft = commitArrowEndpoint("from", { x: 50, y: 25 }, FIT, IMAGE_SIZE);
    expect(upperLeft).toStrictEqual({ fromX: 0, fromY: 0 });

    // Screen (9999, 9999) maps to far beyond imageSize -> clamps to max.
    const lowerRight = commitArrowEndpoint("to", { x: 9999, y: 9999 }, FIT, IMAGE_SIZE);
    expect(lowerRight).toStrictEqual({ toX: 1000, toY: 500 });
  });

  it("round-trips a point inside the image with no clamp drift", () => {
    // (350, 175) -> image (500, 250) -> back to screen (350, 175).
    const patch = commitArrowEndpoint("to", { x: 350, y: 175 }, FIT, IMAGE_SIZE);
    expect(patch).toStrictEqual({ toX: 500, toY: 250 });
  });
});
