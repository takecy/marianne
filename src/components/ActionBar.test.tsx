import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@/i18n/translate";
import { ActionBar } from "./ActionBar";

describe("ActionBar", () => {
  it("renders save and copy icon buttons", () => {
    render(<ActionBar />);

    expect(screen.getByRole("button", { name: t("action.save.label") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("action.copy.label") })).toBeInTheDocument();
  });

  it("invokes onExportToFile and onExportToClipboard on the respective buttons", async () => {
    const user = userEvent.setup();
    const onExportToFile = vi.fn();
    const onExportToClipboard = vi.fn();
    render(
      <ActionBar
        onExportToFile={onExportToFile}
        onExportToClipboard={onExportToClipboard}
      />,
    );

    await user.click(screen.getByRole("button", { name: t("action.save.label") }));
    expect(onExportToFile).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: t("action.copy.label") }));
    expect(onExportToClipboard).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons and suppresses callbacks when disabled is true", async () => {
    const user = userEvent.setup();
    const onExportToFile = vi.fn();
    const onExportToClipboard = vi.fn();
    render(
      <ActionBar
        disabled
        onExportToFile={onExportToFile}
        onExportToClipboard={onExportToClipboard}
      />,
    );

    expect(screen.getByRole("button", { name: t("action.save.label") })).toBeDisabled();
    expect(screen.getByRole("button", { name: t("action.copy.label") })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: t("action.save.label") }));
    expect(onExportToFile).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: t("action.copy.label") }));
    expect(onExportToClipboard).not.toHaveBeenCalled();
  });

  it("does not render tool / update buttons", () => {
    render(<ActionBar onExportToFile={vi.fn()} onExportToClipboard={vi.fn()} />);

    expect(screen.queryByRole("button", { name: t("action.checkUpdates.label") }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("tool.select") })).not.toBeInTheDocument();
  });

  it("renders undo/redo buttons and invokes their callbacks when canUndo / canRedo are true", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <ActionBar onUndo={onUndo} onRedo={onRedo} canUndo canRedo />,
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
      <ActionBar
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

  // The history controls are intentionally independent of the action bar's
  // `disabled` prop. `disabled` covers both "no image" and "text-editing in
  // progress"; the latter must still allow undo/redo (matching the previous
  // Sidebar behavior, where `disabled = image === null` only).
  it("keeps undo/redo enabled even when the action bar is disabled, as long as canUndo/canRedo are true", () => {
    render(
      <ActionBar
        disabled
        onUndo={vi.fn()}
        onRedo={vi.fn()}
        canUndo
        canRedo
      />,
    );

    expect(screen.getByRole("button", { name: t("action.undo.label") })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: t("action.redo.label") })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: t("action.save.label") })).toBeDisabled();
    expect(screen.getByRole("button", { name: t("action.copy.label") })).toBeDisabled();
  });

  it("renders idle copy state by default: copy icon, no success class, empty status", () => {
    render(<ActionBar />);
    const copyButton = screen.getByRole("button", { name: t("action.copy.label") });

    // CSS Modules preserves the original class name as a substring of the
    // transformed name (e.g. `_exportButtonSuccess_abc123`).
    expect(copyButton.className).not.toMatch(/exportButtonSuccess/);
    expect(copyButton).toHaveAttribute("title", t("action.copy.title"));
    // CopyIcon uses rect + path; CheckIcon uses polyline. Scope the query to the
    // copy button so SaveIcon's own polyline doesn't interfere.
    expect(copyButton.querySelector("polyline")).toBeNull();
    expect(copyButton.querySelector("rect")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("renders success copy state: check icon, success class, announcement text", () => {
    render(<ActionBar copyState="success" />);
    const copyButton = screen.getByRole("button", { name: t("action.copy.label") });

    expect(copyButton.className).toMatch(/exportButtonSuccess/);
    expect(copyButton).toHaveAttribute("title", t("action.copy.copied"));
    expect(copyButton.querySelector("polyline")).not.toBeNull();
    expect(copyButton.querySelector("rect")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(t("action.copy.announcement"));
  });
});
