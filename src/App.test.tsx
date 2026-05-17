import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { useCanvasStore } from "./store/canvasStore";
import type { RectShape } from "./types/shape";

// Mock heavy / canvas-bound child components so we can render App in jsdom
// without pulling in Konva, the Tauri-only updater modal, etc. The point of
// this suite is the paste/drop → confirmation dialog flow inside App.tsx.
vi.mock("./components/CanvasArea", () => ({
  CanvasArea: () => <div data-testid="canvas-area" />,
}));
vi.mock("./components/Sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}));
vi.mock("./components/ActionBar", () => ({
  ActionBar: () => <div data-testid="action-bar" />,
}));
vi.mock("./components/StatusBar", () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}));
vi.mock("./components/UpdateModal", () => ({
  UpdateModal: () => null,
}));

// Tauri & external IO stubs.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
  isTauri: () => false,
}));
vi.mock("@tauri-apps/api/path", () => ({
  dirname: vi.fn(() => Promise.resolve("/tmp")),
  join: vi.fn((a: string, b: string) => Promise.resolve(`${a}/${b}`)),
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
}));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: vi.fn(() => Promise.resolve(vi.fn())),
  }),
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(() => Promise.resolve(new Uint8Array())),
}));

vi.mock("./lib/useUpdater", () => ({
  useUpdater: () => ({
    state: { kind: "idle" as const },
    checkForUpdates: vi.fn(),
    downloadAndInstall: vi.fn(),
    dismiss: vi.fn(),
  }),
}));
vi.mock("./lib/useQuitConfirm", () => ({
  useQuitConfirm: () => ({
    state: { kind: "idle" as const },
    confirmQuit: vi.fn(),
    cancelQuit: vi.fn(),
  }),
}));
vi.mock("./lib/windowResize", () => ({
  applyWindowSizeForImage: vi.fn(() => Promise.resolve()),
}));
vi.mock("./lib/exportImage", () => ({
  copyImageToClipboard: vi.fn(() => Promise.resolve()),
  defaultExportFileName: vi.fn(() => "out.png"),
  exportToBlob: vi.fn(() => Promise.resolve(new Blob())),
  saveBlobToFile: vi.fn(() => Promise.resolve(null)),
}));

// HTMLDialogElement is not implemented in jsdom; provide minimal stubs so
// <dialog> rendered by ConfirmDialog reports its open/closed state and
// reacts to showModal()/close() the way the component expects.
function installDialogPolyfill() {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
  };
  if (!proto.showModal) {
    proto.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  }
  if (!proto.close) {
    proto.close = function close(this: HTMLDialogElement) {
      this.removeAttribute("open");
    };
  }
}

// Pretend img.onload fires synchronously enough for the test by stubbing
// the global Image constructor: any URL counts as a successful decode.
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 100;
  naturalHeight = 80;
  private _src = "";
  get src(): string {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    // Microtask gives waitFor / userEvent's scheduler a chance to drain
    // before listeners read the loaded image.
    queueMicrotask(() => this.onload?.());
  }
}

function buildPasteEvent(file: File): Event {
  const evt = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(evt, "clipboardData", {
    value: {
      items: [{ kind: "file", type: file.type, getAsFile: () => file }],
    },
    configurable: true,
  });
  return evt;
}

function makeRectShape(id: string): RectShape {
  return {
    id,
    type: "rect",
    x: 10,
    y: 10,
    width: 50,
    height: 30,
    color: "red",
    strokeWidth: "thick",
  };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

// ConfirmDialog renders <dialog> unconditionally and toggles the native
// `open` attribute via showModal()/close(). queryByText sees the h2 even
// when closed, so test visibility via the closest <dialog>'s open attr.
function replaceDialogIsOpen(): boolean {
  const heading = screen.queryByText("編集中の注釈があります");
  const dialog = heading?.closest("dialog");
  return dialog?.hasAttribute("open") ?? false;
}

describe("App image replace confirmation", () => {
  beforeEach(() => {
    installDialogPolyfill();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: vi.fn(() => "blob:mock"),
      configurable: true,
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
    });
    vi.stubGlobal("Image", MockImage);
    // Reset Zustand store between tests so previous shapes don't leak.
    useCanvasStore.setState({
      shapes: [],
      past: [],
      future: [],
      selectedShapeId: null,
      clipboardShape: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the image immediately when there are no annotations", async () => {
    render(<App />);
    const file = new File(["x"], "first.png", { type: "image/png" });

    await act(async () => {
      window.dispatchEvent(buildPasteEvent(file));
    });
    await flush();

    // No confirmation dialog is shown.
    expect(replaceDialogIsOpen()).toBe(false);
  });

  it("shows the confirmation dialog when shapes already exist", async () => {
    render(<App />);
    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });

    const file = new File(["x"], "second.png", { type: "image/png" });
    await act(async () => {
      window.dispatchEvent(buildPasteEvent(file));
    });
    await flush();

    expect(replaceDialogIsOpen()).toBe(true);
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
  });

  it("clears shapes when the user confirms replacement", async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });

    const file = new File(["x"], "second.png", { type: "image/png" });
    await act(async () => {
      window.dispatchEvent(buildPasteEvent(file));
    });
    await flush();

    await user.click(screen.getByRole("button", { name: "破棄して読み込み" }));

    expect(useCanvasStore.getState().shapes).toHaveLength(0);
    expect(replaceDialogIsOpen()).toBe(false);
  });

  it("keeps shapes intact when the user cancels", async () => {
    const user = userEvent.setup();
    render(<App />);
    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });

    const file = new File(["x"], "second.png", { type: "image/png" });
    await act(async () => {
      window.dispatchEvent(buildPasteEvent(file));
    });
    await flush();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(useCanvasStore.getState().shapes).toHaveLength(1);
    expect(replaceDialogIsOpen()).toBe(false);
  });

  it("ignores additional paste events while the dialog is open", async () => {
    render(<App />);
    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });

    const first = new File(["a"], "first.png", { type: "image/png" });
    const second = new File(["b"], "second.png", { type: "image/png" });

    await act(async () => {
      window.dispatchEvent(buildPasteEvent(first));
    });
    await flush();
    await act(async () => {
      window.dispatchEvent(buildPasteEvent(second));
    });
    await flush();

    // Dialog stays open; shapes remain. Confirming would replace with the
    // first pending image — verified indirectly by the shapes staying intact
    // until the user explicitly responds.
    expect(replaceDialogIsOpen()).toBe(true);
    expect(useCanvasStore.getState().shapes).toHaveLength(1);
  });
});
