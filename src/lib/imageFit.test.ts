import {
  clampToImage,
  fitContain,
  imageToScreen,
  screenToImage,
  strokeWidthToScreen,
} from "./imageFit";

describe("fitContain", () => {
  it("scales a landscape image to fit inside a square container", () => {
    const rect = fitContain({ width: 1000, height: 500 }, { width: 800, height: 800 });
    expect(rect.width).toBe(800);
    expect(rect.height).toBe(400);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(200);
  });

  it("scales a portrait image to fit inside a square container", () => {
    const rect = fitContain({ width: 500, height: 1000 }, { width: 800, height: 800 });
    expect(rect.width).toBe(400);
    expect(rect.height).toBe(800);
    expect(rect.x).toBe(200);
    expect(rect.y).toBe(0);
  });

  it("returns the image at original size when ratios match", () => {
    const rect = fitContain({ width: 400, height: 200 }, { width: 400, height: 200 });
    expect(rect).toEqual({ x: 0, y: 0, width: 400, height: 200 });
  });

  it("does not upscale a small image inside a larger container (1:1 with centering)", () => {
    const rect = fitContain({ width: 400, height: 300 }, { width: 800, height: 600 });
    expect(rect.width).toBe(400);
    expect(rect.height).toBe(300);
    expect(rect.x).toBe(200);
    expect(rect.y).toBe(150);
  });

  it("returns a zero rect when image or container has zero/negative size", () => {
    expect(fitContain({ width: 0, height: 100 }, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(fitContain({ width: 100, height: 100 }, { width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
    expect(fitContain({ width: -1, height: 100 }, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});

describe("screenToImage / imageToScreen", () => {
  const imageSize = { width: 1000, height: 500 };
  const fit = fitContain(imageSize, { width: 800, height: 800 }); // x=0, y=200, w=800, h=400

  it("imageToScreen places (0,0) at the fit origin", () => {
    const screen = imageToScreen({ x: 0, y: 0 }, fit, imageSize);
    expect(screen).toEqual({ x: fit.x, y: fit.y });
  });

  it("imageToScreen places (naturalW, naturalH) at the fit bottom-right", () => {
    const screen = imageToScreen({ x: imageSize.width, y: imageSize.height }, fit, imageSize);
    expect(screen.x).toBeCloseTo(fit.x + fit.width, 4);
    expect(screen.y).toBeCloseTo(fit.y + fit.height, 4);
  });

  it("screenToImage and imageToScreen are inverse of each other", () => {
    const original = { x: 250, y: 175 };
    const screen = imageToScreen(original, fit, imageSize);
    const back = screenToImage(screen, fit, imageSize);
    expect(back.x).toBeCloseTo(original.x, 4);
    expect(back.y).toBeCloseTo(original.y, 4);
  });

  it("screenToImage returns origin when fit has zero size", () => {
    expect(screenToImage({ x: 50, y: 50 }, { x: 0, y: 0, width: 0, height: 0 }, imageSize))
      .toEqual({ x: 0, y: 0 });
  });
});

describe("clampToImage", () => {
  const imageSize = { width: 1000, height: 500 };

  it("returns the point unchanged when it is inside the image", () => {
    expect(clampToImage({ x: 100, y: 200 }, imageSize)).toEqual({ x: 100, y: 200 });
  });

  it("clamps a point outside the image to the nearest edge", () => {
    expect(clampToImage({ x: -50, y: 600 }, imageSize)).toEqual({ x: 0, y: 500 });
    expect(clampToImage({ x: 2000, y: -10 }, imageSize)).toEqual({ x: 1000, y: 0 });
  });
});

describe("strokeWidthToScreen", () => {
  it("leaves the width untouched when the image is shown at natural size", () => {
    // fitContain caps its ratio at 1, so a container larger than the image
    // still renders 1:1 and the stored natural width is already screen-correct.
    const imageSize = { width: 400, height: 300 };
    const fit = fitContain(imageSize, { width: 1200, height: 900 });
    expect(strokeWidthToScreen(18, fit, imageSize)).toBe(18);
  });

  it("shrinks the width by the same ratio the geometry is shrunk by", () => {
    // 3840x2160 letterboxed into 1280x720 -> ratio 1/3.
    const imageSize = { width: 3840, height: 2160 };
    const fit = fitContain(imageSize, { width: 1280, height: 720 });
    expect(fit.width / imageSize.width).toBeCloseTo(1 / 3);
    expect(strokeWidthToScreen(18, fit, imageSize)).toBeCloseTo(6);
  });

  it("uses the letterboxed ratio, not the container, for a non-matching aspect", () => {
    // A 1000x500 image in an 800x800 container fits on width: ratio 0.8.
    const imageSize = { width: 1000, height: 500 };
    const fit = fitContain(imageSize, { width: 800, height: 800 });
    expect(strokeWidthToScreen(10, fit, imageSize)).toBeCloseTo(8);
  });

  it("falls back to the natural width when the image has zero size", () => {
    // imageToScreenScale returns a 1:1 scale for a degenerate image so the
    // renderer never multiplies a stroke by NaN.
    expect(strokeWidthToScreen(18, { x: 0, y: 0, width: 0, height: 0 }, { width: 0, height: 0 }))
      .toBe(18);
  });
});
