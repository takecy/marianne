import { renderHook, waitFor } from "@testing-library/react";
import type { LoadedImage } from "@/types/image";
import { useImageLoader } from "./useImageLoader";

const ERROR_MARKER = "blob:trigger-error";

// Drag-drop handler captured by the mocked @tauri-apps/api/webview module.
let capturedDragDropHandler:
  | ((event: { payload: DragDropPayload }) => void)
  | null = null;
const mockUnlisten = vi.fn();
const mockReadFile = vi.fn();

type DragDropPayload =
  | { type: "enter"; paths: string[]; position: { x: number; y: number } }
  | { type: "over"; position: { x: number; y: number } }
  | { type: "drop"; paths: string[]; position: { x: number; y: number } }
  | { type: "leave" };

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: (handler: (event: { payload: DragDropPayload }) => void) => {
      capturedDragDropHandler = handler;
      return Promise.resolve(mockUnlisten);
    },
  }),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;
  private _src = "";
  get src(): string {
    return this._src;
  }
  set src(value: string) {
    this._src = value;
    queueMicrotask(() => {
      if (value === ERROR_MARKER) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  }
}

function buildPasteEvent(
  items: { kind: string; type: string; getAsFile: () => File | null }[],
): Event {
  const evt = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(evt, "clipboardData", {
    value: { items },
    configurable: true,
  });
  return evt;
}

function buildDropEvent(files: File[]): Event {
  const evt = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(evt, "dataTransfer", {
    value: { files },
    configurable: true,
  });
  return evt;
}

function buildDragOverEvent(): Event {
  return new Event("dragover", { bubbles: true, cancelable: true });
}

function installUrlAndImageStubs(): {
  createObjectURL: ReturnType<typeof vi.fn>;
  revokeObjectURL: ReturnType<typeof vi.fn>;
} {
  const createObjectURL = vi.fn(() => "blob:mock");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(globalThis.URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
  });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
  });
  vi.stubGlobal("Image", MockImage);
  return { createObjectURL, revokeObjectURL };
}

