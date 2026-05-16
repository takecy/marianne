export interface Size {
  width: number;
  height: number;
}

export interface FitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function fitContain(image: Size, container: Size): FitRect {
  if (image.width <= 0 || image.height <= 0 || container.width <= 0 || container.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  // Cap the ratio at 1 so a container larger than the image leaves the image
  // at its natural size (centered with padding) instead of upscaling. The
  // window auto-resize feature relies on this so min-clamped small windows
  // still show the image 1:1.
  const ratio = Math.min(container.width / image.width, container.height / image.height, 1);
  const width = image.width * ratio;
  const height = image.height * ratio;
  const x = (container.width - width) / 2;
  const y = (container.height - height) / 2;
  return { x, y, width, height };
}

export function screenToImage(screen: Point, fit: FitRect, imageSize: Size): Point {
  if (fit.width <= 0 || fit.height <= 0 || imageSize.width <= 0 || imageSize.height <= 0) {
    return { x: 0, y: 0 };
  }
  const scaleX = imageSize.width / fit.width;
  const scaleY = imageSize.height / fit.height;
  return {
    x: (screen.x - fit.x) * scaleX,
    y: (screen.y - fit.y) * scaleY,
  };
}

export function imageToScreen(image: Point, fit: FitRect, imageSize: Size): Point {
  if (imageSize.width <= 0 || imageSize.height <= 0) {
    return { x: fit.x, y: fit.y };
  }
  const scaleX = fit.width / imageSize.width;
  const scaleY = fit.height / imageSize.height;
  return {
    x: fit.x + image.x * scaleX,
    y: fit.y + image.y * scaleY,
  };
}

export function clampToImage(point: Point, imageSize: Size): Point {
  return {
    x: Math.max(0, Math.min(imageSize.width, point.x)),
    y: Math.max(0, Math.min(imageSize.height, point.y)),
  };
}

export function imageToScreenScale(
  fit: FitRect,
  imageSize: Size,
): { scaleX: number; scaleY: number } {
  if (imageSize.width <= 0 || imageSize.height <= 0) {
    return { scaleX: 1, scaleY: 1 };
  }
  return {
    scaleX: fit.width / imageSize.width,
    scaleY: fit.height / imageSize.height,
  };
}
