import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, vi } from "vitest";
import { t } from "@/i18n/translate";
import { DEFAULT_ZOOM_STATE, type ZoomState } from "@/lib/zoomGesture";
import type { LoadedImage } from "@/types/image";
import type { Shape } from "@/types/shape";
import { CanvasArea } from "./CanvasArea";

// jsdom does not implement matchMedia or ResizeObserver, which CanvasArea
// touches on mount via useThemeMode and a container-size effect. Install
// minimal stubs. The ResizeObserver stub also overrides clientWidth/Height
// on the observed element so the `size` state in CanvasArea ends up with a
// realistic test-only viewport (1000x800), enabling wheel-pan tests that
// depend on `fit` being non-zero.
/* eslint-disable @typescript-eslint/no-empty-function */
const noop = () => {};
const STAGE_TEST_WIDTH = 1000;
const STAGE_TEST_HEIGHT = 800;
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
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get(this: HTMLElement) {
      // Only override for the CanvasArea container, identified by its
      // aria-label (CSS module class names are hashed so unreliable in tests).
      // Defaults to 0 elsewhere so we don't affect unrelated DOM measurements.
      return this.getAttribute?.("aria-label") === "Canvas" ? STAGE_TEST_WIDTH : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.getAttribute?.("aria-label") === "Canvas" ? STAGE_TEST_HEIGHT : 0;
    },
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
// so the component mounts. The Stage stub exposes `onWheel` so wheel-event
// tests can dispatch via `fireEvent.wheel(screen.getByTestId("stage"), ...)`.
vi.mock("react-konva", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const Stage = ({
    children,
    onWheel,
  }: {
    children?: React.ReactNode;
    onWheel?: (event: { evt: WheelEvent; target: { getStage: () => unknown } }) => void;
  }) => (
    <div
      data-testid="stage"
      onWheel={(e) => {
        onWheel?.({
          evt: e.nativeEvent,
          target: { getStage: () => ({ getPointerPosition: () => ({ x: 0, y: 0 }) }) },
        });
      }}
    >
      {children}
    </div>
  );
  return {
    Image: () => null,
    Layer: passthrough,
    Line: () => null,
    Rect: () => null,
    Stage,
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
    onShapesAdded: vi.fn(),
    onSelectShape: vi.fn(),
    onDeleteShape: vi.fn(),
    onCropImage: vi.fn(),
    onUpdateRect: vi.fn(),
    onUpdateText: vi.fn(),
    onUpdateArrow: vi.fn(),
    onUpdateMosaic: vi.fn(),
    onCopyShape: vi.fn(),
    onPasteShape: vi.fn(),
    onAfterPaste: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onExportToFile: vi.fn(),
    onExportToClipboard: vi.fn(),
    onZoomChange: vi.fn(),
  };
  const shapes: Shape[] = [];
  render(
    <CanvasArea
      image={null}
      isDraggingOver={false}
      shapes={shapes}
      activeTool="select"
      activeColor="red"
      activeStrokeWidth="thick"
      selectedShapeId={null}
      hasClipboardShape={false}
      zoomState={DEFAULT_ZOOM_STATE}
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

  it("invokes onExportToClipboard when Meta+Shift+C is pressed", () => {
    const { onExportToClipboard, onCopyShape } = renderCanvas();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "c", metaKey: true, shiftKey: true }),
    );
    expect(onExportToClipboard).toHaveBeenCalledTimes(1);
    // Shift+C must NOT invoke the shape-copy handler (which is the plain Cmd+C).
    expect(onCopyShape).not.toHaveBeenCalled();
  });

  it("also accepts Ctrl+Shift+C for non-mac platforms", () => {
    const { onExportToClipboard } = renderCanvas();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "c", ctrlKey: true, shiftKey: true }),
    );
    expect(onExportToClipboard).toHaveBeenCalledTimes(1);
  });

  it("accepts uppercase C as the key for clipboard export", () => {
    const { onExportToClipboard } = renderCanvas();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "C", metaKey: true, shiftKey: true }),
    );
    expect(onExportToClipboard).toHaveBeenCalledTimes(1);
  });

  it("renders the empty-state hint when no image is loaded", () => {
    renderCanvas();
    expect(screen.getByText(t("canvas.empty.title"))).toBeInTheDocument();
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

describe("CanvasArea copy/paste shortcuts", () => {
  it("invokes onCopyShape on Cmd+C when a shape is selected in select mode", () => {
    const { onCopyShape } = renderCanvas({
      image: makeLoadedImage(),
      activeTool: "select",
      selectedShapeId: "shape-1",
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true }));
    expect(onCopyShape).toHaveBeenCalledWith("shape-1");
  });

  it("also accepts Ctrl+C for non-mac platforms", () => {
    const { onCopyShape } = renderCanvas({
      image: makeLoadedImage(),
      activeTool: "select",
      selectedShapeId: "shape-1",
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", ctrlKey: true }));
    expect(onCopyShape).toHaveBeenCalledWith("shape-1");
  });

  it("does not copy when not in select mode (e.g. rect tool active)", () => {
    const { onCopyShape } = renderCanvas({
      image: makeLoadedImage(),
      activeTool: "rect",
      selectedShapeId: "shape-1",
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true }));
    expect(onCopyShape).not.toHaveBeenCalled();
  });

  it("does not copy when nothing is selected", () => {
    const { onCopyShape } = renderCanvas({
      image: makeLoadedImage(),
      activeTool: "select",
      selectedShapeId: null,
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", metaKey: true }));
    expect(onCopyShape).not.toHaveBeenCalled();
  });

  it("invokes onPasteShape and onAfterPaste on Cmd+V when clipboard has a shape", () => {
    const { onPasteShape, onAfterPaste } = renderCanvas({
      image: makeLoadedImage(),
      hasClipboardShape: true,
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", metaKey: true }));
    expect(onPasteShape).toHaveBeenCalledWith({ width: 100, height: 100 });
    expect(onAfterPaste).toHaveBeenCalledTimes(1);
  });

  it("does not paste when the clipboard is empty (lets useImageLoader handle it)", () => {
    const { onPasteShape, onAfterPaste } = renderCanvas({
      image: makeLoadedImage(),
      hasClipboardShape: false,
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", metaKey: true }));
    expect(onPasteShape).not.toHaveBeenCalled();
    expect(onAfterPaste).not.toHaveBeenCalled();
  });

  it("does not paste when no image is loaded", () => {
    const { onPasteShape } = renderCanvas({
      image: null,
      hasClipboardShape: true,
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", metaKey: true }));
    expect(onPasteShape).not.toHaveBeenCalled();
  });

  it("paste works regardless of the active tool (not gated on select mode)", () => {
    const { onPasteShape } = renderCanvas({
      image: makeLoadedImage(),
      activeTool: "rect",
      hasClipboardShape: true,
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "v", metaKey: true }));
    expect(onPasteShape).toHaveBeenCalledTimes(1);
  });
});

describe("CanvasArea zoom shortcuts", () => {
  it("zooms in on Cmd+= (Meta + equals)", () => {
    const { onZoomChange } = renderCanvas({ image: makeLoadedImage() });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "=", metaKey: true }));
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    const next = onZoomChange.mock.calls[0]?.[0];
    expect(next?.scale).toBeGreaterThan(1);
  });

  it("zooms in on Cmd++ (Meta + Shift + equals on US layouts)", () => {
    const { onZoomChange } = renderCanvas({ image: makeLoadedImage() });
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "+", metaKey: true, shiftKey: true }),
    );
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(onZoomChange.mock.calls[0]?.[0]?.scale).toBeGreaterThan(1);
  });

  it("zooms out on Cmd+-", () => {
    const { onZoomChange } = renderCanvas({
      image: makeLoadedImage(),
      zoomState: { scale: 4, offsetX: 0, offsetY: 0 },
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "-", metaKey: true }));
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(onZoomChange.mock.calls[0]?.[0]?.scale).toBeLessThan(4);
  });

  it("resets to DEFAULT_ZOOM_STATE on Cmd+0", () => {
    const { onZoomChange } = renderCanvas({
      image: makeLoadedImage(),
      zoomState: { scale: 2.5, offsetX: 30, offsetY: 50 },
    });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", metaKey: true }));
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    expect(onZoomChange.mock.calls[0]?.[0]).toEqual(DEFAULT_ZOOM_STATE);
  });

  it("ignores zoom shortcuts when no image is loaded", () => {
    const { onZoomChange } = renderCanvas({ image: null });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "=", metaKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "-", metaKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", metaKey: true }));
    expect(onZoomChange).not.toHaveBeenCalled();
  });

  it("also accepts Ctrl+= / Ctrl+- / Ctrl+0 for non-mac platforms", () => {
    const { onZoomChange } = renderCanvas({ image: makeLoadedImage() });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "=", ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "-", ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "0", ctrlKey: true }));
    expect(onZoomChange).toHaveBeenCalledTimes(3);
  });
});

