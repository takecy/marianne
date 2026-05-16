import { render, screen } from "@testing-library/react";
import { beforeAll, vi } from "vitest";
import type { LoadedImage } from "@/types/image";
import type { Shape } from "@/types/shape";
import { CanvasArea } from "./CanvasArea";

// jsdom does not implement matchMedia or ResizeObserver, which CanvasArea
// touches on mount via useThemeMode and a container-size effect. Install
// minimal no-op stubs; the keyboard-shortcut tests here don't depend on
// either.
/* eslint-disable @typescript-eslint/no-empty-function */
const noop = () => {};
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    value: () => ({
      matches: false,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
    }),
    configurable: true,
    writable: true,
  });
  class NoopResizeObserver {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  }
  Object.defineProperty(window, "ResizeObserver", {
    value: NoopResizeObserver,
    configurable: true,
    writable: true,
  });
});
/* eslint-enable @typescript-eslint/no-empty-function */

// react-konva touches the canvas API which jsdom cannot satisfy; stub it out
// so the component mounts (we only exercise the window-level keyboard listener
// in this file).
vi.mock("react-konva", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    Image: () => null,
    Layer: passthrough,
    Line: () => null,
    Rect: () => null,
    Stage: passthrough,
    Transformer: () => null,
  };
});

vi.mock("./SelectableShape", () => ({
  SelectableShape: () => null,
}));

vi.mock("./TextInputOverlay", () => ({
  TextInputOverlay: () => null,
}));

function renderCanvas(
  overrides: Partial<Parameters<typeof CanvasArea>[0]> = {},
) {
  const handlers = {
    onToolChange: vi.fn(),
    onShapeAdded: vi.fn(),
    onSelectShape: vi.fn(),
    onDeleteShape: vi.fn(),
    onUpdateRect: vi.fn(),
    onUpdateText: vi.fn(),
    onUpdateArrow: vi.fn(),
    onUpdateMosaic: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onExportToFile: vi.fn(),
  };
  const shapes: Shape[] = [];
  render(
    <CanvasArea
      image={null}
      isDraggingOver={false}
      shapes={shapes}
      activeTool="select"
      activeColor="red"
      selectedShapeId={null}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

function makeLoadedImage(): LoadedImage {
  return {
    element: new Image(),
    naturalWidth: 100,
    naturalHeight: 100,
    source: "paste",
  };
}

describe("CanvasArea keyboard shortcuts", () => {
  it("invokes onExportToFile when Meta+Shift+S is pressed", () => {
    const { onExportToFile } = renderCanvas();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", metaKey: true, shiftKey: true }),
    );
    expect(onExportToFile).toHaveBeenCalledTimes(1);
  });

  it("also accepts Ctrl+Shift+S for non-mac platforms", () => {
    const { onExportToFile } = renderCanvas();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, shiftKey: true }),
    );
    expect(onExportToFile).toHaveBeenCalledTimes(1);
  });

  it("accepts uppercase S as the key (caps lock or shift modifier quirks)", () => {
    const { onExportToFile } = renderCanvas();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "S", metaKey: true, shiftKey: true }),
    );
    expect(onExportToFile).toHaveBeenCalledTimes(1);
  });

  it("ignores Meta+S without Shift (no save without the Shift modifier)", () => {
    const { onExportToFile } = renderCanvas();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "s", metaKey: true, shiftKey: false }),
    );
    expect(onExportToFile).not.toHaveBeenCalled();
  });

  it("does not fire when focus is in a textarea so native shortcuts win", () => {
    const { onExportToFile } = renderCanvas();
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "s",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
      }),
    );
    textarea.remove();
    expect(onExportToFile).not.toHaveBeenCalled();
  });

  it("renders the empty-state hint when no image is loaded", () => {
    renderCanvas();
    expect(screen.getByText("画像を読み込み")).toBeInTheDocument();
  });
});

describe("CanvasArea tool shortcuts", () => {
  it("switches to the text tool when 't' is pressed", () => {
    const { onToolChange } = renderCanvas({ image: makeLoadedImage() });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
    expect(onToolChange).toHaveBeenCalledWith("text");
  });

  it("switches to the select tool when 'v' is pressed", () => {
    const { onToolChange } = renderCanvas({
      image: makeLoadedImage(),
      activeTool: "rect",
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "v" }));
    expect(onToolChange).toHaveBeenCalledWith("select");
  });

  it("ignores tool shortcuts when a modifier key is held (Cmd+t stays free)", () => {
    const { onToolChange } = renderCanvas({ image: makeLoadedImage() });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", metaKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", altKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t", shiftKey: true }));
    expect(onToolChange).not.toHaveBeenCalled();
  });

  it("does not switch tools while focus is in a textarea (native typing wins)", () => {
    const { onToolChange } = renderCanvas({ image: makeLoadedImage() });
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "t", bubbles: true }));
    textarea.remove();
    expect(onToolChange).not.toHaveBeenCalled();
  });

  it("ignores tool shortcuts when no image is loaded (mirrors Toolbar's disabled state)", () => {
    const { onToolChange } = renderCanvas({ image: null });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "t" }));
    expect(onToolChange).not.toHaveBeenCalled();
  });
});
