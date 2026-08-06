import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { t } from "./i18n/translate";
import { useCanvasStore } from "./store/canvasStore";
import type { RectShape } from "./types/shape";

// Mock heavy / canvas-bound child components so we can render App in jsdom
// without pulling in Konva, the Tauri-only updater modal, etc. The point of
// this suite is the paste/drop → confirmation dialog flow inside App.tsx.
vi.mock("./components/CanvasArea", () => ({
  CanvasArea: () => <div data-testid="canvas-area" />,
}));
// Sidebar and StatusBar are stubbed down to the update-notice surface so the
// wiring in App.tsx (which handler runs, what text reaches the StatusBar) can
// be asserted without pulling in their real markup.
vi.mock("./components/Sidebar", () => ({
  Sidebar: (
    props: { updateNotice?: { kind: string } | null; onUpdateNoticeClick?: () => void },
  ) => (
    <div data-testid="sidebar">
      {props.updateNotice && (
        <button type="button" data-testid="update-notice" onClick={props.onUpdateNoticeClick}>
          {props.updateNotice.kind}
        </button>
      )}
    </div>
  ),
}));
vi.mock("./components/ActionBar", () => ({
  ActionBar: () => <div data-testid="action-bar" />,
}));
vi.mock("./components/StatusBar", () => ({
  StatusBar: (props: { notice?: string | null }) => (
    <div data-testid="status-bar">{props.notice ?? ""}</div>
  ),
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

// Mutable so each test can pin the updater to a specific state. `vi.hoisted`
// keeps the holder alive above the hoisted vi.mock calls.
const updater = vi.hoisted(() => ({
  state: { kind: "idle" } as {
    kind: string;
    version?: string;
    message?: string;
    origin?: string;
  },
  checkForUpdates: vi.fn(() => Promise.resolve("idle")),
  downloadAndInstall: vi.fn(() => Promise.resolve()),
  relaunchNow: vi.fn(() => Promise.resolve()),
  // Captured from the options App passes in, so the tests can evaluate the
  // guard at an arbitrary point in time — which is the whole point of it.
  canRelaunch: undefined as undefined | (() => boolean),
}));
vi.mock("./lib/useUpdater", () => ({
  useUpdater: (options?: { canRelaunch?: () => boolean }) => {
    updater.canRelaunch = options?.canRelaunch;
    return updater;
  },
}));

// Capture the menu handlers so a menu action can be invoked directly; the
// real hook listens on a Tauri event channel that is stubbed out here.
const menu = vi.hoisted(() => ({
  handlers: null as null | { onCheckForUpdates: () => void },
}));
vi.mock("./lib/useMenuAction", () => ({
  useMenuAction: (options: { onCheckForUpdates: () => void }) => {
    menu.handlers = options;
  },
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: () => Promise.resolve("0.3.5"),
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
  const heading = screen.queryByText(t("dialog.imageReplace.title"));
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

    await user.click(screen.getByRole("button", { name: t("dialog.imageReplace.confirm") }));

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

    await user.click(screen.getByRole("button", { name: t("dialog.cancel") }));

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

// ConfirmDialog renders <dialog> unconditionally, so probe the native `open`
// attribute rather than mere presence in the DOM.
function updateDialogIsOpen(): boolean {
  const heading = screen.queryByText(t("dialog.update.title"));
  return heading?.closest("dialog")?.hasAttribute("open") ?? false;
}

describe("App update notice", () => {
  beforeEach(() => {
    installDialogPolyfill();
    updater.state = { kind: "idle" };
    updater.checkForUpdates.mockReset();
    updater.checkForUpdates.mockResolvedValue("idle");
    updater.downloadAndInstall.mockReset();
    updater.downloadAndInstall.mockResolvedValue(undefined);
    menu.handlers = null;
    useCanvasStore.setState({
      shapes: [],
      past: [],
      future: [],
      selectedShapeId: null,
      clipboardShape: null,
    });
  });

  it("renders no notice while the app is up to date", () => {
    updater.state = { kind: "upToDate" };
    render(<App />);
    expect(screen.queryByTestId("update-notice")).not.toBeInTheDocument();
  });

  it("stays silent when the automatic check fails", () => {
    updater.state = { kind: "error", message: "offline", origin: "auto" };
    render(<App />);
    expect(screen.queryByTestId("update-notice")).not.toBeInTheDocument();
  });

  it("installs immediately on click when there are no annotations", async () => {
    const user = userEvent.setup();
    updater.state = { kind: "available", version: "0.3.6" };
    render(<App />);

    await user.click(screen.getByTestId("update-notice"));

    expect(updater.downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(updateDialogIsOpen()).toBe(false);
  });

  it("asks for confirmation first when annotations would be lost", async () => {
    const user = userEvent.setup();
    updater.state = { kind: "available", version: "0.3.6" };
    render(<App />);
    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });

    await user.click(screen.getByTestId("update-notice"));

    expect(updater.downloadAndInstall).not.toHaveBeenCalled();
    expect(updateDialogIsOpen()).toBe(true);

    await user.click(screen.getByRole("button", { name: t("dialog.update.confirm") }));
    expect(updater.downloadAndInstall).toHaveBeenCalledTimes(1);
  });

  it("does not install when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    updater.state = { kind: "available", version: "0.3.6" };
    render(<App />);
    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });

    await user.click(screen.getByTestId("update-notice"));
    await user.click(screen.getByRole("button", { name: t("dialog.cancel") }));

    expect(updater.downloadAndInstall).not.toHaveBeenCalled();
    expect(updateDialogIsOpen()).toBe(false);
  });

  it("still confirms when retrying a failed install with annotations present", async () => {
    // Regression guard: branching on the `failed` notice before the shape
    // check would relaunch the app and discard the annotations silently.
    const user = userEvent.setup();
    updater.state = { kind: "error", message: "signature mismatch", origin: "install" };
    render(<App />);
    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });

    await user.click(screen.getByTestId("update-notice"));

    expect(updater.downloadAndInstall).not.toHaveBeenCalled();
    expect(updateDialogIsOpen()).toBe(true);
  });

  it("reports an up-to-date manual check in the StatusBar", async () => {
    updater.checkForUpdates.mockResolvedValue("upToDate");
    render(<App />);

    const handlers = menu.handlers;
    expect(handlers).not.toBeNull();
    await act(async () => {
      handlers?.onCheckForUpdates();
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByTestId("status-bar")).toHaveTextContent(
        t("update.upToDate.statusWithVersion", { version: "0.3.5" }),
      )
    );
    expect(updater.checkForUpdates).toHaveBeenCalledWith("manual");
  });

  it("reports a failed manual check in the StatusBar and leaves the slot empty", async () => {
    updater.checkForUpdates.mockResolvedValue("error");
    updater.state = { kind: "error", message: "offline", origin: "manual" };
    render(<App />);

    const handlers = menu.handlers;
    expect(handlers).not.toBeNull();
    await act(async () => {
      handlers?.onCheckForUpdates();
      await Promise.resolve();
    });

    await waitFor(() =>
      expect(screen.getByTestId("status-bar")).toHaveTextContent(t("update.checkFailed.status"))
    );
    // A failed check says nothing about whether an update exists, so the
    // bottom-left slot must stay empty.
    expect(screen.queryByTestId("update-notice")).not.toBeInTheDocument();
  });

  it("clears the StatusBar message after the timeout", async () => {
    vi.useFakeTimers();
    try {
      updater.checkForUpdates.mockResolvedValue("upToDate");
      render(<App />);

      const handlers = menu.handlers;
      await act(async () => {
        handlers?.onCheckForUpdates();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(screen.getByTestId("status-bar")).not.toHaveTextContent("");

      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(screen.getByTestId("status-bar")).toHaveTextContent("");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("App update relaunch guard", () => {
  beforeEach(() => {
    installDialogPolyfill();
    updater.state = { kind: "idle" };
    updater.relaunchNow.mockReset();
    updater.relaunchNow.mockResolvedValue(undefined);
    updater.downloadAndInstall.mockReset();
    updater.downloadAndInstall.mockResolvedValue(undefined);
    updater.canRelaunch = undefined;
    useCanvasStore.setState({
      shapes: [],
      past: [],
      future: [],
      selectedShapeId: null,
      clipboardShape: null,
    });
  });

  it("re-evaluates the unsaved guard at relaunch time, not at click time", () => {
    // Regression guard: annotations drawn during the download would be lost
    // to the restart if the decision were frozen when the user clicked.
    render(<App />);
    expect(updater.canRelaunch?.()).toBe(true);

    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });
    expect(updater.canRelaunch?.()).toBe(false);
  });

  it("finishes a parked update directly when nothing would be lost", async () => {
    const user = userEvent.setup();
    updater.state = { kind: "awaitingRelaunch", version: "0.3.6" };
    render(<App />);

    await user.click(screen.getByTestId("update-notice"));

    expect(updater.relaunchNow).toHaveBeenCalledTimes(1);
    expect(updater.downloadAndInstall).not.toHaveBeenCalled();
    expect(updateDialogIsOpen()).toBe(false);
  });

  it("confirms before finishing a parked update while annotations exist", async () => {
    const user = userEvent.setup();
    updater.state = { kind: "awaitingRelaunch", version: "0.3.6" };
    render(<App />);
    act(() => {
      useCanvasStore.getState().addShape(makeRectShape("r1"));
    });

    await user.click(screen.getByTestId("update-notice"));
    expect(updater.relaunchNow).not.toHaveBeenCalled();
    expect(updateDialogIsOpen()).toBe(true);

    await user.click(screen.getByRole("button", { name: t("dialog.update.confirm") }));
    expect(updater.relaunchNow).toHaveBeenCalledTimes(1);
    // Confirming a parked update must not restart the download.
    expect(updater.downloadAndInstall).not.toHaveBeenCalled();
  });
});
