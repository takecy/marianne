import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toolbar } from "./Toolbar";

describe("Toolbar", () => {
  it("renders all 5 tool buttons and 7 color presets", () => {
    render(
      <Toolbar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "選択" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "矢印" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "四角" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "テキスト" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "モザイク" })).toBeInTheDocument();

    const colorGroup = screen.getByRole("group", { name: "色" });
    expect(colorGroup.querySelectorAll("button")).toHaveLength(7);
  });

  it("marks the active tool as pressed", () => {
    render(
      <Toolbar
        activeTool="rect"
        onToolChange={vi.fn()}
        activeColor="blue"
        onColorChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "四角" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "矢印" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("invokes onToolChange when a tool button is clicked", async () => {
    const user = userEvent.setup();
    const onToolChange = vi.fn();
    render(
      <Toolbar
        activeTool="arrow"
        onToolChange={onToolChange}
        activeColor="red"
        onColorChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "テキスト" }));
    expect(onToolChange).toHaveBeenCalledWith("text");
  });

  it("disables all buttons and suppresses callbacks when disabled is true", async () => {
    const user = userEvent.setup();
    const onToolChange = vi.fn();
    const onColorChange = vi.fn();
    const onExportToFile = vi.fn();
    const onExportToClipboard = vi.fn();
    render(
      <Toolbar
        activeTool="arrow"
        onToolChange={onToolChange}
        activeColor="red"
        onColorChange={onColorChange}
        onExportToFile={onExportToFile}
        onExportToClipboard={onExportToClipboard}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: "矢印" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "red" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "コピー" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "テキスト" }));
    expect(onToolChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "blue" }));
    expect(onColorChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(onExportToFile).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "コピー" }));
    expect(onExportToClipboard).not.toHaveBeenCalled();
  });

  it("invokes onExportToFile and onExportToClipboard on the respective buttons", async () => {
    const user = userEvent.setup();
    const onExportToFile = vi.fn();
    const onExportToClipboard = vi.fn();
    render(
      <Toolbar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        onExportToFile={onExportToFile}
        onExportToClipboard={onExportToClipboard}
      />,
    );

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(onExportToFile).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "コピー" }));
    expect(onExportToClipboard).toHaveBeenCalledTimes(1);
  });
});
