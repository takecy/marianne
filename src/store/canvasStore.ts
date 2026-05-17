import { create } from "zustand";
import type { Size } from "@/lib/imageFit";
import { cloneShapeForPaste } from "@/lib/shapeClipboard";
import type { ArrowShape, MosaicShape, RectShape, Shape, TextShape } from "@/types/shape";
import type { ColorPresetName, StrokeWidthPresetName } from "@/types/tool";

const HISTORY_LIMIT = 50;

type RectPatch = Partial<Omit<RectShape, "id" | "type">>;
type TextPatch = Partial<Omit<TextShape, "id" | "type">>;
type ArrowPatch = Partial<Omit<ArrowShape, "id" | "type">>;
type MosaicPatch = Partial<Omit<MosaicShape, "id" | "type">>;

interface CanvasState {
  shapes: Shape[];
  selectedShapeId: string | null;
  past: Shape[][];
  future: Shape[][];
  clipboardShape: Shape | null;
  addShape: (shape: Shape) => void;
  addShapes: (shapes: Shape[]) => void;
  updateRect: (id: string, patch: RectPatch) => void;
  updateText: (id: string, patch: TextPatch) => void;
  updateArrow: (id: string, patch: ArrowPatch) => void;
  updateMosaic: (id: string, patch: MosaicPatch) => void;
  setSelectedShapeColor: (color: ColorPresetName) => void;
  setSelectedShapeStrokeWidth: (strokeWidth: StrokeWidthPresetName) => void;
  deleteShape: (id: string) => void;
  selectShape: (id: string | null) => void;
  clearShapes: () => void;
  copyShape: (id: string) => void;
  pasteShape: (imageSize: Size) => void;
  undo: () => void;
  redo: () => void;
}

function patchByType<T extends Shape["type"]>(
  shapes: Shape[],
  id: string,
  type: T,
  patch: Record<string, unknown>,
): Shape[] {
  let changed = false;
  const next = shapes.map((shape) => {
    if (shape.id === id && shape.type === type) {
      changed = true;
      return { ...shape, ...patch } as Shape;
    }
    return shape;
  });
  // Identity-preserving no-op: do not allocate a new array when nothing matched.
  return changed ? next : shapes;
}

// Push current shapes onto past, cap at HISTORY_LIMIT, clear future, then apply
// the new shapes. Returns the partial state slice to be merged by Zustand.
// If `nextShapes` is referentially identical to `current.shapes`, this is a
// no-op (no history pollution from updateXxx() calls that didn't match).
function withHistory(
  current: { shapes: Shape[]; past: Shape[][]; future: Shape[][] },
  nextShapes: Shape[],
): { shapes: Shape[]; past: Shape[][]; future: Shape[][] } {
  if (nextShapes === current.shapes) {
    return { shapes: current.shapes, past: current.past, future: current.future };
  }
  const past = [...current.past, current.shapes];
  if (past.length > HISTORY_LIMIT) {
    past.shift();
  }
  return { shapes: nextShapes, past, future: [] };
}

