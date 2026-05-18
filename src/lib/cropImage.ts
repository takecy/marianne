import type { Point, Size } from "@/lib/imageFit";
import type { ArrowShape, MosaicShape, RectShape, Shape, TextShape } from "@/types/shape";
import type { LoadedImage } from "@/types/image";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Minimum dimensions used to discard degenerate post-crop shapes. Kept in sync
// with the values in src/lib/drawingGesture.ts; redeclared here to keep this
// module a pure helper without an import-time dependency on the gesture
// pipeline.
export const MIN_RECT_DIM = 2;
export const MIN_MOSAIC_DIM = 4;
export const MIN_ARROW_LENGTH = 4;

// Minimum natural-pixel crop size accepted by the UI confirm button. Smaller
// crops are rejected to avoid pathological 1x1 outputs that would lose almost
// all annotations.
export const MIN_CROP_DIM = 8;

// Returns a default crop rectangle that insets the image by `insetRatio` on
// each side (so insetRatio = 0.1 leaves the centre 80% visible). Used as the
// initial selection when the user first enters crop mode.
export function defaultCropRect(imageSize: Size, insetRatio = 0.1): CropRect {
  const insetX = imageSize.width * insetRatio;
  const insetY = imageSize.height * insetRatio;
  return {
    x: Math.round(insetX),
    y: Math.round(insetY),
    width: Math.max(MIN_CROP_DIM, Math.round(imageSize.width - insetX * 2)),
    height: Math.max(MIN_CROP_DIM, Math.round(imageSize.height - insetY * 2)),
  };
}

