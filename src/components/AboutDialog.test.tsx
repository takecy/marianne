import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@/i18n/translate";
import { AboutDialog } from "./AboutDialog";

// jsdom does not implement HTMLDialogElement.showModal / close — stub them
// to plain "open attribute" toggles. Mirrors ConfirmDialog.test.tsx.
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

function renderDialog(opts: { open?: boolean; version?: string } = {}) {
  const onClose = vi.fn();
  const view = render(
    <AboutDialog
      open={opts.open ?? true}
      version={opts.version ?? "0.1.0"}
      onClose={onClose}
    />,
  );
  return { ...view, onClose };
}

describe("AboutDialog", () => {
  it("is not visible when open is false", () => {
    renderDialog({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title with version", () => {
    renderDialog({ version: "1.2.3" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(t("about.title"))).toBeInTheDocument();
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
  });

  it("omits the version label when version is empty", () => {
    renderDialog({ version: "" });
    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument();
  });

  it("renders tribute, name origin, and disclaimer copy", () => {
    renderDialog();
    expect(screen.getByText(t("about.tribute"))).toBeInTheDocument();
    expect(screen.getByText(t("about.nameOrigin"))).toBeInTheDocument();
    expect(screen.getByText(t("about.disclaimer"))).toBeInTheDocument();
  });

  it("renders license and tribute links pointing to the right URLs", () => {
    renderDialog();
    const licenseLink = screen.getByRole("link", {
      name: "PolyForm Noncommercial 1.0.0",
    });
    expect(licenseLink).toHaveAttribute(
      "href",
      "https://github.com/takecy/marianne/blob/main/LICENSE",
    );
    const tributeLink = screen.getByRole("link", { name: t("about.tributeLink") });
    expect(tributeLink).toHaveAttribute(
      "href",
      "https://takecy.github.io/marianne/tribute/",
    );
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: t("about.close") }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("treats Escape as close", () => {
    const { onClose } = renderDialog();
    const dialog = screen.getByRole("dialog");
    dialog.dispatchEvent(new Event("cancel", { cancelable: true, bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
