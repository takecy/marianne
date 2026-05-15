import { clampToImage, fitContain, imageToScreen, screenToImage } from "./imageFit";

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
