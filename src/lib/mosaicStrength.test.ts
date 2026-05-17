import type { MosaicShape } from "@/types/shape";
import { computeMosaicStrengthLevel, mosaicPixelSize } from "./mosaicStrength";

function mosaic(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  strengthLevel?: number,
): MosaicShape {
  return { id, type: "mosaic", x, y, width, height, strengthLevel };
}

describe("mosaicPixelSize", () => {
  it("returns the base block size (24) for undefined level", () => {
    expect(mosaicPixelSize(undefined)).toBe(24);
  });

  it("returns the base block size (24) for level 1", () => {
    expect(mosaicPixelSize(1)).toBe(24);
  });

  it("adds one increment (12) per additional level", () => {
    expect(mosaicPixelSize(2)).toBe(36);
    expect(mosaicPixelSize(3)).toBe(48);
    expect(mosaicPixelSize(5)).toBe(72);
  });
});

describe("computeMosaicStrengthLevel", () => {
  it("returns 1 when there are no existing mosaics", () => {
    const newRect = { x: 0, y: 0, width: 50, height: 50 };
    expect(computeMosaicStrengthLevel(newRect, [])).toBe(1);
  });

  it("returns 1 when the new rect is fully disjoint from existing mosaics", () => {
    const existing = [mosaic("m1", 0, 0, 10, 10, 1)];
    const newRect = { x: 100, y: 100, width: 20, height: 20 };
    expect(computeMosaicStrengthLevel(newRect, existing)).toBe(1);
  });

  it("does not count edge-only contact as overlap (strict inequality)", () => {
    // existing occupies [0,10) x [0,10); new starts exactly at x=10 (touching).
    const existing = [mosaic("m1", 0, 0, 10, 10, 1)];
    const newRect = { x: 10, y: 0, width: 10, height: 10 };
    expect(computeMosaicStrengthLevel(newRect, existing)).toBe(1);
  });

  it("returns 2 when the new rect overlaps with a level 1 mosaic", () => {
    const existing = [mosaic("m1", 0, 0, 20, 20, 1)];
    const newRect = { x: 10, y: 10, width: 20, height: 20 };
    expect(computeMosaicStrengthLevel(newRect, existing)).toBe(2);
  });

  it("returns max(overlapping levels) + 1 when multiple existing mosaics overlap", () => {
    const existing = [
      mosaic("m1", 0, 0, 20, 20, 1),
      mosaic("m2", 5, 5, 20, 20, 3),
      mosaic("m3", 200, 200, 10, 10, 5), // far away, not overlapping
    ];
    const newRect = { x: 10, y: 10, width: 20, height: 20 };
    expect(computeMosaicStrengthLevel(newRect, existing)).toBe(4);
  });

  it("returns max + 1 when the new rect is fully contained inside an existing mosaic", () => {
    const existing = [mosaic("m1", 0, 0, 100, 100, 2)];
    const newRect = { x: 20, y: 20, width: 10, height: 10 };
    expect(computeMosaicStrengthLevel(newRect, existing)).toBe(3);
  });

  it("treats existing mosaics with undefined strengthLevel as level 1", () => {
    const existing = [mosaic("m1", 0, 0, 20, 20, undefined)];
    const newRect = { x: 5, y: 5, width: 10, height: 10 };
    expect(computeMosaicStrengthLevel(newRect, existing)).toBe(2);
  });
});
