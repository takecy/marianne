import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toolbar } from "./Toolbar";

describe("Toolbar", () => {
  it("renders all 4 tool buttons and 7 color presets", () => {
    render(
      <Toolbar
        activeTool="arrow"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
      />,
    );

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
});
