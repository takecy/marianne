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

export interface CanvasState {
  shapes: Shape[];
  selectedShapeId: string | null;
  past: Shape[][];
  future: Shape[][];
  clipboardShape: Shape | null;
  // The `shapes` array as it was at the moment of the last successful PNG
  // file export, compared by reference (never deep equality) to decide
  // whether there is unsaved work — see selectHasUnsavedShapes.
  savedShapes: Shape[] | null;
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
  // Atomically replace the entire shape list and reset undo/redo history.
  // Used when the underlying image changes mid-session (e.g. after a crop)
  // so the previous image's history cannot be restored.
  resetShapes: (shapes: Shape[]) => void;
  copyShape: (id: string) => void;
  pasteShape: (imageSize: Size) => void;
  // Record that `snapshot` has been written to a PNG file. The snapshot is
  // passed in by the caller rather than read from the store on purpose: the
  // canvas stays editable while the native save dialog is open, so reading
  // `shapes` at completion time would mark annotations as saved that never
  // reached the file.
  markShapesSaved: (snapshot: Shape[]) => void;
  undo: () => void;
  redo: () => void;
}

// Unsaved-work check for the quit guard. An empty canvas is never unsaved;
// otherwise the work is unsaved unless `shapes` is still the exact array that
// was exported. Identity works here — and deep equality is unnecessary —
// because `withHistory` never reallocates `shapes` for a no-op and undo/redo
// restore the very arrays stored in `past` / `future`, so returning to the
// exported state restores the exported array itself.
//
// The `length > 0` term is not redundant with the identity check: it is what
// makes an emptied canvas quiet. Deleting every shape after a save leaves
// nothing that could be lost — the annotations are in the PNG and the canvas
// holds nothing — and the dialog ("未保存の注釈があります") would be claiming
// annotations that do not exist. Replacing shapes after a save still warns,
// because the surviving shapes make the array differ from `savedShapes`.
// review-skip: 保存済みシェイプを全削除した状態を dirty 扱いすべき - 対応不要: 失われるデータが存在せず（PNG は保存済み・キャンバスは空）、現行実装と同じ挙動で退行ではないため
export function selectHasUnsavedShapes(state: CanvasState): boolean {
  return state.shapes.length > 0 && state.shapes !== state.savedShapes;
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
  savedShapes: null,
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
  // `savedShapes` is cleared alongside the history: it records what was
  // exported from the *current* image, so it is meaningless once the image
  // is replaced or cropped.
  clearShapes: () =>
    set({ shapes: [], selectedShapeId: null, past: [], future: [], savedShapes: null }),
  resetShapes: (shapes) =>
    set({ shapes, selectedShapeId: null, past: [], future: [], savedShapes: null }),
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
  markShapesSaved: (snapshot) => set({ savedShapes: snapshot }),
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
