import type { ArrowShape, MosaicShape, RectShape, Shape, TextShape } from "@/types/shape";
import { partitionShapesByMosaicFirst } from "./shapeZOrder";

function rect(id: string): RectShape {
  return { id, type: "rect", color: "red", x: 0, y: 0, width: 10, height: 10 };
}

function text(id: string): TextShape {
  return { id, type: "text", color: "blue", x: 0, y: 0, text: "hi" };
}

function arrow(id: string): ArrowShape {
  return { id, type: "arrow", color: "green", fromX: 0, fromY: 0, toX: 10, toY: 10 };
}

function mosaic(id: string): MosaicShape {
  return { id, type: "mosaic", x: 0, y: 0, width: 10, height: 10 };
}

describe("partitionShapesByMosaicFirst", () => {
  it("returns empty groups for an empty input", () => {
    const result = partitionShapesByMosaicFirst([]);
    expect(result.mosaics).toEqual([]);
    expect(result.others).toEqual([]);
  });

  it("places mosaic-only input entirely into mosaics group", () => {
    const m1 = mosaic("m1");
    const m2 = mosaic("m2");
    const result = partitionShapesByMosaicFirst([m1, m2]);
    expect(result.mosaics).toEqual([m1, m2]);
    expect(result.others).toEqual([]);
  });

  it("places non-mosaic-only input entirely into others group preserving order", () => {
    const r = rect("r1");
    const a = arrow("a1");
    const t = text("t1");
    const result = partitionShapesByMosaicFirst([r, a, t]);
    expect(result.mosaics).toEqual([]);
    expect(result.others).toEqual([r, a, t]);
  });

  it("splits mixed input into mosaics-first and others-second", () => {
    const r = rect("r1");
    const m = mosaic("m1");
    const a = arrow("a1");
    const result = partitionShapesByMosaicFirst([r, m, a]);
    expect(result.mosaics).toEqual([m]);
    expect(result.others).toEqual([r, a]);
  });

  it("preserves creation order between two mosaics (stable)", () => {
    const mA = mosaic("m-A");
    const r = rect("r1");
    const mB = mosaic("m-B");
    const result = partitionShapesByMosaicFirst([mA, r, mB]);
    expect(result.mosaics).toEqual([mA, mB]);
  });

  it("preserves creation order between non-mosaic shapes (stable)", () => {
    const a = arrow("a1");
    const m = mosaic("m1");
    const r = rect("r1");
    const t = text("t1");
    const result = partitionShapesByMosaicFirst([a, m, r, t]);
    expect(result.others).toEqual([a, r, t]);
  });

  it("preserves total count: mosaics.length + others.length === shapes.length", () => {
    const shapes: Shape[] = [
      mosaic("m1"),
      rect("r1"),
      mosaic("m2"),
      arrow("a1"),
      text("t1"),
      mosaic("m3"),
    ];
    const result = partitionShapesByMosaicFirst(shapes);
    expect(result.mosaics.length + result.others.length).toBe(shapes.length);
  });

  it("does not mutate the input array", () => {
    const m = mosaic("m1");
    const r = rect("r1");
    const a = arrow("a1");
    const shapes: Shape[] = [r, m, a];
    const snapshot = [...shapes];
    partitionShapesByMosaicFirst(shapes);
    expect(shapes).toEqual(snapshot);
    expect(shapes[0]).toBe(r);
    expect(shapes[1]).toBe(m);
    expect(shapes[2]).toBe(a);
  });
});
