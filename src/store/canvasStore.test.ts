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
    useCanvasStore.setState({
      shapes: [],
      selectedShapeId: null,
      past: [],
      future: [],
      clipboardShape: null,
    });
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

  it("addShapes appends every shape in the batch in order", () => {
    useCanvasStore.getState().addShapes([sampleRect("a"), sampleRect("b"), sampleRect("c")]);
    const ids = useCanvasStore.getState().shapes.map((s) => s.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("addShapes records the batch as a single history snapshot", () => {
    useCanvasStore.getState().addShapes([sampleRect("a"), sampleRect("b")]);
    expect(useCanvasStore.getState().past.length).toBe(1);
  });

  it("undo after addShapes removes the entire batch in one step", () => {
    useCanvasStore.getState().addShape(sampleRect("pre"));
    useCanvasStore.getState().addShapes([sampleRect("a"), sampleRect("b"), sampleRect("c")]);
    expect(useCanvasStore.getState().shapes.map((s) => s.id)).toEqual(["pre", "a", "b", "c"]);
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().shapes.map((s) => s.id)).toEqual(["pre"]);
  });

  it("addShapes with an empty array is a no-op that does not pollute history", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().addShapes([]);
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
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

  // patchByType does not value-dedupe: a same-value patch still pushes onto
  // past, so callers (e.g. CanvasArea.confirmEditText) must compare before
  // invoking updateText. This regression test pins that contract.
  it("updateText with the same text value still pollutes history", () => {
    useCanvasStore.getState().addShape(sampleText("t"));
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().updateText("t", { text: "hello" });
    expect(useCanvasStore.getState().past.length).toBe(pastBefore + 1);
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

  // --- setSelectedShapeColor ---

  it("setSelectedShapeColor updates the color of a selected rect", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    useCanvasStore.getState().setSelectedShapeColor("blue");
    const shape = useCanvasStore.getState().shapes[0];
    if (shape?.type === "rect") {
      expect(shape.color).toBe("blue");
    } else {
      throw new Error("expected shape to remain a rect");
    }
  });

  it("setSelectedShapeColor updates the color of a selected text", () => {
    useCanvasStore.getState().addShape(sampleText("t"));
    useCanvasStore.getState().selectShape("t");
    useCanvasStore.getState().setSelectedShapeColor("green");
    const shape = useCanvasStore.getState().shapes[0];
    if (shape?.type === "text") {
      expect(shape.color).toBe("green");
    } else {
      throw new Error("expected shape to remain a text");
    }
  });

  it("setSelectedShapeColor updates the color of a selected arrow", () => {
    useCanvasStore.getState().addShape(sampleArrow("a"));
    useCanvasStore.getState().selectShape("a");
    useCanvasStore.getState().setSelectedShapeColor("yellow");
    const shape = useCanvasStore.getState().shapes[0];
    if (shape?.type === "arrow") {
      expect(shape.color).toBe("yellow");
    } else {
      throw new Error("expected shape to remain an arrow");
    }
  });

  it("setSelectedShapeColor is a silent no-op for a selected mosaic", () => {
    useCanvasStore.getState().addShape(sampleMosaic("m"));
    useCanvasStore.getState().selectShape("m");
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeColor("blue");
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeColor is a no-op when nothing is selected", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeColor("blue");
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeColor is a no-op when re-applying the same color", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeColor("red");
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeColor pushes onto past when the color actually changes", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeColor("blue");
    expect(useCanvasStore.getState().past.length).toBe(pastBefore + 1);
  });

  // --- setSelectedShapeStrokeWidth ---

  it("setSelectedShapeStrokeWidth updates the strokeWidth of a selected rect", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    useCanvasStore.getState().setSelectedShapeStrokeWidth("extraThick");
    const shape = useCanvasStore.getState().shapes[0];
    if (shape?.type === "rect") {
      expect(shape.strokeWidth).toBe("extraThick");
    } else {
      throw new Error("expected shape to remain a rect");
    }
  });

  it("setSelectedShapeStrokeWidth is a silent no-op for a selected text shape", () => {
    useCanvasStore.getState().addShape(sampleText("t"));
    useCanvasStore.getState().selectShape("t");
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeStrokeWidth("thin");
    const state = useCanvasStore.getState();
    // Identity-preserved no-op proves the matter-of-fact rect-only contract.
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeStrokeWidth is a silent no-op for a selected arrow", () => {
    useCanvasStore.getState().addShape(sampleArrow("a"));
    useCanvasStore.getState().selectShape("a");
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeStrokeWidth("thin");
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeStrokeWidth is a silent no-op for a selected mosaic", () => {
    useCanvasStore.getState().addShape(sampleMosaic("m"));
    useCanvasStore.getState().selectShape("m");
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeStrokeWidth("medium");
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeStrokeWidth is a no-op when nothing is selected", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeStrokeWidth("thin");
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeStrokeWidth treats an unset strokeWidth as 'thick' (default) and skips same-value clicks", () => {
    // sampleRect has no strokeWidth field — defaulted to "thick" at render time.
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeStrokeWidth("thick");
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeStrokeWidth is a no-op when re-applying the same explicit preset", () => {
    useCanvasStore.getState().addShape({ ...sampleRect("a"), strokeWidth: "medium" });
    useCanvasStore.getState().selectShape("a");
    const shapesBefore = useCanvasStore.getState().shapes;
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeStrokeWidth("medium");
    const state = useCanvasStore.getState();
    expect(state.shapes).toBe(shapesBefore);
    expect(state.past.length).toBe(pastBefore);
  });

  it("setSelectedShapeStrokeWidth pushes onto past when the strokeWidth actually changes", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().setSelectedShapeStrokeWidth("thin");
    expect(useCanvasStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("undo restores the prior strokeWidth after setSelectedShapeStrokeWidth", () => {
    useCanvasStore.getState().addShape({ ...sampleRect("a"), strokeWidth: "thick" });
    useCanvasStore.getState().selectShape("a");
    useCanvasStore.getState().setSelectedShapeStrokeWidth("extraThick");
    useCanvasStore.getState().undo();
    const shape = useCanvasStore.getState().shapes[0];
    if (shape?.type === "rect") {
      expect(shape.strokeWidth).toBe("thick");
    } else {
      throw new Error("expected rect after undo");
    }
  });

  it("undo clears the selectedShapeId for safety", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().selectShape("a");
    expect(useCanvasStore.getState().selectedShapeId).toBe("a");
    useCanvasStore.getState().undo();
    expect(useCanvasStore.getState().selectedShapeId).toBeNull();
  });

  // --- copy / paste ---

  const IMAGE_SIZE = { width: 1000, height: 800 };

  it("copyShape stores the matched shape into clipboardShape", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().copyShape("a");
    const clipboard = useCanvasStore.getState().clipboardShape;
    expect(clipboard?.id).toBe("a");
    expect(clipboard?.type).toBe("rect");
  });

  it("copyShape on an unknown id is a no-op", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().copyShape("missing");
    expect(useCanvasStore.getState().clipboardShape).toBeNull();
  });

  it("copyShape does not push to history", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().copyShape("a");
    expect(useCanvasStore.getState().past.length).toBe(pastBefore);
  });

  it("pasteShape with an empty clipboard is a no-op", () => {
    useCanvasStore.getState().pasteShape(IMAGE_SIZE);
    const state = useCanvasStore.getState();
    expect(state.shapes).toEqual([]);
    expect(state.selectedShapeId).toBeNull();
  });

  it("pasteShape appends a cloned shape with a new id and selects it", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().copyShape("a");
    useCanvasStore.getState().pasteShape(IMAGE_SIZE);
    const state = useCanvasStore.getState();
    expect(state.shapes.length).toBe(2);
    const pasted = state.shapes[1];
    expect(pasted?.id).not.toBe("a");
    expect(state.selectedShapeId).toBe(pasted?.id);
  });

  it("pasteShape pushes the prior shapes onto past for undo", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().copyShape("a");
    const pastBefore = useCanvasStore.getState().past.length;
    useCanvasStore.getState().pasteShape(IMAGE_SIZE);
    expect(useCanvasStore.getState().past.length).toBe(pastBefore + 1);
  });

  it("pasteShape updates clipboardShape to the freshly pasted shape (staircase)", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().copyShape("a");
    useCanvasStore.getState().pasteShape(IMAGE_SIZE);
    const firstPasted = useCanvasStore.getState().clipboardShape;
    useCanvasStore.getState().pasteShape(IMAGE_SIZE);
    const secondPasted = useCanvasStore.getState().clipboardShape;
    if (firstPasted?.type !== "rect" || secondPasted?.type !== "rect") {
      throw new Error("expected rect clipboard entries");
    }
    expect(secondPasted.x).toBeGreaterThan(firstPasted.x);
    expect(secondPasted.y).toBeGreaterThan(firstPasted.y);
  });

  it("undo after pasteShape removes the pasted shape and resets selection", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().copyShape("a");
    useCanvasStore.getState().pasteShape(IMAGE_SIZE);
    expect(useCanvasStore.getState().shapes.length).toBe(2);
    useCanvasStore.getState().undo();
    const state = useCanvasStore.getState();
    expect(state.shapes.map((s) => s.id)).toEqual(["a"]);
    expect(state.selectedShapeId).toBeNull();
  });

  // --- mosaic strengthLevel preservation ---

  it("pasteShape preserves the strengthLevel of a mosaic", () => {
    const strong: MosaicShape = { ...sampleMosaic("m"), strengthLevel: 3 };
    useCanvasStore.getState().addShape(strong);
    useCanvasStore.getState().copyShape("m");
    useCanvasStore.getState().pasteShape(IMAGE_SIZE);
    const pasted = useCanvasStore.getState().shapes[1];
    if (pasted?.type !== "mosaic") {
      throw new Error("expected pasted mosaic");
    }
    expect(pasted.strengthLevel).toBe(3);
  });

  it("undo/redo round-trip preserves the strengthLevel of a mosaic", () => {
    const strong: MosaicShape = { ...sampleMosaic("m"), strengthLevel: 4 };
    useCanvasStore.getState().addShape(strong);
    useCanvasStore.getState().addShape(sampleRect("r"));
    useCanvasStore.getState().undo();
    useCanvasStore.getState().redo();
    const mosaic = useCanvasStore.getState().shapes.find((s) => s.id === "m");
    if (mosaic?.type !== "mosaic") {
      throw new Error("expected mosaic to survive undo/redo");
    }
    expect(mosaic.strengthLevel).toBe(4);
  });
});
