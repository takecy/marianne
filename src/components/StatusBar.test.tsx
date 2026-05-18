import { render, screen } from "@testing-library/react";
import { t } from "@/i18n/translate";
import type { LoadedImage } from "@/types/image";
import { StatusBar } from "./StatusBar";

function makeImage(overrides: Partial<LoadedImage> = {}): LoadedImage {
  return {
    element: new Image(),
    naturalWidth: 1920,
    naturalHeight: 1080,
    source: "paste",
    ...overrides,
  };
}

describe("StatusBar", () => {
  it("renders an empty bar when image is null (reserves layout space)", () => {
    render(<StatusBar image={null} zoom={1} />);
    // No `role` is set (avoiding implicit role=status live-region semantics);
    // query by accessible label instead.
    const bar = screen.getByLabelText(t("statusBar.imageInfo.label"));
    expect(bar).toBeInTheDocument();
    expect(bar.textContent).toBe("");
  });

  it("shows full path on the left when sourcePath is set (Tauri drop)", () => {
    render(
      <StatusBar
        image={makeImage({
          source: "drop",
          sourcePath: "/Users/foo/bar/screenshot.png",
          sourceFileName: "screenshot.png",
        })}
        zoom={1}
      />,
    );
    expect(screen.getByText("/Users/foo/bar/screenshot.png")).toBeInTheDocument();
    expect(screen.getByText("png : 1920×1080")).toBeInTheDocument();
  });

  it("shows paste label on the left when sourcePath is missing (paste)", () => {
    render(
      <StatusBar image={makeImage({ source: "paste", sourceFileName: "image.png" })} zoom={1} />,
    );
    expect(screen.getByText(t("source.paste"))).toBeInTheDocument();
    expect(screen.getByText("png : 1920×1080")).toBeInTheDocument();
  });

  it("shows drop label when sourcePath is missing (browser fallback drop)", () => {
    render(
      <StatusBar image={makeImage({ source: "drop", sourceFileName: "photo.jpg" })} zoom={1} />,
    );
    expect(screen.getByText(t("source.drop"))).toBeInTheDocument();
    expect(screen.getByText("jpg : 1920×1080")).toBeInTheDocument();
  });

  it("shows file-open label when sourcePath is missing for 'file' source", () => {
    render(<StatusBar image={makeImage({ source: "file" })} zoom={1} />);
    expect(screen.getByText(t("source.file"))).toBeInTheDocument();
  });

  it("omits the extension segment when sourceFileName has no extension", () => {
    render(
      <StatusBar image={makeImage({ source: "paste", sourceFileName: "noext" })} zoom={1} />,
    );
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
  });

  it("sets the title attribute on the left text for hover-to-see-full-path", () => {
    const path = "/very/long/path/that/will/overflow/and/get/truncated/by/css/file.webp";
    render(
      <StatusBar
        image={makeImage({ source: "drop", sourcePath: path, sourceFileName: "file.webp" })}
        zoom={1}
      />,
    );
    expect(screen.getByText(path)).toHaveAttribute("title", path);
  });

  it("displays the zoom percentage rounded to the nearest integer", () => {
    render(<StatusBar image={makeImage({ source: "paste" })} zoom={1} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("displays a non-100 zoom percentage", () => {
    render(<StatusBar image={makeImage({ source: "paste" })} zoom={2.5} />);
    expect(screen.getByText("250%")).toBeInTheDocument();
  });

  it("hides the zoom percentage when image is null", () => {
    const { container } = render(<StatusBar image={null} zoom={1.5} />);
    expect(container.textContent).toBe("");
  });
});
