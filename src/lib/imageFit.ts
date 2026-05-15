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

export function fitContain(image: Size, container: Size): FitRect {
  if (image.width <= 0 || image.height <= 0 || container.width <= 0 || container.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const ratio = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * ratio;
  const height = image.height * ratio;
  const x = (container.width - width) / 2;
  const y = (container.height - height) / 2;
  return { x, y, width, height };
}
