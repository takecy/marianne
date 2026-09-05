import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@/i18n/translate";
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
      title={opts.title ?? "Confirm"}
      message={opts.message ?? "Are you sure you want to proceed?"}
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
      title: t("dialog.quit.title"),
      message: t("dialog.quit.message"),
      confirmLabel: t("dialog.quit.confirm"),
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(t("dialog.quit.title"))).toBeInTheDocument();
    expect(screen.getByText(t("dialog.quit.message"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("dialog.quit.confirm") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("dialog.cancel") })).toBeInTheDocument();
  });

  it("uses a custom cancelLabel when provided", () => {
    renderDialog({ cancelLabel: "Back" });
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: t("dialog.cancel") })).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: t("dialog.cancel") }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("treats Escape as Cancel", () => {
    const { onCancel } = renderDialog();
    const dialog = screen.getByRole("dialog");
    // <dialog> dispatches the `cancel` event on Escape.
    dialog.dispatchEvent(new Event("cancel", { cancelable: true, bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("confirms on y and cancels on n", () => {
    const { onConfirm, onCancel } = renderDialog({ confirmLabel: "Delete" });
    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "y", bubbles: true }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();

    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("accepts uppercase Y and N", () => {
    const { onConfirm, onCancel } = renderDialog();
    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Y", bubbles: true }));
    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "N", bubbles: true }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("leaves modifier combos to the OS and app menu", () => {
    const { onConfirm } = renderDialog();
    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "y", metaKey: true, bubbles: true }),
    );
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true }),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ignores keys typed during an IME composition", () => {
    const { onConfirm } = renderDialog();
    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(
      new KeyboardEvent("keydown", { key: "y", isComposing: true, bubbles: true }),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("moves focus between the buttons with arrow keys", () => {
    renderDialog({ confirmLabel: "Delete", destructive: true });
    const dialog = screen.getByRole("dialog");
    const cancel = screen.getByRole("button", { name: t("dialog.cancel") });
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(cancel).toHaveFocus();

    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(confirm).toHaveFocus();

    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(cancel).toHaveFocus();

    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(confirm).toHaveFocus();

    dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(cancel).toHaveFocus();
  });

  it("does not react to y while closed", () => {
    // App.tsx keeps three instances mounted at all times, so a closed one must
    // stay inert — this is why the listener lives on <dialog>, not window.
    const { onConfirm } = renderDialog({ open: false });
    const dialog = document.querySelector("dialog");
    dialog?.dispatchEvent(new KeyboardEvent("keydown", { key: "y", bubbles: true }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("keeps the shortcut badge out of the accessible name", () => {
    renderDialog({ confirmLabel: "Delete" });
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveAttribute("aria-keyshortcuts", "y");
    // The badge is rendered but aria-hidden, so it shows up in textContent
    // while staying out of the accessible name asserted above.
    expect(confirm.textContent).toContain("Y");
  });

  it("autofocuses Cancel when destructive (default)", () => {
    renderDialog({ confirmLabel: "Delete", destructive: true });
    // autoFocus on a button is realized by jsdom as the focused element
    // after the dialog mounts.
    expect(screen.getByRole("button", { name: t("dialog.cancel") })).toHaveFocus();
  });

  it("autofocuses Confirm when destructive is false", () => {
    renderDialog({ confirmLabel: "Submit", destructive: false });
    expect(screen.getByRole("button", { name: "Submit" })).toHaveFocus();
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
