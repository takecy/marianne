// Pure geometry helpers for the Skitch-style "harpoon" arrow. The arrow is
// rendered as a closed polygon (Konva.Line with `closed: true`) rather than
// Konva.Arrow's stroke + separate triangular head, which lets us:
//
//   * taper the shaft from a near-point tail to the neck,
//   * carve a concave notch into the underside of the arrowhead so the wing
//     tips sit BEHIND the neck (Skitch / harpoon look).
//
// Polygon point order (counter-clockwise around the perimeter, starting from
// the left side of the tail):
//
//                              P2 (head outer wing, LEFT)
//                             /
//                            /        P3 (tip)
//   P0 (tail L) ====== P1 (neck L)  /
//                            \    /
//                             \  /
//                              \/
//                              /\
//                             /  \
//                            /    \
//   P6 (tail R) ====== P5 (neck R)
//                            \
//                             \
//                              P4 (head outer wing, RIGHT)
//
// Notice neck (P1, P5) is CLOSER TO THE TIP than wing (P2, P4):
// neckLength < headLength. This is what creates the harpoon's barb cutout.
//
// "Left" and "right" are relative to the arrow's direction of travel.

export interface ArrowGeometryOptions {
  // Half-width of the tail (root), measured perpendicular to the arrow line.
  // Use a small value (e.g. 1) for a tapered "near-point" tail.
  tailHalfWidth: number;
  // Half-width at the neck — the inner root of the arrowhead wing where the
  // shaft meets the arrowhead. This is the widest point of the shaft.
  neckHalfWidth: number;
  // Half-width of the arrowhead wings (perpendicular extent at the outer tip
  // of each wing). Must be > neckHalfWidth.
  headHalfWidth: number;
  // Axial distance from tip back to the neck.
  neckLength: number;
  // Axial distance from tip back to the OUTER WING TIP. Must be > neckLength
  // so the wing tips sit behind the neck (creates the harpoon cutout).
  headLength: number;
}

export interface Point {
  x: number;
  y: number;
}

// Returns a flat number[] suitable for Konva.Line `points` prop:
// [x0, y0, x1, y1, ..., xN, yN].
//
// If the from/to points are coincident (or nearly so), returns an empty array
// so the caller can skip rendering — Konva.Line tolerates an empty points
// array gracefully (it draws nothing).
//
// When the arrow length is shorter than `headLength`, the head is uniformly
// scaled down so the arrowhead never wraps behind the tail.
export function computeArrowPolygon(
  from: Point,
  to: Point,
  opts: ArrowGeometryOptions,
): number[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) {
    return [];
  }

  // Unit vector along the arrow (from -> to).
  const ux = dx / length;
  const uy = dy / length;
  // Perpendicular unit vector (rotate 90° counter-clockwise: (-y, x)).
  const nx = -uy;
  const ny = ux;

  // Uniformly scale the head down if the arrow is too short, so neck and wing
  // never sit behind the tail. Preserves the relative neck/head proportions.
  const headScale = opts.headLength > length ? length / opts.headLength : 1;
  const neckLength = opts.neckLength * headScale;
  const headLength = opts.headLength * headScale;

  // Neck point (inner root of the wing, also the end of the tapered shaft).
  const neckX = to.x - ux * neckLength;
  const neckY = to.y - uy * neckLength;
  // Wing point (outer tip of the wing — sits behind the neck for harpoon look).
  const wingX = to.x - ux * headLength;
  const wingY = to.y - uy * headLength;

  // 7 perimeter points, ordered counter-clockwise around the polygon.
  const p0x = from.x + nx * opts.tailHalfWidth;
  const p0y = from.y + ny * opts.tailHalfWidth;
  const p1x = neckX + nx * opts.neckHalfWidth;
  const p1y = neckY + ny * opts.neckHalfWidth;
  const p2x = wingX + nx * opts.headHalfWidth;
  const p2y = wingY + ny * opts.headHalfWidth;
  const p3x = to.x;
  const p3y = to.y;
  const p4x = wingX - nx * opts.headHalfWidth;
  const p4y = wingY - ny * opts.headHalfWidth;
  const p5x = neckX - nx * opts.neckHalfWidth;
  const p5y = neckY - ny * opts.neckHalfWidth;
  const p6x = from.x - nx * opts.tailHalfWidth;
  const p6y = from.y - ny * opts.tailHalfWidth;

  return [p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y, p5x, p5y, p6x, p6y];
}
