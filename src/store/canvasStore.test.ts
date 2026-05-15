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
    useCanvasStore.setState({ shapes: [], selectedShapeId: null, past: [], future: [] });
  });

  it("starts with an empty shapes array, no selection, and empty history", () => {
    const state = useCanvasStore.getState();
    expect(state.shapes).toEqual([]);
    expect(state.selectedShapeId).toBeNull();
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
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

  it("clearShapes empties shapes, selection, and history", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().addShape(sampleRect("b"));
    useCanvasStore.getState().selectShape("a");
    useCanvasStore.getState().clearShapes();
    const state = useCanvasStore.getState();
    expect(state.shapes).toEqual([]);
    expect(state.selectedShapeId).toBeNull();
    expect(state.past).toEqual([]);
    expect(state.future).toEqual([]);
  });

  // --- history ---

  it("addShape records the prior shapes onto past and clears future", () => {
    useCanvasStore.setState({ future: [[sampleRect("placeholder-future")]] });
    useCanvasStore.getState().addShape(sampleRect("a"));
    const state = useCanvasStore.getState();
    expect(state.past).toEqual([[]]);
    expect(state.future).toEqual([]);
  });

  it("undo rewinds shapes and shifts the prior state onto future", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().addShape(sampleRect("b"));
    expect(useCanvasStore.getState().shapes.map((s) => s.id)).toEqual(["a", "b"]);

    useCanvasStore.getState().undo();
    const afterFirstUndo = useCanvasStore.getState();
    expect(afterFirstUndo.shapes.map((s) => s.id)).toEqual(["a"]);
    expect(afterFirstUndo.past.length).toBe(1);
    expect(afterFirstUndo.future.length).toBe(1);
    expect(afterFirstUndo.selectedShapeId).toBeNull();

    useCanvasStore.getState().undo();
    const afterSecondUndo = useCanvasStore.getState();
    expect(afterSecondUndo.shapes).toEqual([]);
    expect(afterSecondUndo.past.length).toBe(0);
    expect(afterSecondUndo.future.length).toBe(2);
  });

  it("redo replays the latest undone snapshot", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes).toEqual([]);
    useCanvasStore.getState().redo();
    expect(useCanvasStore.getState().shapes.map((s) => s.id)).toEqual(["a"]);
    expect(useCanvasStore.getState().future.length).toBe(0);
  });

  it("a new mutation after undo clears future", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().addShape(sampleRect("b"));
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().future.length).toBe(1);
    useCanvasStore.getState().addShape(sampleRect("c"));
    expect(useCanvasStore.getState().future).toEqual([]);
    expect(useCanvasStore.getState().shapes.map((s) => s.id)).toEqual(["a", "c"]);
  });

  it("respects the HISTORY_LIMIT of 50 by dropping the oldest snapshot", () => {
    for (let i = 0; i < 60; i += 1) {
      useCanvasStore.getState().addShape(sampleRect(`s-${i}`));
    }
    const state = useCanvasStore.getState();
    // Past holds at most 50 snapshots; oldest are dropped.
    expect(state.past.length).toBe(50);
  });

  it("undo is a no-op when past is empty", () => {
    const before = useCanvasStore.getState();
    useCanvasStore.getState().undo();
    const after = useCanvasStore.getState();
    expect(after.shapes).toBe(before.shapes);
    expect(after.past).toBe(before.past);
    expect(after.future).toBe(before.future);
  });

  it("redo is a no-op when future is empty", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    const before = useCanvasStore.getState();
    useCanvasStore.getState().redo();
    const after = useCanvasStore.getState();
    expect(after.shapes).toBe(before.shapes);
    expect(after.future).toBe(before.future);
  });

  it("a no-op updateRect (unknown id) does not consume history", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    const pastLengthBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().updateRect("missing", { color: "blue" });
    expect(useCanvasStore.getState().past.length).toBe(pastLengthBefore);
  });

  it("undo clears the selectedShapeId for safety", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    expect(useCanvasStore.getState().selectedShapeId).toBe("a");
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().selectedShapeId).toBeNull();
  });
});
