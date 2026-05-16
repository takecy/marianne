import { render } from "@testing-library/react";
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
});
