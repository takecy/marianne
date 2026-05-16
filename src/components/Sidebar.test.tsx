import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("renders all 5 tool buttons and 8 color presets", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^選択/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^矢印/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^四角/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^テキスト/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^モザイク/ })).toBeInTheDocument();

    const colorGroup = screen.getByRole("group", { name: "色" });
    expect(colorGroup.querySelectorAll("button")).toHaveLength(8);
  });

  it("marks the active tool as pressed", () => {
    render(
      <Sidebar
        activeTool="rect"
        onToolChange={vi.fn()}
        activeColor="blue"
        onColorChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^四角/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^矢印/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("invokes onToolChange when a tool button is clicked", async () => {
    const user = userEvent.setup();
    const onToolChange = vi.fn();
    render(
      <Sidebar
        activeTool="arrow"
        onToolChange={onToolChange}
        activeColor="red"
        onColorChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^テキスト/ }));
    expect(onToolChange).toHaveBeenCalledWith("text");
  });

  it("disables tool and color buttons and suppresses callbacks when disabled is true", async () => {
    const user = userEvent.setup();
    const onToolChange = vi.fn();
    const onColorChange = vi.fn();
    render(
      <Sidebar
        activeTool="arrow"
        onToolChange={onToolChange}
        activeColor="red"
        onColorChange={onColorChange}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: /^矢印/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "red" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^テキスト/ }));
    expect(onToolChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "blue" }));
    expect(onColorChange).not.toHaveBeenCalled();
  });

  it("renders 戻る/進む buttons and invokes their callbacks", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo
        canRedo
      />,
    );

    await user.click(screen.getByRole("button", { name: "戻る" }));
    expect(onUndo).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "進む" }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("disables 戻る/進む buttons when canUndo / canRedo are false", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={false}
        canRedo={false}
      />,
    );

    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "進む" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "戻る" }));
    expect(onUndo).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "進む" }));
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("disables 戻る/進む when the whole sidebar is disabled even if canUndo / canRedo are true", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo
        canRedo
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: "戻る" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "進む" })).toBeDisabled();
  });

  it("does not render the 更新を確認 button when onCheckForUpdates is omitted", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "更新を確認" })).not.toBeInTheDocument();
  });

  it("renders 更新を確認 button when onCheckForUpdates is provided and invokes the callback", async () => {
    const user = userEvent.setup();
    const onCheckForUpdates = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onCheckForUpdates={onCheckForUpdates}
      />,
    );
    await user.click(screen.getByRole("button", { name: "更新を確認" }));
    expect(onCheckForUpdates).toHaveBeenCalledTimes(1);
  });

  it("update button stays enabled even when sidebar disabled is true", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        disabled
        onCheckForUpdates={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "更新を確認" })).not.toBeDisabled();
  });

  it("update button disables only when state is checking", () => {
    const { rerender } = render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onCheckForUpdates={vi.fn()}
        updateButtonState="checking"
      />,
    );
    expect(screen.getByRole("button", { name: "更新を確認" })).toBeDisabled();

    rerender(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onCheckForUpdates={vi.fn()}
        updateButtonState="available"
      />,
    );
    expect(screen.getByRole("button", { name: "更新を確認" })).not.toBeDisabled();
  });

  it("renders a short inline failure indicator with the full message in title", () => {
    const full = "Could not fetch a valid release JSON from the remote";
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onCheckForUpdates={vi.fn()}
        updateErrorMessage={full}
      />,
    );
    // Visible label is the compact "⚠ Failed" so the sidebar width stays
    // stable regardless of how long the underlying error is.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("⚠ Failed");
    expect(status).not.toHaveTextContent(full);
    // Full text is preserved on hover via the title attribute.
    expect(status).toHaveAttribute("title", full);
    // Button remains usable so the user can retry.
    expect(screen.getByRole("button", { name: "更新を確認" })).not.toBeDisabled();
  });

  it("does not render the inline error when updateErrorMessage is undefined", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onCheckForUpdates={vi.fn()}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
