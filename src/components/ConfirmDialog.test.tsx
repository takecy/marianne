import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

// jsdom does not implement HTMLDialogElement.showModal / close, so we stub
// them as plain "set open attribute" toggles. Mirrors UpdateModal.test.tsx.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

function renderDialog(
  opts: {
    open?: boolean;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
  } = {},
) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <ConfirmDialog
      open={opts.open ?? true}
      title={opts.title ?? "確認"}
      message={opts.message ?? "実行してよろしいですか?"}
      confirmLabel={opts.confirmLabel ?? "OK"}
      cancelLabel={opts.cancelLabel}
      destructive={opts.destructive}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { ...view, onConfirm, onCancel };
}

describe("ConfirmDialog", () => {
  it("is not visible when open is false", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title, message, and button labels from props", () => {
    renderDialog({
      title: "未保存の注釈があります",
      message: "編集中の注釈は保存されません。本当に終了しますか?",
      confirmLabel: "終了する",
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("未保存の注釈があります")).toBeInTheDocument();
    expect(screen.getByText(/編集中の注釈は保存されません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "終了する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  });

  it("uses a custom cancelLabel when provided", () => {
    renderDialog({ cancelLabel: "戻る" });
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "キャンセル" })).not.toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ confirmLabel: "OK" });
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when the cancel button is clicked", async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();
    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("treats Escape as Cancel", () => {
    const { onCancel } = renderDialog();
    const dialog = screen.getByRole("dialog");
    // <dialog> dispatches the `cancel` event on Escape.
    dialog.dispatchEvent(new Event("cancel", { cancelable: true, bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("autofocuses Cancel when destructive (default)", () => {
    renderDialog({ confirmLabel: "削除", destructive: true });
    // autoFocus on a button is realized by jsdom as the focused element
    // after the dialog mounts.
    expect(screen.getByRole("button", { name: "キャンセル" })).toHaveFocus();
  });

  it("autofocuses Confirm when destructive is false", () => {
    renderDialog({ confirmLabel: "送信", destructive: false });
    expect(screen.getByRole("button", { name: "送信" })).toHaveFocus();
  });

  it("uses a unique aria-labelledby id per instance", () => {
    const noop = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        open
        title="A"
        message="msg-a"
        confirmLabel="OK"
        onConfirm={noop}
        onCancel={noop}
      />,
    );
    const idA = screen.getByRole("dialog").getAttribute("aria-labelledby");
    rerender(
      <>
        <ConfirmDialog
          open
          title="A"
          message="msg-a"
          confirmLabel="OK"
          onConfirm={noop}
          onCancel={noop}
        />
        <ConfirmDialog
          open
          title="B"
          message="msg-b"
          confirmLabel="OK"
          onConfirm={noop}
          onCancel={noop}
        />
      </>,
    );
    const ids = screen
      .getAllByRole("dialog")
      .map((d) => d.getAttribute("aria-labelledby"));
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(idA).toBeTruthy();
  });
});