describe("CanvasArea wheel pan", () => {
  // The shared `beforeAll` block at the top of this file installs an
  // HTMLElement.prototype clientWidth/Height override keyed off the
  // `aria-label="Canvas"` container, so the CanvasArea ends up with
  // size = { 1000, 800 } and a non-zero fit rect.

  // Helper: builds a tall image so X overflows at scale=2 but stays in fit
  // for tests focusing on the X axis.
  const tallImage = (): LoadedImage => ({
    element: new Image(),
    naturalWidth: 2000, // wider than the test stage (1000) at zoom=1 already
    naturalHeight: 800,
    source: "paste",
  });

  it("does not change offset on 2-finger swipe when image fits within the stage (zoom=1)", () => {
    const { onZoomChange } = renderCanvas({
      image: makeLoadedImage(), // 100x100, fits at zoom=1
      zoomState: DEFAULT_ZOOM_STATE,
    });
    fireEvent.wheel(screen.getByTestId("stage"), {
      ctrlKey: false,
      deltaX: 50,
      deltaY: 50,
    });
    // pan branch dropped both deltas, but clampPan still ran to validate the
    // current offset against the latest fit. The resulting state must equal
    // DEFAULT_ZOOM_STATE because at zoom=1 fitContain centers the image and
    // containmentRange collapses to {0}.
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    const next = onZoomChange.mock.calls[0]?.[0] as ZoomState;
    expect(next.scale).toBe(1);
    expect(next.offsetX).toBeCloseTo(0, 6);
    expect(next.offsetY).toBeCloseTo(0, 6);
  });

  it("updates offsetX on 2-finger swipe when image overflows horizontally", () => {
    // 2000x800 image in 1000x800 stage at zoom=1 already overflows X.
    // fitContain caps the ratio at 1, so fit = {x:0, y:0, width:1000, height:400}
    // -> actually 2000:800 vs 1000:800 -> ratio = min(0.5, 1, 1) = 0.5.
    // -> fit = {x:0, y:200, width:1000, height:400}. Hmm — that fits X.
    // So bump the zoom to 2 to force X overflow.
    const { onZoomChange } = renderCanvas({
      image: tallImage(),
      zoomState: { scale: 2, offsetX: 0, offsetY: 0 },
    });
    fireEvent.wheel(screen.getByTestId("stage"), {
      ctrlKey: false,
      deltaX: 100,
      deltaY: 0,
    });
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    const next = onZoomChange.mock.calls[0]?.[0] as ZoomState;
    expect(next.scale).toBe(2);
    // offsetX decreased by deltaX (=100), then clampPan ran. Since 0 was at the
    // maxOffsetX edge (containmentRange's right edge in overflow mode),
    // applying -100 stays within bounds.
    expect(next.offsetX).toBeLessThan(0);
  });

  it("still routes ctrlKey=true wheels through the zoom path (clampPan does not break pinch)", () => {
    const { onZoomChange } = renderCanvas({
      image: makeLoadedImage(),
      zoomState: DEFAULT_ZOOM_STATE,
    });
    fireEvent.wheel(screen.getByTestId("stage"), {
      ctrlKey: true,
      deltaY: -100, // pinch-in
    });
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    const next = onZoomChange.mock.calls[0]?.[0] as ZoomState;
    expect(next.scale).toBeGreaterThan(1);
  });

  it("does not recenter a pinch-anchored non-center offset when 2-finger swiping on a fit axis", () => {
    // 100x100 image in 1000x800 stage at zoom=2 -> scaled image 200x200
    // still fits both axes. A non-center offsetX simulates a pinch landing.
    // fit = fitContain({100,100},{1000,800}) -> ratio=1, fit={x:450,y:350,w:100,h:100}.
    // containmentRange X = [-450*2, 1000-(450+100)*2] = [-900, -100]. Pick -300.
    const { onZoomChange } = renderCanvas({
      image: makeLoadedImage(),
      zoomState: { scale: 2, offsetX: -300, offsetY: -500 },
    });
    fireEvent.wheel(screen.getByTestId("stage"), {
      ctrlKey: false,
      deltaX: 200, // would shift left if it were applied
      deltaY: 200,
    });
    expect(onZoomChange).toHaveBeenCalledTimes(1);
    const next = onZoomChange.mock.calls[0]?.[0] as ZoomState;
    // Both axes fit at scale=2 (200x200 inside 1000x800), so pan deltas are
    // dropped. clampPan then preserves the offset because it sits inside
    // containmentRange. The non-center offset is NOT collapsed to the midpoint.
    expect(next.scale).toBe(2);
    expect(next.offsetX).toBe(-300);
    expect(next.offsetY).toBe(-500);
  });
});