export const useCanvasStore = create<CanvasState>((set) => ({
  shapes: [],
  selectedShapeId: null,
  past: [],
  future: [],
  clipboardShape: null,
  addShape: (shape) => set((state) => withHistory(state, [...state.shapes, shape])),
  // Append multiple shapes as a single history transaction. One undo rewinds
  // the entire batch — used by mosaic stacking, where one user drag may emit a
  // base shape plus per-overlap strength overlays.
  addShapes: (shapes) =>
    set((state) => {
      if (shapes.length === 0) {
        return state;
      }
      return withHistory(state, [...state.shapes, ...shapes]);
    }),
  updateRect: (id, patch) =>
    set((state) => withHistory(state, patchByType(state.shapes, id, "rect", patch))),
  updateText: (id, patch) =>
    set((state) => withHistory(state, patchByType(state.shapes, id, "text", patch))),
  updateArrow: (id, patch) =>
    set((state) => withHistory(state, patchByType(state.shapes, id, "arrow", patch))),
  updateMosaic: (id, patch) =>
    set((state) => withHistory(state, patchByType(state.shapes, id, "mosaic", patch))),
  // Apply `color` to the currently selected shape (rect / text / arrow only).
  // No-op when nothing is selected, the selected shape is a mosaic, or the
  // requested color matches the shape's current color — this keeps the
  // undo history clean for identical re-clicks.
  setSelectedShapeColor: (color) =>
    set((state) => {
      const id = state.selectedShapeId;
      if (id === null) {
        return {};
      }
      const shape = state.shapes.find((s) => s.id === id);
      if (shape === undefined) {
        return {};
      }
      let next: Shape[] = state.shapes;
      switch (shape.type) {
        case "rect":
          if (shape.color === color) return {};
          next = patchByType(state.shapes, id, "rect", { color });
          break;
        case "text":
          if (shape.color === color) return {};
          next = patchByType(state.shapes, id, "text", { color });
          break;
        case "arrow":
          if (shape.color === color) return {};
          next = patchByType(state.shapes, id, "arrow", { color });
          break;
        case "mosaic":
          // Mosaic shapes have no color field — silent no-op.
          return {};
      }
      return withHistory(state, next);
    }),
  // Apply `strokeWidth` to the currently selected shape (rect only). Other
  // shape types (text / arrow / mosaic) are intentional silent no-ops because
  // the "矩形用" requirement (Issue #1 Phase 11) restricts width adjustment to
  // rectangles. Unset → "thick" defaulting is applied so an unstored value
  // matching the default does not pollute undo history.
  setSelectedShapeStrokeWidth: (strokeWidth) =>
    set((state) => {
      const id = state.selectedShapeId;
      if (id === null) {
        return {};
      }
      const shape = state.shapes.find((s) => s.id === id);
      if (shape === undefined || shape.type !== "rect") {
        return {};
      }
      const current = shape.strokeWidth ?? "thick";
      if (current === strokeWidth) {
        return {};
      }
      const next = patchByType(state.shapes, id, "rect", { strokeWidth });
      return withHistory(state, next);
    }),
  deleteShape: (id) =>
    set((state) => {
      const next = state.shapes.filter((shape) => shape.id !== id);
      return {
        ...withHistory(state, next),
        selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId,
      };
    }),
  selectShape: (id) => set({ selectedShapeId: id }),
  clearShapes: () => set({ shapes: [], selectedShapeId: null, past: [], future: [] }),
  copyShape: (id) =>
    set((state) => {
      const shape = state.shapes.find((s) => s.id === id);
      if (!shape) {
        return state;
      }
      return { clipboardShape: shape };
    }),
  // Atomic paste: append the cloned shape, select it, and update
  // clipboardShape to the new shape so the next paste staircases off
  // the latest position (Figma-like behaviour).
  pasteShape: (imageSize) =>
    set((state) => {
      if (state.clipboardShape === null) {
        return state;
      }
      const cloned = cloneShapeForPaste(state.clipboardShape, imageSize);
      const history = withHistory(state, [...state.shapes, cloned]);
      return {
        ...history,
        selectedShapeId: cloned.id,
        clipboardShape: cloned,
      };
    }),
  undo: () =>
    set((state) => {
      const previous = state.past[state.past.length - 1];
      if (previous === undefined) {
        return state;
      }
      return {
        shapes: previous,
        past: state.past.slice(0, -1),
        future: [state.shapes, ...state.future],
        selectedShapeId: null,
      };
    }),
  redo: () =>
    set((state) => {
      const next = state.future[0];
      if (next === undefined) {
        return state;
      }
      return {
        shapes: next,
        past: [...state.past, state.shapes],
        future: state.future.slice(1),
        selectedShapeId: null,
      };
    }),
}));
