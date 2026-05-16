import { afterEach, beforeEach, vi } from "vitest";
import type { LoadedImage } from "@/types/image";
import {
  copyImageToClipboard,
  defaultExportFileName,
  generateExportFilename,
  saveBlobToFile,
} from "./exportImage";

const mockSave = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (...args: unknown[]) => mockSave(...args),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

function buildLoadedImage(overrides: Partial<LoadedImage> = {}): LoadedImage {
  return {
    element: new Image(),
    naturalWidth: 100,
    naturalHeight: 100,
    source: "paste",
    ...overrides,
  };
}

describe("generateExportFilename", () => {
  it("formats the timestamp as marianne-YYYYMMDD-HHmmss.png", () => {
    // 2026-05-15 10:30:45 (May = month index 4)
    const now = new Date(2026, 4, 15, 10, 30, 45);
    expect(generateExportFilename(now)).toBe("marianne-20260515-103045.png");
  });

  it("zero-pads single digit fields", () => {
    const now = new Date(2026, 0, 3, 7, 4, 9);
    expect(generateExportFilename(now)).toBe("marianne-20260103-070409.png");
  });
});

describe("defaultExportFileName", () => {
  it("appends _annotated to the basename when sourceFileName is set", () => {
    const image = buildLoadedImage({ sourceFileName: "foo.png" });
    expect(defaultExportFileName(image)).toBe("foo_annotated.png");
  });

  it("preserves dotted stems and always uses .png as the extension", () => {
    const image = buildLoadedImage({ sourceFileName: "screen.shot.jpg" });
    expect(defaultExportFileName(image)).toBe("screen.shot_annotated.png");
  });

  it("treats a leading-dot file as having no extension", () => {
    const image = buildLoadedImage({ sourceFileName: ".hidden" });
    // lastIndexOf returns 0, which is not > 0, so the whole name is the stem.
    expect(defaultExportFileName(image)).toBe(".hidden_annotated.png");
  });

  it("falls back to the timestamped form when sourceFileName is absent", () => {
    const image = buildLoadedImage({ sourceFileName: undefined });
    const now = new Date(2026, 4, 15, 10, 30, 45);
    expect(defaultExportFileName(image, now)).toBe("marianne-20260515-103045.png");
  });
});

describe("saveBlobToFile", () => {
  beforeEach(() => {
    mockSave.mockReset();
    mockWriteFile.mockReset();
  });

  it("writes the blob bytes to the chosen path and returns it", async () => {
    mockSave.mockResolvedValue("/Users/test/Pictures/foo_annotated.png");
    mockWriteFile.mockResolvedValue(undefined);

    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
    const saved = await saveBlobToFile(blob, "/Users/test/Pictures/foo_annotated.png");

    expect(saved).toBe("/Users/test/Pictures/foo_annotated.png");
    expect(mockSave).toHaveBeenCalledWith({
      defaultPath: "/Users/test/Pictures/foo_annotated.png",
      filters: [{ name: "PNG", extensions: ["png"] }],
    });
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [path, bytes] = mockWriteFile.mock.calls[0] as [string, Uint8Array];
    expect(path).toBe("/Users/test/Pictures/foo_annotated.png");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });

  it("returns null and skips writing when the user cancels the dialog", async () => {
    mockSave.mockResolvedValue(null);

    const blob = new Blob(["irrelevant"], { type: "image/png" });
    const result = await saveBlobToFile(blob, "/tmp/whatever.png");

    expect(result).toBeNull();
    expect(mockWriteFile).not.toHaveBeenCalled();
  });
});

describe("copyImageToClipboard", () => {
  const realClipboard = navigator.clipboard;
  const realClipboardItem = globalThis.ClipboardItem;
  let writeSpy: ReturnType<typeof vi.fn>;
  let clipboardItemCtor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeSpy = vi.fn().mockResolvedValue(undefined);
    clipboardItemCtor = vi.fn(function ClipboardItemMock(this: object, items: unknown) {
      Object.assign(this, { items });
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { write: writeSpy },
      configurable: true,
    });
    Object.defineProperty(globalThis, "ClipboardItem", {
      value: clipboardItemCtor as unknown,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: realClipboard,
      configurable: true,
    });
    Object.defineProperty(globalThis, "ClipboardItem", {
      value: realClipboardItem,
      configurable: true,
    });
  });

  it("constructs a ClipboardItem from a Promise<Blob> and calls clipboard.write synchronously", async () => {
    const blob = new Blob(["x"], { type: "image/png" });
    const blobPromise = Promise.resolve(blob);

    const writePromise = copyImageToClipboard(blobPromise);

    // The ClipboardItem constructor is called synchronously inside copyImageToClipboard,
    // before the blobPromise resolves — this is the user-activation-preserving path.
    expect(clipboardItemCtor).toHaveBeenCalledTimes(1);
    const ctorArg = clipboardItemCtor.mock.calls[0]?.[0];
    expect(ctorArg).toEqual({ "image/png": blobPromise });
    expect(writeSpy).toHaveBeenCalledTimes(1);

    await writePromise;
  });

  it("rejects when navigator.clipboard is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    await expect(copyImageToClipboard(Promise.resolve(new Blob()))).rejects.toThrow(
      /Clipboard API/,
    );
  });
});
