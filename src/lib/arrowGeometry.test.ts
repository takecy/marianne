import { computeArrowPolygon } from "./arrowGeometry";

const opts = {
  tailHalfWidth: 1,
  neckHalfWidth: 14,
  headHalfWidth: 40,
  neckLength: 48,
  headLength: 80,
};

describe("computeArrowPolygon", () => {
  it("returns an empty array when from === to", () => {
    const points = computeArrowPolygon({ x: 100, y: 100 }, { x: 100, y: 100 }, opts);
    expect(points).toEqual([]);
  });

  it("produces 14 numbers (7 points × 2 coords) for a non-degenerate arrow", () => {
    const points = computeArrowPolygon({ x: 0, y: 0 }, { x: 200, y: 0 }, opts);
    expect(points).toHaveLength(14);
  });

  it("for a rightward arrow, tip is at `to` and tail is a near-point", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 200, y: 0 };
    const pts = computeArrowPolygon(from, to, opts);
    // Tip (P3) is the 4th point => index 6,7 in flat array.
    expect(pts[6]).toBeCloseTo(200);
    expect(pts[7]).toBeCloseTo(0);
    // Tail half-widths (P0 and P6) are on opposite y sides of `from`, each
    // very close to the from-point because tailHalfWidth=1.
    expect(pts[0]).toBeCloseTo(0); // p0.x
    expect(pts[1]).toBeCloseTo(1); // p0.y (= tailHalfWidth)
    expect(pts[12]).toBeCloseTo(0); // p6.x
    expect(pts[13]).toBeCloseTo(-1); // p6.y (= -tailHalfWidth)
  });

  it("neck sits at `to - direction * neckLength` with neckHalfWidth offset", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 200, y: 0 };
    const pts = computeArrowPolygon(from, to, opts);
    // P1 (neck left) is at index 2,3.
    expect(pts[2]).toBeCloseTo(200 - 48); // 152
    expect(pts[3]).toBeCloseTo(14); // neckHalfWidth, in y-down
  });

  it("wing tip sits BEHIND the neck (key harpoon property)", () => {
    const from = { x: 0, y: 0 };
    const to = { x: 200, y: 0 };
    const pts = computeArrowPolygon(from, to, opts);
    // P2 (wing left) is at index 4,5.
    expect(pts[4]).toBeCloseTo(200 - 80); // 120
    expect(pts[5]).toBeCloseTo(40); // headHalfWidth
    // Wing.x (120) < Neck.x (152) — wing is further from the tip than neck.
    expect(pts[4] as number).toBeLessThan(pts[2] as number);
  });

  it("scales the head down proportionally when arrow is shorter than headLength", () => {
    // Arrow length 40, but headLength would be 80; head should be scaled by 0.5.
    const from = { x: 0, y: 0 };
    const to = { x: 40, y: 0 };
    const pts = computeArrowPolygon(from, to, opts);
    // Wing.x = to - 80 * 0.5 = 0
    expect(pts[4]).toBeCloseTo(0);
    // Neck.x = to - 48 * 0.5 = 16
    expect(pts[2]).toBeCloseTo(16);
    // Wing is still behind the neck after scaling.
    expect(pts[4] as number).toBeLessThan(pts[2] as number);
  });

  it("works for diagonal arrows (rotates by 45°)", () => {
    const from = { x: 0, y: 0 };
    // Arrow at 45° going down-right with length 100*sqrt(2).
    const to = { x: 100, y: 100 };
    const pts = computeArrowPolygon(from, to, opts);
    expect(pts).toHaveLength(14);
    // Tip should be at `to`.
    expect(pts[6]).toBeCloseTo(100);
    expect(pts[7]).toBeCloseTo(100);
  });
});
