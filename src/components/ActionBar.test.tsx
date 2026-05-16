import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionBar } from "./ActionBar";

describe("ActionBar", () => {
  it("renders 保存 and コピー icon buttons", () => {
    render(<ActionBar />);

    expect(screen.getByRole("button", { name: "保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "コピー" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(onExportToFile).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "コピー" }));
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

    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "コピー" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(onExportToFile).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "コピー" }));
    expect(onExportToClipboard).not.toHaveBeenCalled();
  });

  it("does not render tool / history / update buttons", () => {
    render(<ActionBar onExportToFile={vi.fn()} onExportToClipboard={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "戻る" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "進む" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更新を確認" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^選択/ })).not.toBeInTheDocument();
  });

  it("renders idle copy state by default: copy icon, no success class, empty status", () => {
    render(<ActionBar />);
    const copyButton = screen.getByRole("button", { name: "コピー" });

    // CSS Modules preserves the original class name as a substring of the
    // transformed name (e.g. `_exportButtonSuccess_abc123`).
    expect(copyButton.className).not.toMatch(/exportButtonSuccess/);
    expect(copyButton).toHaveAttribute(
      "title",
      "クリップボードへコピー (Cmd/Ctrl+Shift+C)",
    );
    // CopyIcon uses rect + path; CheckIcon uses polyline. Scope the query to the
    // copy button so SaveIcon's own polyline doesn't interfere.
    expect(copyButton.querySelector("polyline")).toBeNull();
    expect(copyButton.querySelector("rect")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("renders success copy state: check icon, success class, announcement text", () => {
    render(<ActionBar copyState="success" />);
    const copyButton = screen.getByRole("button", { name: "コピー" });

    expect(copyButton.className).toMatch(/exportButtonSuccess/);
    expect(copyButton).toHaveAttribute("title", "コピーしました");
    expect(copyButton.querySelector("polyline")).not.toBeNull();
    expect(copyButton.querySelector("rect")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("クリップボードへコピーしました");
  });
});
