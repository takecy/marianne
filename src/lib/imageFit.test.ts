import { fitContain } from "./imageFit";

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
