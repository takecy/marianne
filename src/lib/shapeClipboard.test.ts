import type { ArrowShape, MosaicShape, RectShape, TextShape } from "@/types/shape";
import { cloneShapeForPaste, PASTE_OFFSET } from "./shapeClipboard";

const IMAGE_SIZE = { width: 1000, height: 800 };

function sampleRect(): RectShape {
  return { id: "rect-src", type: "rect", color: "red", x: 10, y: 20, width: 100, height: 50 };
}

function sampleText(): TextShape {
  return {
    id: "text-src",
    type: "text",
    color: "blue",
    x: 5,
    y: 5,
    text: "hello",
    fontSize: 36,
  };
}

function sampleArrow(): ArrowShape {
  return {
    id: "arrow-src",
    type: "arrow",
    color: "green",
    fromX: 100,
    fromY: 200,
    toX: 300,
    toY: 250,
  };
}

function sampleMosaic(): MosaicShape {
  return { id: "mosaic-src", type: "mosaic", x: 50, y: 60, width: 80, height: 90 };
}

describe("cloneShapeForPaste", () => {
  it("assigns a new id distinct from the source", () => {
    const cloned = cloneShapeForPaste(sampleRect(), IMAGE_SIZE);
    expect(cloned.id).not.toBe("rect-src");
    expect(cloned.id.length).toBeGreaterThan(0);
  });

  it("offsets a rect by PASTE_OFFSET and preserves width / height / color", () => {
    const source = sampleRect();
    const cloned = cloneShapeForPaste(source, IMAGE_SIZE);
    if (cloned.type !== "rect") throw new Error("expected rect");
    expect(cloned.x).toBe(source.x + PASTE_OFFSET);
    expect(cloned.y).toBe(source.y + PASTE_OFFSET);
    expect(cloned.width).toBe(source.width);
    expect(cloned.height).toBe(source.height);
    expect(cloned.color).toBe(source.color);
  });

  it("offsets a text and preserves text and fontSize", () => {
    const source = sampleText();
    const cloned = cloneShapeForPaste(source, IMAGE_SIZE);
    if (cloned.type !== "text") throw new Error("expected text");
    expect(cloned.x).toBe(source.x + PASTE_OFFSET);
    expect(cloned.y).toBe(source.y + PASTE_OFFSET);
    expect(cloned.text).toBe(source.text);
    expect(cloned.fontSize).toBe(source.fontSize);
  });

  it("offsets a mosaic without introducing a color field", () => {
    const source = sampleMosaic();
    const cloned = cloneShapeForPaste(source, IMAGE_SIZE);
    if (cloned.type !== "mosaic") throw new Error("expected mosaic");
    expect(cloned.x).toBe(source.x + PASTE_OFFSET);
    expect(cloned.y).toBe(source.y + PASTE_OFFSET);
    expect(cloned.width).toBe(source.width);
    expect(cloned.height).toBe(source.height);
    expect("color" in cloned).toBe(false);
  });

  it("offsets an arrow at the from-anchor and preserves the to-from delta", () => {
    const source = sampleArrow();
    const cloned = cloneShapeForPaste(source, IMAGE_SIZE);
    if (cloned.type !== "arrow") throw new Error("expected arrow");
    expect(cloned.fromX).toBe(source.fromX + PASTE_OFFSET);
    expect(cloned.fromY).toBe(source.fromY + PASTE_OFFSET);
    expect(cloned.toX - cloned.fromX).toBe(source.toX - source.fromX);
    expect(cloned.toY - cloned.fromY).toBe(source.toY - source.fromY);
    expect(cloned.color).toBe(source.color);
  });

  it("clamps a rect anchor to image bounds when the offset would overflow", () => {
    const source: RectShape = {
      id: "rect-edge",
      type: "rect",
      color: "red",
      x: IMAGE_SIZE.width - 5,
      y: IMAGE_SIZE.height - 5,
      width: 40,
      height: 40,
    };
    const cloned = cloneShapeForPaste(source, IMAGE_SIZE);
    if (cloned.type !== "rect") throw new Error("expected rect");
    expect(cloned.x).toBe(IMAGE_SIZE.width);
    expect(cloned.y).toBe(IMAGE_SIZE.height);
  });

  it("clamps the arrow from-anchor but keeps the to-from delta intact", () => {
    const source: ArrowShape = {
      id: "arrow-edge",
      type: "arrow",
      color: "green",
      fromX: IMAGE_SIZE.width - 10,
      fromY: IMAGE_SIZE.height - 10,
      toX: IMAGE_SIZE.width + 100,
      toY: IMAGE_SIZE.height - 200,
    };
    const cloned = cloneShapeForPaste(source, IMAGE_SIZE);
    if (cloned.type !== "arrow") throw new Error("expected arrow");
    expect(cloned.fromX).toBe(IMAGE_SIZE.width);
    expect(cloned.fromY).toBe(IMAGE_SIZE.height);
    expect(cloned.toX - cloned.fromX).toBe(source.toX - source.fromX);
    expect(cloned.toY - cloned.fromY).toBe(source.toY - source.fromY);
  });

  it("clones to a fresh object so the source is not mutated", () => {
    const source = sampleRect();
    const cloned = cloneShapeForPaste(source, IMAGE_SIZE);
    expect(cloned).not.toBe(source);
    expect(source.x).toBe(10);
    expect(source.y).toBe(20);
  });
});
