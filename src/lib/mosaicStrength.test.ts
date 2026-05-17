import type { MosaicShape } from "@/types/shape";
import { mosaicPixelSize, splitMosaicByOverlap } from "./mosaicStrength";

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

function sequentialIdGen() {
  let counter = 0;
  return () => `id-${counter++}`;
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

describe("splitMosaicByOverlap", () => {
  it("returns a single base shape at level 1 when there are no existing mosaics", () => {
    const draft = { x: 0, y: 0, width: 50, height: 50 };
    const result = splitMosaicByOverlap(draft, [], sequentialIdGen());
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: "mosaic",
      x: 0,
      y: 0,
      width: 50,
      height: 50,
      strengthLevel: 1,
    });
  });

  it("returns only the base shape when the draft is fully disjoint from existing mosaics", () => {
    const draft = { x: 100, y: 100, width: 20, height: 20 };
    const existing = [mosaic("m1", 0, 0, 10, 10, 1)];
    const result = splitMosaicByOverlap(draft, existing, sequentialIdGen());
    expect(result).toHaveLength(1);
    expect(result[0]?.strengthLevel).toBe(1);
  });

  it("does not emit an overlay for edge-only contact (strict inequality)", () => {
    // existing occupies [0,10) x [0,10); new starts exactly at x=10 (touching).
    const draft = { x: 10, y: 0, width: 10, height: 10 };
    const existing = [mosaic("m1", 0, 0, 10, 10, 1)];
    const result = splitMosaicByOverlap(draft, existing, sequentialIdGen());
    expect(result).toHaveLength(1);
    expect(result[0]?.strengthLevel).toBe(1);
  });

  it("emits a level 2 overlay covering only the intersection on partial overlap", () => {
    // Draft [10..30) x [10..30) overlaps existing [0..20) x [0..20) on [10..20)^2.
    const draft = { x: 10, y: 10, width: 20, height: 20 };
    const existing = [mosaic("m1", 0, 0, 20, 20, 1)];
    const result = splitMosaicByOverlap(draft, existing, sequentialIdGen());
    expect(result).toHaveLength(2);
    expect(result[0]?.strengthLevel).toBe(1);
    expect(result[1]).toMatchObject({
      x: 10,
      y: 10,
      width: 10,
      height: 10,
      strengthLevel: 2,
    });
  });

  it("emits an overlay covering the full draft when the draft is fully contained in an existing mosaic", () => {
    const draft = { x: 20, y: 20, width: 10, height: 10 };
    const existing = [mosaic("m1", 0, 0, 100, 100, 2)];
    const result = splitMosaicByOverlap(draft, existing, sequentialIdGen());
    expect(result).toHaveLength(2);
    expect(result[0]?.strengthLevel).toBe(1);
    expect(result[1]).toMatchObject({
      x: 20,
      y: 20,
      width: 10,
      height: 10,
      strengthLevel: 3,
    });
  });

  it("orders overlays by ascending level so higher levels render on top", () => {
    // Both existing mosaics overlap with the draft; one is level 1, one is level 3.
    const draft = { x: 0, y: 0, width: 50, height: 50 };
    const existing = [
      mosaic("strong", 30, 30, 50, 50, 3),
      mosaic("weak", 0, 0, 20, 20, 1),
    ];
    const result = splitMosaicByOverlap(draft, existing, sequentialIdGen());
    expect(result).toHaveLength(3);
    expect(result[0]?.strengthLevel).toBe(1); // base
    expect(result[1]?.strengthLevel).toBe(2); // weak +1
    expect(result[2]?.strengthLevel).toBe(4); // strong +1
  });

  it("skips non-overlapping existing mosaics in the result", () => {
    const draft = { x: 0, y: 0, width: 20, height: 20 };
    const existing = [
      mosaic("inside", 5, 5, 5, 5, 1),
      mosaic("outside", 100, 100, 10, 10, 5),
    ];
    const result = splitMosaicByOverlap(draft, existing, sequentialIdGen());
    expect(result).toHaveLength(2); // base + 1 overlay (outside is skipped)
    expect(result[1]?.strengthLevel).toBe(2);
  });

  it("treats existing mosaics with undefined strengthLevel as level 1", () => {
    const draft = { x: 0, y: 0, width: 20, height: 20 };
    const existing = [mosaic("m1", 5, 5, 10, 10, undefined)];
    const result = splitMosaicByOverlap(draft, existing, sequentialIdGen());
    expect(result).toHaveLength(2);
    expect(result[1]?.strengthLevel).toBe(2);
  });

  it("assigns a fresh id to each generated shape", () => {
    const draft = { x: 0, y: 0, width: 50, height: 50 };
    const existing = [
      mosaic("a", 0, 0, 20, 20, 1),
      mosaic("b", 30, 30, 20, 20, 2),
    ];
    const result = splitMosaicByOverlap(draft, existing, sequentialIdGen());
    const ids = result.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(ids).toEqual(["id-0", "id-1", "id-2"]);
  });
});
