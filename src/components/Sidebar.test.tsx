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

  // --- update notice slot ---

  const availableTitle = t("update.notice.available.title", { version: "0.3.6" });

  it("renders no update slot at all when there is no notice", () => {
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
    // The slot's presence IS the message, so nothing may be rendered while
    // the app is up to date.
    expect(screen.queryByRole("group", { name: t("sidebar.updateGroup.label") }))
      .not.toBeInTheDocument();
  });

  it("renders the bell with the version and invokes the callback on click", async () => {
    const user = userEvent.setup();
    const onUpdateNoticeClick = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        updateNotice={{ kind: "available", version: "0.3.6" }}
        onUpdateNoticeClick={onUpdateNoticeClick}
      />,
    );
    const group = screen.getByRole("group", { name: t("sidebar.updateGroup.label") });
    expect(group).toHaveTextContent("v0.3.6");
    await user.click(screen.getByRole("button", { name: availableTitle }));
    expect(onUpdateNoticeClick).toHaveBeenCalledTimes(1);
  });

  it("keeps the update notice usable even when sidebar disabled is true", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        disabled
        updateNotice={{ kind: "available", version: "0.3.6" }}
        onUpdateNoticeClick={vi.fn()}
      />,
    );
    // `disabled` covers image-dependent tools; an update is actionable with
    // or without an image loaded.
    expect(screen.getByRole("button", { name: availableTitle })).not.toBeDisabled();
  });

  it("shows the download percentage and blocks further clicks while downloading", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        updateNotice={{ kind: "downloading", percent: 45 }}
        onUpdateNoticeClick={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: t("update.notice.downloading.title") });
    expect(button).toBeDisabled();
    expect(screen.getByRole("group", { name: t("sidebar.updateGroup.label") }))
      .toHaveTextContent("45%");
  });

  it("falls back to an indeterminate label when the download size is unknown", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        updateNotice={{ kind: "downloading", percent: null }}
        onUpdateNoticeClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: t("sidebar.updateGroup.label") }))
      .toHaveTextContent(t("update.notice.downloading.labelUnknown"));
  });

  it("keeps the restart notice clickable when the relaunch was held back", async () => {
    const user = userEvent.setup();
    const onUpdateNoticeClick = vi.fn();
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        updateNotice={{ kind: "relaunch" }}
        onUpdateNoticeClick={onUpdateNoticeClick}
      />,
    );
    // Unlike `installing`, this one waits on the user — it must stay usable
    // or the update can never be finished.
    const button = screen.getByRole("button", { name: t("update.notice.relaunch.title") });
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(onUpdateNoticeClick).toHaveBeenCalledTimes(1);
  });

  it("blocks clicks while the update is being installed", () => {
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        updateNotice={{ kind: "installing" }}
        onUpdateNoticeClick={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: t("update.notice.installing.title") }))
      .toBeDisabled();
  });

  it("renders a short failure indicator with the full message in title", () => {
    const full = "Could not fetch a valid release JSON from the remote";
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        updateNotice={{ kind: "failed", message: full }}
        onUpdateNoticeClick={vi.fn()}
      />,
    );
    // Visible label stays compact so the 64px column keeps a stable width
    // regardless of how long the underlying error is.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(t("update.notice.failed.label"));
    expect(status).not.toHaveTextContent(full);
    // Full text is preserved on hover via the title attribute.
    expect(status).toHaveAttribute("title", full);
    // Button remains usable so the user can retry the install.
    expect(screen.getByRole("button", { name: t("update.notice.failed.title") }))
      .not.toBeDisabled();
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

  it("does not expose a live region for the non-failure notice kinds", () => {
    // Only the failure label is announced; a percentage ticking up would be
    // read out on every change.
    render(
      <Sidebar
        activeTool="select"
        onToolChange={vi.fn()}
        activeColor="red"
        onColorChange={vi.fn()}
        activeStrokeWidth="thick"
        onStrokeWidthChange={vi.fn()}
        updateNotice={{ kind: "downloading", percent: 45 }}
        onUpdateNoticeClick={vi.fn()}
      />,
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
