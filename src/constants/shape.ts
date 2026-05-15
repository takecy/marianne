// Default rendering dimensions for annotations. Values are tuned for visibility
// on typical screenshot-style images. See src/components/MosaicNode.tsx for the
// matching MOSAIC_NATURAL_PIXEL_SIZE constant.

// Stroke width for rect and arrow shapes (image-natural pixels in export,
// screen pixels in on-canvas rendering — both share this number).
export const SHAPE_STROKE_WIDTH = 18;

// Arrowhead size: applied to both pointerLength and pointerWidth.
export const ARROW_HEAD_SIZE = 63;

// Default font size for text shapes (in image-natural pixels). On-canvas
// rendering multiplies by the image-to-screen scale; the input overlay uses
// the same number directly as CSS pixels.
export const TEXT_FONT_SIZE = 72;

// Default font style for text shapes. Konva accepts the same keywords as CSS
// font-style/weight; the input overlay maps this to CSS font-weight.
export const TEXT_FONT_STYLE = "bold";

// Black outline around text glyphs to make them readable on any background.
// Skitch-style. Width is in image-natural pixels; on-canvas rendering scales
// by the image-to-screen ratio just like fontSize.
export const TEXT_STROKE_WIDTH = 8;
export const TEXT_STROKE_COLOR = "#000000";

// Drop shadow under text glyphs (matches the arrow shape's shadow style).
export const TEXT_SHADOW_COLOR = "rgba(0,0,0,0.45)";
export const TEXT_SHADOW_BLUR = 6;
export const TEXT_SHADOW_OFFSET_X = 2;
export const TEXT_SHADOW_OFFSET_Y = 2;
