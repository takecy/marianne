import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UpdateState } from "@/lib/useUpdater";
import { UpdateModal } from "./UpdateModal";

// jsdom does not implement HTMLDialogElement.showModal / close, so we stub
// them as plain "set open attribute" toggles. This is enough for the modal
// to be discoverable via getByRole("dialog") in tests.
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

function renderModal(
  state: UpdateState,
  opts: { hasUnsavedShapes?: boolean } = {},
) {
  const onInstall = vi.fn();
  const onDismiss = vi.fn();
  const view = render(
    <UpdateModal
      state={state}
      hasUnsavedShapes={opts.hasUnsavedShapes ?? false}
      onInstall={onInstall}
      onDismiss={onDismiss}
    />,
  );
  return { ...view, onInstall, onDismiss };
}

describe("UpdateModal", () => {
  it("does not open for idle state", () => {
    renderModal({ kind: "idle" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open for checking state", () => {
    renderModal({ kind: "checking" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open for upToDate state", () => {
    renderModal({ kind: "upToDate" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens with title and buttons for available state", () => {
    renderModal({ kind: "available", version: "0.1.1", notes: "Bug fixes" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/新しいバージョン 0\.1\.1 が利用可能です/)).toBeInTheDocument();
    expect(screen.getByText("Bug fixes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今すぐ更新" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "後で" })).toBeInTheDocument();
  });

  it("shows unsaved-shapes warning when hasUnsavedShapes is true", () => {
    renderModal(
      { kind: "available", version: "0.1.1" },
      { hasUnsavedShapes: true },
    );
    expect(screen.getByRole("alert")).toHaveTextContent("未保存の注釈があります");
  });

  it("does not show warning when there are no unsaved shapes", () => {
    renderModal(
      { kind: "available", version: "0.1.1" },
      { hasUnsavedShapes: false },
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("invokes onInstall when Install is clicked", async () => {
    const user = userEvent.setup();
    const { onInstall } = renderModal({ kind: "available", version: "0.1.1" });
    await user.click(screen.getByRole("button", { name: "今すぐ更新" }));
    expect(onInstall).toHaveBeenCalledTimes(1);
  });

  it("invokes onDismiss when Later is clicked", async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderModal({ kind: "available", version: "0.1.1" });
    await user.click(screen.getByRole("button", { name: "後で" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("shows progress UI for downloading state", () => {
    renderModal({ kind: "downloading", downloaded: 512, contentLength: 1024 });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/ダウンロード中/)).toBeInTheDocument();
    // Progress label shows the byte counts in human-readable form.
    expect(screen.getByText(/512 B/)).toBeInTheDocument();
    expect(screen.getByText(/1\.0 KB/)).toBeInTheDocument();
  });

  it("shows install message for readyToInstall state", () => {
    renderModal({ kind: "readyToInstall", version: "0.1.1" });
    expect(screen.getByText(/更新を適用しています/)).toBeInTheDocument();
    expect(screen.getByText(/0\.1\.1/)).toBeInTheDocument();
  });

  it("does NOT open for error state (failure surfaces in the toolbar instead)", () => {
    renderModal({ kind: "error", message: "network down" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Error message must not leak into the (closed) modal DOM as visible text.
    expect(screen.queryByText("network down")).not.toBeInTheDocument();
  });
});
