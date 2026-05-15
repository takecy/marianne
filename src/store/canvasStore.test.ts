import { beforeEach } from "vitest";
import type { ArrowShape, MosaicShape, RectShape, TextShape } from "@/types/shape";
import { useCanvasStore } from "./canvasStore";

function sampleRect(id: string): RectShape {
  return {
    id,
    type: "rect",
    color: "red",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
  };
}

function sampleText(id: string): TextShape {
  return {
    id,
    type: "text",
    color: "blue",
    x: 5,
    y: 5,
    text: "hello",
  };
}

function sampleArrow(id: string): ArrowShape {
  return {
    id,
    type: "arrow",
    color: "green",
    fromX: 0,
    fromY: 0,
    toX: 50,
    toY: 50,
  };
}

function sampleMosaic(id: string): MosaicShape {
  return {
    id,
    type: "mosaic",
    x: 100,
    y: 100,
    width: 80,
    height: 60,
  };
}

describe("canvasStore", () => {
  beforeEach(() => {
    useCanvasStore.setState({ shapes: [], selectedShapeId: null });
  });

  it("starts with an empty shapes array and no selection", () => {
    expect(useCanvasStore.getState().shapes).toEqual([]);
    expect(useCanvasStore.getState().selectedShapeId).toBeNull();
  });

  it("addShape appends shapes in insertion order", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().addShape(sampleRect("b"));
    const ids = useCanvasStore.getState().shapes.map((s) => s.id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("updateRect merges the patch into the matching rect", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().updateRect("a", { color: "blue", width: 200 });
    const shape = useCanvasStore.getState().shapes[0];
    if (shape?.type === "rect") {
      expect(shape.color).toBe("blue");
      expect(shape.width).toBe(200);
    } else {
      throw new Error("expected shape to remain a rect");
    }
  });

  it("updateText / updateArrow / updateMosaic each update their variant", () => {
    useCanvasStore.getState().addShape(sampleText("t"));
    useCanvasStore.getState().addShape(sampleArrow("a"));
    useCanvasStore.getState().addShape(sampleMosaic("m"));
    useCanvasStore.getState().updateText("t", { text: "world" });
    useCanvasStore.getState().updateArrow("a", { toX: 999 });
    useCanvasStore.getState().updateMosaic("m", { width: 999 });
    const shapes = useCanvasStore.getState().shapes;
    const text = shapes.find((s) => s.id === "t");
    const arrow = shapes.find((s) => s.id === "a");
    const mosaic = shapes.find((s) => s.id === "m");
    if (text?.type === "text") expect(text.text).toBe("world");
    if (arrow?.type === "arrow") expect(arrow.toX).toBe(999);
    if (mosaic?.type === "mosaic") expect(mosaic.width).toBe(999);
  });

  it("updateRect is a no-op when the id is unknown", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().updateRect("missing", { color: "blue" });
    const shape = useCanvasStore.getState().shapes[0];
    if (shape?.type === "rect") {
      expect(shape.color).toBe("red");
    }
  });

  it("updateRect is a no-op when the id refers to a different variant", () => {
    // sampleText starts with color: "blue".
    // If updateRect mistakenly applied its patch to a text shape, color would become
    // "red" and a stray `width` field would be attached. The runtime guard in
    // patchByType prevents both.
    useCanvasStore.getState().addShape(sampleText("t"));
    useCanvasStore.getState().updateRect("t", { color: "red", width: 999 });
    const shape = useCanvasStore.getState().shapes[0];
    expect(shape?.type).toBe("text");
    if (shape?.type === "text") {
      expect(shape.color).toBe("blue");
      expect(shape).not.toHaveProperty("width");
    }
  });

  it("selectShape sets and clears selectedShapeId", () => {
    useCanvasStore.getState().selectShape("a");
    expect(useCanvasStore.getState().selectedShapeId).toBe("a");
    useCanvasStore.getState().selectShape(null);
    expect(useCanvasStore.getState().selectedShapeId).toBeNull();
  });

  it("deleteShape removes the shape and resets selectedShapeId when matching", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().addShape(sampleRect("b"));
    useCanvasStore.getState().selectShape("a");
    useCanvasStore.getState().deleteShape("a");
    const ids = useCanvasStore.getState().shapes.map((s) => s.id);
    expect(ids).toEqual(["b"]);
    expect(useCanvasStore.getState().selectedShapeId).toBeNull();
  });

  it("deleteShape keeps selectedShapeId when a different shape is deleted", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().addShape(sampleRect("b"));
    useCanvasStore.getState().selectShape("a");
    useCanvasStore.getState().deleteShape("b");
    expect(useCanvasStore.getState().selectedShapeId).toBe("a");
  });

  it("clearShapes empties the array and resets selection", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    useCanvasStore.getState().clearShapes();
    expect(useCanvasStore.getState().shapes).toEqual([]);
    expect(useCanvasStore.getState().selectedShapeId).toBeNull();
  });
});
