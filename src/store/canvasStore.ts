import { create } from "zustand";
import type { ArrowShape, MosaicShape, RectShape, Shape, TextShape } from "@/types/shape";

type RectPatch = Partial<Omit<RectShape, "id" | "type">>;
type TextPatch = Partial<Omit<TextShape, "id" | "type">>;
type ArrowPatch = Partial<Omit<ArrowShape, "id" | "type">>;
type MosaicPatch = Partial<Omit<MosaicShape, "id" | "type">>;

interface CanvasState {
  shapes: Shape[];
  selectedShapeId: string | null;
  addShape: (shape: Shape) => void;
  updateRect: (id: string, patch: RectPatch) => void;
  updateText: (id: string, patch: TextPatch) => void;
  updateArrow: (id: string, patch: ArrowPatch) => void;
  updateMosaic: (id: string, patch: MosaicPatch) => void;
  deleteShape: (id: string) => void;
  selectShape: (id: string | null) => void;
  clearShapes: () => void;
}

function patchByType<T extends Shape["type"]>(
  shapes: Shape[],
  id: string,
  type: T,
  patch: Record<string, unknown>,
): Shape[] {
  return shapes.map((shape) =>
    shape.id === id && shape.type === type ? ({ ...shape, ...patch } as Shape) : shape
  );
}

export const useCanvasStore = create<CanvasState>((set) => ({
  shapes: [],
  selectedShapeId: null,
  addShape: (shape) =>
    set((state) => ({
      shapes: [...state.shapes, shape],
    })),
  updateRect: (id, patch) =>
    set((state) => ({
      shapes: patchByType(state.shapes, id, "rect", patch),
    })),
  updateText: (id, patch) =>
    set((state) => ({
      shapes: patchByType(state.shapes, id, "text", patch),
    })),
  updateArrow: (id, patch) =>
    set((state) => ({
      shapes: patchByType(state.shapes, id, "arrow", patch),
    })),
  updateMosaic: (id, patch) =>
    set((state) => ({
      shapes: patchByType(state.shapes, id, "mosaic", patch),
    })),
  deleteShape: (id) =>
    set((state) => ({
      shapes: state.shapes.filter((shape) => shape.id !== id),
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId,
    })),
  selectShape: (id) => set({ selectedShapeId: id }),
  clearShapes: () => set({ shapes: [], selectedShapeId: null }),
}));
