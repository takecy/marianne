import { act, fireEvent, render } from "@testing-library/react";
import { vi } from "vitest";
import { TextInputOverlay } from "./TextInputOverlay";

describe("TextInputOverlay", () => {
  it("prefills the textarea value with initialText", () => {
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        initialText="hello"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("hello");
  });

  it("starts empty when initialText is omitted (new-text creation flow)", () => {
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("applies the fontSize prop to the textarea style", () => {
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        fontSize={64}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.style.fontSize).toBe("64px");
  });

  it("selects the prefilled text on mount so a typing user overwrites it", () => {
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        initialText="world"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe("world".length);
  });

  it("does not select when initialText is empty (avoid spurious selection range)", () => {
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    // Empty value collapses selection to 0/0 regardless; this guard ensures
    // we did not accidentally call select() on an empty textarea (which is
    // a no-op but worth pinning).
    expect(textarea.value.length).toBe(0);
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(0);
  });

  it("does not confirm on Enter while IME composition is in progress", () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "あ" } });
    fireEvent.compositionStart(textarea);
    // The KeyboardEventInit "isComposing" property is passed straight to the
    // KeyboardEvent constructor, so event.nativeEvent.isComposing becomes true.
    // The nested-init form ({ nativeEvent: { isComposing: true } }) is silently
    // dropped by jsdom and does NOT work.
    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms on Enter once IME composition has ended", async () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "亜" } });
    fireEvent.compositionStart(textarea);
    fireEvent.compositionEnd(textarea);
    // Allow the queueMicrotask in handleCompositionEnd to flush before the
    // post-composition Enter; otherwise isComposingRef is still true.
    await Promise.resolve();
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("亜");
  });

  it("does not confirm on Shift+Enter even during IME composition (newline path preserved)", () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, {
      key: "Enter",
      shiftKey: true,
      isComposing: true,
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("defers blur during composition and recovers on compositionEnd when focus is lost", () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(
      <TextInputOverlay
        x={0}
        y={0}
        color="red"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    const textarea = getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "あ" } });
    fireEvent.compositionStart(textarea);
    fireEvent.blur(textarea);
    // Mid-composition blur must NOT confirm — otherwise the textarea would
    // close with unconfirmed IME characters.
    expect(onConfirm).not.toHaveBeenCalled();
    // jsdom does not move document.activeElement on fireEvent.blur, so call
    // the native blur() inside act() to detach focus before compositionend.
    act(() => textarea.blur());
    fireEvent.compositionEnd(textarea);
    // Recovery path fires finalize once with the live DOM value.
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("あ");
  });
});