// Liang-Barsky line clipping against an axis-aligned rectangle.
// Returns the clipped segment endpoints in the same coordinate space as the
// input, or null if the segment does not intersect the rectangle at all.
// The original from→to direction is preserved (t0 maps to "from side",
// t1 maps to "to side").
export function liangBarskyClip(
  from: Point,
  to: Point,
  rect: CropRect,
): { from: Point; to: Point } | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const xmin = rect.x;
  const ymin = rect.y;
  const xmax = rect.x + rect.width;
  const ymax = rect.y + rect.height;

  let t0 = 0;
  let t1 = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [from.x - xmin, xmax - from.x, from.y - ymin, ymax - from.y];

  for (let i = 0; i < 4; i++) {
    const pi = p[i] ?? 0;
    const qi = q[i] ?? 0;
    if (pi === 0) {
      if (qi < 0) {
        return null;
      }
    } else {
      const r = qi / pi;
      if (pi < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }

  return {
    from: { x: from.x + t0 * dx, y: from.y + t0 * dy },
    to: { x: from.x + t1 * dx, y: from.y + t1 * dy },
  };
}

// Clamp a value into [0, max].
function clampInto(value: number, max: number): number {
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

// Translate and clip all shapes for the new crop window. cropRect is expressed
// in the **original** image's natural pixel space. New shape coordinates are in
// the **cropped** image's natural pixel space (origin at cropRect.x, cropRect.y).
//
// - rect / mosaic: translated by (-cropRect.x, -cropRect.y), then clamped to
//   the new image bounds; shapes that fully fall outside or shrink below the
//   minimum dimension are dropped.
// - arrow: Liang-Barsky clipped against cropRect first (so segments that miss
//   the rectangle entirely are dropped instead of producing fake edge-arrows),
//   then translated. Direction is preserved.
// - text: kept iff the origin falls inside cropRect; the text body itself is
//   not measured (its width depends on the rendered glyphs, which the pure
//   helper cannot know).
export function transformShapesForCrop(shapes: Shape[], cropRect: CropRect): Shape[] {
  const newSize: Size = { width: cropRect.width, height: cropRect.height };
  const result: Shape[] = [];

  for (const shape of shapes) {
    const next = transformOne(shape, cropRect, newSize);
    if (next !== null) {
      result.push(next);
    }
  }

  return result;
}

function transformOne(shape: Shape, cropRect: CropRect, newSize: Size): Shape | null {
  if (shape.type === "rect") {
    return transformRectLike<RectShape>(shape, cropRect, newSize, MIN_RECT_DIM);
  }
  if (shape.type === "mosaic") {
    return transformRectLike<MosaicShape>(shape, cropRect, newSize, MIN_MOSAIC_DIM);
  }
  if (shape.type === "arrow") {
    return transformArrow(shape, cropRect);
  }
  return transformText(shape, cropRect);
}

// Generic clamp-and-translate for rect-like shapes (rect, mosaic). The shape's
// x/y/width/height is in the **original** image's natural pixel space; we
// translate to the cropped space and clamp into [0, newSize.*].
function transformRectLike<T extends RectShape | MosaicShape>(
  shape: T,
  cropRect: CropRect,
  newSize: Size,
  minDim: number,
): T | null {
  const left = clampInto(shape.x - cropRect.x, newSize.width);
  const top = clampInto(shape.y - cropRect.y, newSize.height);
  const right = clampInto(shape.x + shape.width - cropRect.x, newSize.width);
  const bottom = clampInto(shape.y + shape.height - cropRect.y, newSize.height);

  const width = right - left;
  const height = bottom - top;

  if (width < minDim || height < minDim) {
    return null;
  }

  return { ...shape, x: left, y: top, width, height };
}

function transformArrow(shape: ArrowShape, cropRect: CropRect): ArrowShape | null {
  const clipped = liangBarskyClip(
    { x: shape.fromX, y: shape.fromY },
    { x: shape.toX, y: shape.toY },
    cropRect,
  );
  if (clipped === null) {
    return null;
  }
  const fromX = clipped.from.x - cropRect.x;
  const fromY = clipped.from.y - cropRect.y;
  const toX = clipped.to.x - cropRect.x;
  const toY = clipped.to.y - cropRect.y;

  const length = Math.hypot(toX - fromX, toY - fromY);
  if (length < MIN_ARROW_LENGTH) {
    return null;
  }

  return { ...shape, fromX, fromY, toX, toY };
}

function transformText(shape: TextShape, cropRect: CropRect): TextShape | null {
  const localX = shape.x - cropRect.x;
  const localY = shape.y - cropRect.y;
  if (localX < 0 || localX > cropRect.width || localY < 0 || localY > cropRect.height) {
    return null;
  }
  return { ...shape, x: localX, y: localY };
}

// Crop a LoadedImage to the given rectangle and produce a new LoadedImage.
// Uses a 2D canvas to extract the pixel region and decodes the result back
// into an HTMLImageElement so the rest of the rendering pipeline can keep
// treating it like any other loaded image. Source metadata (source / path /
// filename) is preserved so the export filename heuristic and "save to source
// directory" defaulting continue to work.
export async function cropLoadedImage(image: LoadedImage, rect: CropRect): Promise<LoadedImage> {
  const sx = Math.max(0, Math.min(image.naturalWidth, rect.x));
  const sy = Math.max(0, Math.min(image.naturalHeight, rect.y));
  const sw = Math.max(1, Math.min(image.naturalWidth - sx, rect.width));
  const sh = Math.max(1, Math.min(image.naturalHeight - sy, rect.height));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to obtain 2D context for crop");
  }
  ctx.drawImage(image.element, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) {
        resolve(b);
      } else {
        reject(new Error("toBlob returned null"));
      }
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);
  const element = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode cropped image"));
    img.src = url;
  });
  // Note: deliberately not revoking the URL — the element keeps using it for
  // its lifetime as a render source (same lifetime pattern as useImageLoader's
  // decodeImageFromObjectUrl, which revokes only after onload completes).
  URL.revokeObjectURL(url);

  return {
    element,
    naturalWidth: sw,
    naturalHeight: sh,
    source: image.source,
    sourcePath: image.sourcePath,
    sourceFileName: image.sourceFileName,
  };
}
