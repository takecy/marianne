import { renderHook, waitFor } from "@testing-library/react";
import type { LoadedImage } from "@/types/image";
import { useImageLoader } from "./useImageLoader";

const ERROR_MARKER = "blob:trigger-error";

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

describe("useImageLoader", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi.fn(() => "blob:mock");
    revokeObjectURL = vi.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURL,
      configurable: true,
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: revokeObjectURL,
      configurable: true,
    });
    vi.stubGlobal("Image", MockImage);
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
