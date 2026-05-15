import { create } from "zustand";
import type { Shape } from "@/types/shape";

interface CanvasState {
  shapes: Shape[];
  addShape: (shape: Shape) => void;
  updateShape: (id: string, patch: Partial<Shape>) => void;
  clearShapes: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  shapes: [],
  addShape: (shape) =>
    set((state) => ({
      shapes: [...state.shapes, shape],
    })),
  updateShape: (id, patch) =>
    set((state) => ({
      shapes: state.shapes.map((shape) =>
        shape.id === id ? ({ ...shape, ...patch } as Shape) : shape
      ),
    })),
  clearShapes: () => set({ shapes: [] }),
}));
