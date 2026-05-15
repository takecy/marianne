import { beforeEach } from "vitest";
import type { RectShape } from "@/types/shape";
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

describe("canvasStore", () => {
  beforeEach(() => {
    useCanvasStore.setState({ shapes: [] });
  });

  it("starts with an empty shapes array", () => {
    expect(useCanvasStore.getState().shapes).toEqual([]);
  });

  it("addShape appends shapes in insertion order", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().addShape(sampleRect("b"));
    const ids = useCanvasStore.getState().shapes.map((s) => s.id);
    expect(ids).toEqual(["a", "b"]);
  });

  it("updateShape merges patch into the matching shape", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().updateShape("a", { color: "blue" });
    const updated = useCanvasStore.getState().shapes[0];
    expect(updated?.color).toBe("blue");
    expect(updated?.type).toBe("rect");
  });

  it("updateShape is a no-op when the id is unknown", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().updateShape("missing", { color: "blue" });
    expect(useCanvasStore.getState().shapes[0]?.color).toBe("red");
  });

  it("clearShapes empties the array", () => {
    useCanvasStore.getState().addShape(sampleRect("a"));
    useCanvasStore.getState().clearShapes();
    expect(useCanvasStore.getState().shapes).toEqual([]);
  });
});
