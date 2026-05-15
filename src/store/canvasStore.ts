import { create } from "zustand";
import type { ArrowShape, MosaicShape, RectShape, Shape, TextShape } from "@/types/shape";

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
  addShape: (shape: Shape) => void;
  updateRect: (id: string, patch: RectPatch) => void;
  updateText: (id: string, patch: TextPatch) => void;
  updateArrow: (id: string, patch: ArrowPatch) => void;
  updateMosaic: (id: string, patch: MosaicPatch) => void;
  deleteShape: (id: string) => void;
  selectShape: (id: string | null) => void;
  clearShapes: () => void;
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
  addShape: (shape) => set((state) => withHistory(state, [...state.shapes, shape])),
  updateRect: (id, patch) =>
    set((state) => withHistory(state, patchByType(state.shapes, id, "rect", patch))),
  updateText: (id, patch) =>
    set((state) => withHistory(state, patchByType(state.shapes, id, "text", patch))),
  updateArrow: (id, patch) =>
    set((state) => withHistory(state, patchByType(state.shapes, id, "arrow", patch))),
  updateMosaic: (id, patch) =>
    set((state) => withHistory(state, patchByType(state.shapes, id, "mosaic", patch))),
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
