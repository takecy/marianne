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
    render(<StatusBar image={null} />);
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
      />,
    );
    expect(screen.getByText("/Users/foo/bar/screenshot.png")).toBeInTheDocument();
    expect(screen.getByText("png : 1920×1080")).toBeInTheDocument();
  });

  it("shows paste label on the left when sourcePath is missing (paste)", () => {
    render(
      <StatusBar image={makeImage({ source: "paste", sourceFileName: "image.png" })} />,
    );
    expect(screen.getByText(t("source.paste"))).toBeInTheDocument();
    expect(screen.getByText("png : 1920×1080")).toBeInTheDocument();
  });

  it("shows drop label when sourcePath is missing (browser fallback drop)", () => {
    render(
      <StatusBar image={makeImage({ source: "drop", sourceFileName: "photo.jpg" })} />,
    );
    expect(screen.getByText(t("source.drop"))).toBeInTheDocument();
    expect(screen.getByText("jpg : 1920×1080")).toBeInTheDocument();
  });

  it("shows file-open label when sourcePath is missing for 'file' source", () => {
    render(<StatusBar image={makeImage({ source: "file" })} />);
    expect(screen.getByText(t("source.file"))).toBeInTheDocument();
  });

  it("omits the extension segment when sourceFileName has no extension", () => {
    render(<StatusBar image={makeImage({ source: "paste", sourceFileName: "noext" })} />);
    expect(screen.getByText("1920×1080")).toBeInTheDocument();
  });

  it("sets the title attribute on the left text for hover-to-see-full-path", () => {
    const path = "/very/long/path/that/will/overflow/and/get/truncated/by/css/file.webp";
    render(
      <StatusBar
        image={makeImage({ source: "drop", sourcePath: path, sourceFileName: "file.webp" })}
      />,
    );
    expect(screen.getByText(path)).toHaveAttribute("title", path);
  });
});
