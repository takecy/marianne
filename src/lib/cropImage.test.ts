import {
  defaultCropRect,
  liangBarskyClip,
  MIN_ARROW_LENGTH,
  transformShapesForCrop,
} from "./cropImage";
import type { ArrowShape, MosaicShape, RectShape, Shape, TextShape } from "@/types/shape";

function rect(over: Partial<RectShape> = {}): RectShape {
  return {
    id: "r1",
    type: "rect",
    color: "red",
    strokeWidth: "thick",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...over,
  };
}

function mosaic(over: Partial<MosaicShape> = {}): MosaicShape {
  return {
    id: "m1",
    type: "mosaic",
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    ...over,
  };
}

function arrow(over: Partial<ArrowShape> = {}): ArrowShape {
  return {
    id: "a1",
    type: "arrow",
    color: "blue",
    fromX: 0,
    fromY: 0,
    toX: 10,
    toY: 10,
    ...over,
  };
}

function text(over: Partial<TextShape> = {}): TextShape {
  return {
    id: "t1",
    type: "text",
    color: "black",
    x: 0,
    y: 0,
    text: "hi",
    ...over,
  };
}

describe("defaultCropRect", () => {
  it("returns the centre 80% by default", () => {
    const r = defaultCropRect({ width: 1000, height: 500 });
    expect(r).toEqual({ x: 100, y: 50, width: 800, height: 400 });
  });

  it("rounds to integer pixels", () => {
    const r = defaultCropRect({ width: 333, height: 250 });
    expect(Number.isInteger(r.x)).toBe(true);
    expect(Number.isInteger(r.y)).toBe(true);
    expect(Number.isInteger(r.width)).toBe(true);
    expect(Number.isInteger(r.height)).toBe(true);
  });
});

describe("liangBarskyClip", () => {
  const r = { x: 10, y: 10, width: 80, height: 80 };

  it("returns null when the segment misses the rectangle entirely", () => {
    // Segment entirely to the left of the rect
    expect(liangBarskyClip({ x: 0, y: 50 }, { x: 5, y: 50 }, r)).toBeNull();
    // Segment passing above the rect
    expect(liangBarskyClip({ x: 0, y: 0 }, { x: 200, y: 5 }, r)).toBeNull();
  });

  it("keeps a fully-contained segment unchanged", () => {
    expect(liangBarskyClip({ x: 20, y: 20 }, { x: 80, y: 80 }, r)).toEqual({
      from: { x: 20, y: 20 },
      to: { x: 80, y: 80 },
    });
  });

  it("clips a segment that exits the right edge", () => {
    expect(liangBarskyClip({ x: 50, y: 50 }, { x: 200, y: 50 }, r)).toEqual({
      from: { x: 50, y: 50 },
      to: { x: 90, y: 50 },
    });
  });

  it("clips a segment crossing diagonally from outside to outside", () => {
    expect(liangBarskyClip({ x: 0, y: 0 }, { x: 100, y: 100 }, r)).toEqual({
      from: { x: 10, y: 10 },
      to: { x: 90, y: 90 },
    });
  });

  it("preserves direction: from-side stays on the from end", () => {
    const out = liangBarskyClip({ x: -50, y: 50 }, { x: 200, y: 50 }, r);
    if (out === null) {
      throw new Error("expected non-null result");
    }
    expect(out.from.x).toBeLessThan(out.to.x);
  });
});

