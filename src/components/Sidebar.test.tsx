import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@/i18n/translate";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("renders all 5 tool buttons and 8 color presets", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: t("tool.select") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("tool.arrow") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("tool.rect") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("tool.text") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("tool.mosaic") })).toBeInTheDocument();

    const colorGroup = screen.getByRole("group", { name: t("sidebar.colorGroup.label") });
    expect(colorGroup.querySelectorAll("button")).toHaveLength(8);
  });

  it("marks the active tool as pressed", () => {
    render(
      <Sidebar
        activeTool="rect"
        onToolChange={vi.fn()}
        activeColor="blue"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: t("tool.rect") })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: t("tool.arrow") })).toHaveAttribute(
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
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: t("tool.text") }));
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
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: t("tool.arrow") })).toBeDisabled();
    expect(screen.getByRole("button", { name: "red" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: t("tool.text") }));
    expect(onToolChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "blue" }));
    expect(onColorChange).not.toHaveBeenCalled();
  });

  it("renders undo/redo buttons and invokes their callbacks", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo
        canRedo
      />,
    );

    await user.click(screen.getByRole("button", { name: t("action.undo.label") }));
    expect(onUndo).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: t("action.redo.label") }));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("disables undo/redo buttons when canUndo / canRedo are false", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={false}
        canRedo={false}
      />,
    );

    expect(screen.getByRole("button", { name: t("action.undo.label") })).toBeDisabled();
    expect(screen.getByRole("button", { name: t("action.redo.label") })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: t("action.undo.label") }));
    expect(onUndo).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: t("action.redo.label") }));
    expect(onRedo).not.toHaveBeenCalled();
  });

  it("disables undo/redo when the whole sidebar is disabled even if canUndo / canRedo are true", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo
        canRedo
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: t("action.undo.label") })).toBeDisabled();
    expect(screen.getByRole("button", { name: t("action.redo.label") })).toBeDisabled();
  });

  it("does not render the check-for-updates button when onCheckForUpdates is omitted", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: t("action.checkUpdates.label") }))
      .not.toBeInTheDocument();
  });

  it("renders the check-for-updates button when onCheckForUpdates is provided and invokes the callback", async () => {
    const user = userEvent.setup();
    const onCheckForUpdates = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        onCheckForUpdates={onCheckForUpdates}
      />,
    );
    await user.click(screen.getByRole("button", { name: t("action.checkUpdates.label") }));
    expect(onCheckForUpdates).toHaveBeenCalledTimes(1);
  });

  it("update button stays enabled even when sidebar disabled is true", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        disabled
        onCheckForUpdates={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: t("action.checkUpdates.label") })).not.toBeDisabled();
  });

  it("update button disables only when state is checking", () => {
    const { rerender } = render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        onCheckForUpdates={vi.fn()}
        updateButtonState="checking"
      />,
    );
    expect(screen.getByRole("button", { name: t("action.checkUpdates.label") })).toBeDisabled();

    rerender(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        onCheckForUpdates={vi.fn()}
        updateButtonState="available"
      />,
    );
    expect(screen.getByRole("button", { name: t("action.checkUpdates.label") })).not.toBeDisabled();
  });

  it("renders a short inline failure indicator with the full message in title", () => {
    const full = "Could not fetch a valid release JSON from the remote";
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
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
    expect(screen.getByRole("button", { name: t("action.checkUpdates.label") })).not.toBeDisabled();
  });

  // --- stroke width presets ---

  it("renders all 4 stroke width preset buttons", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
      />,
    );
    const strokeGroup = screen.getByRole("group", { name: t("sidebar.strokeWidthGroup.label") });
    expect(strokeGroup.querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: t("strokeWidth.thin") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("strokeWidth.medium") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("strokeWidth.thick") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("strokeWidth.extraThick") })).toBeInTheDocument();
  });

  it("marks the active stroke width preset as pressed", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thin"
        onStrokeWidthChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: t("strokeWidth.thin") })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: t("strokeWidth.thick") })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("invokes onStrokeWidthChange with the preset name when a stroke width button is clicked", async () => {
    const user = userEvent.setup();
    const onStrokeWidthChange = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={onStrokeWidthChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: t("strokeWidth.extraThick") }));
    expect(onStrokeWidthChange).toHaveBeenCalledWith("extraThick");
  });

  it("disables stroke width buttons and suppresses callbacks when disabled is true", async () => {
    const user = userEvent.setup();
    const onStrokeWidthChange = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={onStrokeWidthChange}
        disabled
      />,
    );
    expect(screen.getByRole("button", { name: t("strokeWidth.thin") })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: t("strokeWidth.thin") }));
    expect(onStrokeWidthChange).not.toHaveBeenCalled();
  });

  it("does not render the inline error when updateErrorMessage is undefined", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        onCheckForUpdates={vi.fn()}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
