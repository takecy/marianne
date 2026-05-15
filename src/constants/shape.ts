// Default rendering dimensions for annotations. Values are tuned for visibility
// on typical screenshot-style images. See src/components/MosaicNode.tsx for the
// matching MOSAIC_NATURAL_PIXEL_SIZE constant.

// Stroke width for rect shapes (image-natural pixels in export, screen
// pixels in on-canvas rendering — both share this number). Arrows use a
// custom polygon (see ARROW_* constants below) and do not stroke.
export const SHAPE_STROKE_WIDTH = 18;

// Skitch-style "harpoon" arrow geometry. The arrow is rendered as a closed
// concave polygon (Konva.Line with `closed: true`) so the shaft tapers from a
// near-point tail and the wing tips sit BEHIND the neck — creating the
// characteristic harpoon-barb cutout. See src/lib/arrowGeometry.ts.
//
// HALF_WIDTH values are perpendicular extents on one side of the centerline;
// LENGTH values are axial distances measured from the tip going backwards.
// All in image-natural pixels for export, screen pixels for on-canvas
// rendering (multiplied by image-to-screen scale).
//
// Invariant: NECK_LENGTH < HEAD_LENGTH. The wing tip sits further from the
// tip than the neck does — this is what carves the harpoon cutout.
export const ARROW_TAIL_HALF_WIDTH = 1;
export const ARROW_NECK_HALF_WIDTH = 13;
export const ARROW_HEAD_HALF_WIDTH = 40;
export const ARROW_NECK_LENGTH = 66;
export const ARROW_HEAD_LENGTH = 80;

// Default font size for text shapes (in image-natural pixels). On-canvas
// rendering multiplies by the image-to-screen scale; the input overlay uses
// the same number directly as CSS pixels.
export const TEXT_FONT_SIZE = 72;

// Minimum font size when resizing text (image-natural pixels). Below this the
// resize is rejected and the node position is reset to the shape's stored
// coordinates to avoid transient drift.
export const TEXT_FONT_SIZE_MIN = 12;

// Default font style for text shapes. Konva accepts the same keywords as CSS
// font-style/weight (including numeric weights like "900"); the input overlay
// maps this to CSS font-weight.
export const TEXT_FONT_STYLE = "900";

// Outline around text glyphs to make them readable on any background.
// Skitch-style. Width is in image-natural pixels; on-canvas rendering scales
// by the image-to-screen ratio just like fontSize.
//
// Two outline colors are exposed — dark text colors (red / blue / black) read
// better with a white outline, while light text colors use the black outline.
// The mapping lives in `textStrokeColorFor` (src/types/tool.ts).
export const TEXT_STROKE_WIDTH = 14;
export const TEXT_STROKE_COLOR_BLACK = "rgba(0, 0, 0, 0.75)";
export const TEXT_STROKE_COLOR_WHITE = "rgba(255, 255, 255, 0.85)";

// Drop shadow under text glyphs. Larger than the arrow shape's shadow because
// outlined text needs a more pronounced drop shadow to read as "Skitch-style".
export const TEXT_SHADOW_COLOR = "rgba(0,0,0,0.45)";
export const TEXT_SHADOW_BLUR = 10;
export const TEXT_SHADOW_OFFSET_X = 5;
export const TEXT_SHADOW_OFFSET_Y = 5;