describe("transformShapesForCrop - rect", () => {
  it("translates a fully-contained rect by (-cropX, -cropY)", () => {
    const shapes: Shape[] = [rect({ x: 100, y: 100, width: 20, height: 20 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 200, height: 200 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "rect", x: 50, y: 50, width: 20, height: 20 });
  });

  it("drops a rect fully outside the crop window", () => {
    const shapes: Shape[] = [rect({ x: 500, y: 500, width: 10, height: 10 })];
    const out = transformShapesForCrop(shapes, { x: 0, y: 0, width: 100, height: 100 });
    expect(out).toEqual([]);
  });

  it("clamps a rect that straddles the left edge of the crop window", () => {
    // Crop at x=50, rect from x=30 to x=70 → clamped to x=0..20 in new space
    const shapes: Shape[] = [rect({ x: 30, y: 60, width: 40, height: 10 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 100, height: 100 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "rect", x: 0, y: 10, width: 20, height: 10 });
  });

  it("clamps a rect that straddles the right edge of the crop window", () => {
    // Crop window is 100 wide starting at x=50. Rect spans x=80..150 (width 70)
    // → clamped to x=30..100 in new space (width 70 = newSize.width - 30)
    const shapes: Shape[] = [rect({ x: 80, y: 60, width: 70, height: 10 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 100, height: 100 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "rect", x: 30, y: 10, width: 70, height: 10 });
  });
});

describe("transformShapesForCrop - mosaic", () => {
  it("translates and clamps mosaic shapes (same logic as rect)", () => {
    const shapes: Shape[] = [mosaic({ x: 30, y: 30, width: 40, height: 40 })];
    const out = transformShapesForCrop(shapes, { x: 40, y: 40, width: 100, height: 100 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "mosaic", x: 0, y: 0, width: 30, height: 30 });
  });
});

describe("transformShapesForCrop - arrow (line clipping)", () => {
  it("translates a fully-contained arrow without changing its endpoints relatively", () => {
    const shapes: Shape[] = [arrow({ fromX: 60, fromY: 60, toX: 80, toY: 80 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 100, height: 100 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "arrow", fromX: 10, fromY: 10, toX: 30, toY: 30 });
  });

  it("DELETES an arrow that misses the crop rectangle entirely (regression for #58 critical)", () => {
    // The segment runs from (0,0) toward (0,200) — purely along the y-axis,
    // never crossing x>=50. Naive "clamp each endpoint" would yield a fake
    // arrow on the rectangle's left edge; Liang-Barsky correctly drops it.
    const shapes: Shape[] = [arrow({ fromX: 0, fromY: 0, toX: 0, toY: 200 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 100, height: 100 });
    expect(out).toEqual([]);
  });

  it("clips an arrow with one endpoint outside the crop window", () => {
    // from inside (60,60), to outside (200,60) → toX clamped to right edge of
    // crop rect (x=150) → after translate by (-50,-50): from=(10,10), to=(100,10)
    const shapes: Shape[] = [arrow({ fromX: 60, fromY: 60, toX: 200, toY: 60 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 100, height: 100 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "arrow", fromX: 10, fromY: 10, toX: 100, toY: 10 });
  });

  it("preserves direction (from→to) when both endpoints are outside but the line crosses the rect", () => {
    // Diagonal crosses from (0,0) to (200,200) through a rect at (50,50,100,100)
    // The clip enters at (50,50) and exits at (150,150). After translate: (0,0) → (100,100).
    const shapes: Shape[] = [arrow({ fromX: 0, fromY: 0, toX: 200, toY: 200 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 100, height: 100 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "arrow", fromX: 0, fromY: 0, toX: 100, toY: 100 });
  });

  it("drops an arrow whose clipped length falls below MIN_ARROW_LENGTH", () => {
    // Arrow just barely grazes the rect corner — clipped length will be < MIN_ARROW_LENGTH.
    const shapes: Shape[] = [
      arrow({ fromX: 49, fromY: 49, toX: 51, toY: 51 }),
    ];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 100, height: 100 });
    // Clipped to (50,50)-(51,51), length ≈ 1.41 < MIN_ARROW_LENGTH (4)
    expect(out).toEqual([]);
    // Sanity check on the threshold value used above
    expect(MIN_ARROW_LENGTH).toBe(4);
  });
});

describe("transformShapesForCrop - text", () => {
  it("keeps text whose origin is inside the crop rect (translated)", () => {
    const shapes: Shape[] = [text({ x: 100, y: 100 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 200, height: 200 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "text", x: 50, y: 50, text: "hi" });
  });

  it("drops text whose origin is outside the crop rect", () => {
    const shapes: Shape[] = [text({ x: 10, y: 10 })];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 200, height: 200 });
    expect(out).toEqual([]);
  });
});

describe("transformShapesForCrop - mixed", () => {
  it("processes a heterogeneous shape list and preserves order of survivors", () => {
    const shapes: Shape[] = [
      rect({ id: "keep-r", x: 60, y: 60, width: 10, height: 10 }),
      arrow({ id: "drop-a", fromX: 0, fromY: 0, toX: 5, toY: 5 }),
      mosaic({ id: "clamp-m", x: 40, y: 40, width: 30, height: 30 }),
      text({ id: "keep-t", x: 80, y: 80 }),
    ];
    const out = transformShapesForCrop(shapes, { x: 50, y: 50, width: 100, height: 100 });
    expect(out.map((s) => s.id)).toEqual(["keep-r", "clamp-m", "keep-t"]);
  });
});