describe("useImageLoader (browser fallback)", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const stubs = installUrlAndImageStubs();
    createObjectURL = stubs.createObjectURL;
    revokeObjectURL = stubs.revokeObjectURL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls onImageLoaded when an image is pasted from the clipboard", async () => {
    const onImageLoaded = vi.fn<(loaded: LoadedImage) => void>();
    renderHook(() => useImageLoader({ onImageLoaded }));

    const file = new File(["bytes"], "screenshot.png", { type: "image/png" });
    const evt = buildPasteEvent([
      { kind: "file", type: "image/png", getAsFile: () => file },
    ]);
    window.dispatchEvent(evt);

    await waitFor(() => expect(onImageLoaded).toHaveBeenCalledTimes(1));
    const loaded = onImageLoaded.mock.calls[0]?.[0];
    expect(loaded?.source).toBe("paste");
    expect(loaded?.sourceFileName).toBe("screenshot.png");
    expect(loaded?.sourcePath).toBeUndefined();
    expect(loaded?.naturalWidth).toBe(800);
    expect(loaded?.naturalHeight).toBe(600);
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("calls onImageLoaded and preventDefault when an image file is dropped", async () => {
    const onImageLoaded = vi.fn<(loaded: LoadedImage) => void>();
    renderHook(() => useImageLoader({ onImageLoaded }));

    const file = new File(["bytes"], "drop.png", { type: "image/png" });
    const dropEvent = buildDropEvent([file]);
    const preventDefaultSpy = vi.spyOn(dropEvent, "preventDefault");

    const dragOverEvent = buildDragOverEvent();
    const dragOverPreventDefault = vi.spyOn(dragOverEvent, "preventDefault");
    window.dispatchEvent(dragOverEvent);
    window.dispatchEvent(dropEvent);

    expect(dragOverPreventDefault).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();

    await waitFor(() => expect(onImageLoaded).toHaveBeenCalledTimes(1));
    const loaded = onImageLoaded.mock.calls[0]?.[0];
    expect(loaded?.source).toBe("drop");
    expect(loaded?.sourceFileName).toBe("drop.png");
    expect(loaded?.sourcePath).toBeUndefined();
  });

  it("ignores non-image MIME types on drop", () => {
    const onImageLoaded = vi.fn<(loaded: LoadedImage) => void>();
    renderHook(() => useImageLoader({ onImageLoaded }));

    const file = new File(["text"], "notes.txt", { type: "text/plain" });
    window.dispatchEvent(buildDropEvent([file]));

    expect(onImageLoaded).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("invokes onError when the image fails to load", async () => {
    createObjectURL.mockReturnValue(ERROR_MARKER);

    const onImageLoaded = vi.fn<(loaded: LoadedImage) => void>();
    const onError = vi.fn<(message: string) => void>();
    renderHook(() => useImageLoader({ onImageLoaded, onError }));

    const file = new File(["bytes"], "broken.png", { type: "image/png" });
    window.dispatchEvent(buildDropEvent([file]));

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith("画像の読み込みに失敗しました");
    expect(onImageLoaded).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith(ERROR_MARKER);
  });
});

describe("useImageLoader (Tauri native drag-drop)", () => {
  beforeEach(() => {
    installUrlAndImageStubs();
    capturedDragDropHandler = null;
    mockUnlisten.mockClear();
    mockReadFile.mockReset();
    // Flip isTauri() to true. The runtime check is `!!(globalThis || window).isTauri`.
    (globalThis as unknown as { isTauri?: boolean }).isTauri = true;
  });

  afterEach(() => {
    delete (globalThis as unknown as { isTauri?: boolean }).isTauri;
    vi.unstubAllGlobals();
  });

  it("emits sourcePath and sourceFileName from a Tauri drop event", async () => {
    mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));

    const onImageLoaded = vi.fn<(loaded: LoadedImage) => void>();
    renderHook(() => useImageLoader({ onImageLoaded }));

    await waitFor(() => expect(capturedDragDropHandler).not.toBeNull());
    if (!capturedDragDropHandler) throw new Error("drag-drop handler not captured");

    capturedDragDropHandler({
      payload: {
        type: "drop",
        paths: ["/Users/test/Pictures/photo.png"],
        position: { x: 0, y: 0 },
      },
    });

    await waitFor(() =>
      expect(mockReadFile).toHaveBeenCalledWith("/Users/test/Pictures/photo.png")
    );
    await waitFor(() => expect(onImageLoaded).toHaveBeenCalledTimes(1));

    const loaded = onImageLoaded.mock.calls[0]?.[0];
    expect(loaded?.source).toBe("drop");
    expect(loaded?.sourcePath).toBe("/Users/test/Pictures/photo.png");
    expect(loaded?.sourceFileName).toBe("photo.png");
  });

  it("ignores non-image paths in the drop payload", async () => {
    const onImageLoaded = vi.fn<(loaded: LoadedImage) => void>();
    renderHook(() => useImageLoader({ onImageLoaded }));

    await waitFor(() => expect(capturedDragDropHandler).not.toBeNull());
    if (!capturedDragDropHandler) throw new Error("drag-drop handler not captured");

    capturedDragDropHandler({
      payload: { type: "drop", paths: ["/tmp/document.pdf"], position: { x: 0, y: 0 } },
    });

    // Microtask flush before asserting nothing happened.
    await Promise.resolve();
    expect(mockReadFile).not.toHaveBeenCalled();
    expect(onImageLoaded).not.toHaveBeenCalled();
  });

  it("invokes onError when reading the dropped file fails", async () => {
    mockReadFile.mockRejectedValue(new Error("permission denied"));

    const onImageLoaded = vi.fn<(loaded: LoadedImage) => void>();
    const onError = vi.fn<(message: string) => void>();
    renderHook(() => useImageLoader({ onImageLoaded, onError }));

    await waitFor(() => expect(capturedDragDropHandler).not.toBeNull());
    if (!capturedDragDropHandler) throw new Error("drag-drop handler not captured");

    capturedDragDropHandler({
      payload: { type: "drop", paths: ["/tmp/locked.png"], position: { x: 0, y: 0 } },
    });

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith("画像の読み込みに失敗しました");
    expect(onImageLoaded).not.toHaveBeenCalled();
  });
});
