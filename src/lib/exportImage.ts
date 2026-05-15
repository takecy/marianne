import Konva from "konva";
import { MOSAIC_NATURAL_PIXEL_SIZE } from "@/components/MosaicNode";
import type { LoadedImage } from "@/types/image";
import type { Shape } from "@/types/shape";
import { colorHex } from "@/types/tool";

const MOSAIC_EXPORT_FLAG = "isMosaicExport";

function buildShapeNode(shape: Shape, image: LoadedImage): Konva.Shape {
  if (shape.type === "rect") {
    return new Konva.Rect({
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
      stroke: colorHex(shape.color),
      strokeWidth: 4,
      listening: false,
    });
  }
  if (shape.type === "text") {
    return new Konva.Text({
      x: shape.x,
      y: shape.y,
      text: shape.text,
      fontSize: 24,
      fontFamily: "sans-serif",
      fill: colorHex(shape.color),
      listening: false,
    });
  }
  if (shape.type === "arrow") {
    return new Konva.Arrow({
      points: [shape.fromX, shape.fromY, shape.toX, shape.toY],
      stroke: colorHex(shape.color),
      strokeWidth: 4,
      fill: colorHex(shape.color),
      pointerLength: 14,
      pointerWidth: 14,
      shadowBlur: 6,
      shadowColor: "rgba(0,0,0,0.45)",
      shadowOffsetX: 1,
      shadowOffsetY: 2,
      listening: false,
    });
  }
  // mosaic
  const node = new Konva.Image({
    image: image.element,
    x: shape.x,
    y: shape.y,
    width: shape.width,
    height: shape.height,
    crop: {
      x: shape.x,
      y: shape.y,
      width: shape.width,
      height: shape.height,
    },
    filters: [Konva.Filters.Pixelate],
    pixelSize: MOSAIC_NATURAL_PIXEL_SIZE,
    listening: false,
  });
  node.setAttr(MOSAIC_EXPORT_FLAG, true);
  return node;
}

export async function exportToBlob(image: LoadedImage, shapes: Shape[]): Promise<Blob> {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-99999px";
  container.style.top = "-99999px";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  let stage: Konva.Stage | null = null;
  try {
    stage = new Konva.Stage({
      container,
      width: image.naturalWidth,
      height: image.naturalHeight,
    });

    const imageLayer = new Konva.Layer({ listening: false });
    imageLayer.add(
      new Konva.Image({
        image: image.element,
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }),
    );
    stage.add(imageLayer);

    const shapeLayer = new Konva.Layer({ listening: false });
    for (const shape of shapes) {
      shapeLayer.add(buildShapeNode(shape, image));
    }
    stage.add(shapeLayer);

    // Apply Pixelate cache synchronously before toCanvas.
    // pixelRatio: 1 prevents Retina (DPR=2) from doubling the cache canvas and
    // shrinking the apparent pixel block size.
    for (const node of shapeLayer.getChildren() as Konva.Shape[]) {
      if (node.getAttr(MOSAIC_EXPORT_FLAG) === true) {
        node.cache({ pixelRatio: 1 });
      }
    }
    stage.draw();

    const canvas = stage.toCanvas({ pixelRatio: 1 });
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("toBlob returned null"));
        }
      }, "image/png");
    });
  } finally {
    stage?.destroy();
    container.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function copyImageToClipboard(blobPromise: Promise<Blob>): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    return Promise.reject(new Error("Clipboard API is not available"));
  }
  // Pass the Promise<Blob> directly to ClipboardItem so the write() call
  // is initiated synchronously inside the user-gesture handler. Awaiting the
  // blob first would lose the transient user activation token under
  // WebKit/WKWebView.
  return navigator.clipboard.write([
    new ClipboardItem({ "image/png": blobPromise }),
  ]);
}

export function generateExportFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `marianne-${yyyy}${mm}${dd}-${hh}${mi}${ss}.png`;
}
