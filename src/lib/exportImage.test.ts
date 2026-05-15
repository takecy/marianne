import { afterEach, beforeEach } from "vitest";
import { copyImageToClipboard, downloadBlob, generateExportFilename } from "./exportImage";

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

describe("downloadBlob", () => {
  let appendedAnchor: HTMLAnchorElement | null = null;
  let clickSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    appendedAnchor = null;
    clickSpy = vi.fn();
    createObjectURLSpy = vi.fn(() => "blob:mock");
    revokeObjectURLSpy = vi.fn();
    Object.defineProperty(globalThis.URL, "createObjectURL", {
      value: createObjectURLSpy,
      configurable: true,
    });
    Object.defineProperty(globalThis.URL, "revokeObjectURL", {
      value: revokeObjectURLSpy,
      configurable: true,
    });
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") {
        // Stub the click handler so jsdom does not actually attempt a navigation.
        (el as HTMLAnchorElement).click = clickSpy as unknown as HTMLAnchorElement["click"];
        appendedAnchor = el as HTMLAnchorElement;
      }
      return el;
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates an object URL, clicks an anchor, and revokes the URL on next tick", () => {
    const blob = new Blob(["test"], { type: "image/png" });
    downloadBlob(blob, "marianne-test.png");

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(appendedAnchor).not.toBeNull();
    expect(appendedAnchor?.download).toBe("marianne-test.png");
    expect(appendedAnchor?.href).toBe("blob:mock");
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // revokeObjectURL is scheduled for the next tick.
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock");
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
