import { finalizeDraft, moveDraft, startDraft } from "./drawingGesture";

const fixedId = () => "id-1";

describe("drawingGesture - rect", () => {
  it("startDraft creates a zero-size rect at the origin point with selected color", () => {
    const draft = startDraft("rect", "red", "thick", { x: 10, y: 20 });
    expect(draft).toEqual({
      type: "rect",
      color: "red",
      strokeWidth: "thick",
      x: 10,
      y: 20,
      width: 0,
      height: 0,
    });
  });

  it("moveDraft updates width and height from the original origin", () => {
    const draft = moveDraft(
      startDraft("rect", "red", "thick", { x: 10, y: 20 }),
      { x: 60, y: 70 },
    );
    expect(draft).toMatchObject({ width: 50, height: 50 });
  });

  it("finalizeDraft normalises negative width/height into positive bounds", () => {
    const draft = moveDraft(
      startDraft("rect", "blue", "thick", { x: 100, y: 100 }),
      { x: 40, y: 60 },
    );
    const shape = finalizeDraft(draft, fixedId);
    expect(shape).toEqual({
      id: "id-1",
      type: "rect",
      color: "blue",
      strokeWidth: "thick",
      x: 40,
      y: 60,
      width: 60,
      height: 40,
    });
  });

  it("finalizeDraft returns null for a rect below MIN_RECT_DIM", () => {
    const draft = moveDraft(
      startDraft("rect", "red", "thick", { x: 10, y: 10 }),
      { x: 11, y: 11 },
    );
    expect(finalizeDraft(draft, fixedId)).toBeNull();
  });

  it("startDraft propagates non-default strokeWidth presets onto the draft", () => {
    expect(
      startDraft("rect", "red", "thin", { x: 0, y: 0 }),
    ).toMatchObject({ strokeWidth: "thin" });
    expect(
      startDraft("rect", "red", "extraThick", { x: 0, y: 0 }),
    ).toMatchObject({ strokeWidth: "extraThick" });
  });

  it("finalizeDraft preserves the strokeWidth preset on the resulting RectShape", () => {
    const draft = moveDraft(
      startDraft("rect", "green", "extraThick", { x: 0, y: 0 }),
      { x: 50, y: 50 },
    );
    const shape = finalizeDraft(draft, fixedId);
    if (shape?.type !== "rect") {
      throw new Error("expected rect shape");
    }
    expect(shape.strokeWidth).toBe("extraThick");
  });
});

describe("drawingGesture - arrow", () => {
  it("startDraft places fromX/fromY/toX/toY at the origin point", () => {
    const draft = startDraft("arrow", "green", "thick", { x: 5, y: 5 });
    expect(draft).toEqual({
      type: "arrow",
      color: "green",
      fromX: 5,
      fromY: 5,
      toX: 5,
      toY: 5,
    });
  });

  it("moveDraft updates only toX/toY", () => {
    const draft = moveDraft(
      startDraft("arrow", "green", "thick", { x: 5, y: 5 }),
      { x: 50, y: 30 },
    );
    expect(draft).toMatchObject({ fromX: 5, fromY: 5, toX: 50, toY: 30 });
  });

  it("finalizeDraft returns an ArrowShape with assigned id and preserved color", () => {
    const draft = moveDraft(
      startDraft("arrow", "pink", "thick", { x: 0, y: 0 }),
      { x: 100, y: 100 },
    );
    expect(finalizeDraft(draft, fixedId)).toEqual({
      id: "id-1",
      type: "arrow",
      color: "pink",
      fromX: 0,
      fromY: 0,
      toX: 100,
      toY: 100,
    });
  });

  it("finalizeDraft returns null for an arrow shorter than MIN_ARROW_LENGTH", () => {
    const draft = moveDraft(
      startDraft("arrow", "red", "thick", { x: 0, y: 0 }),
      { x: 2, y: 1 },
    );
    expect(finalizeDraft(draft, fixedId)).toBeNull();
  });

  it("startDraft does not attach strokeWidth onto arrow drafts", () => {
    const draft = startDraft("arrow", "red", "extraThick", { x: 0, y: 0 });
    expect(draft).not.toHaveProperty("strokeWidth");
  });
});

describe("drawingGesture - mosaic", () => {
  it("startDraft creates a zero-size mosaic without a color field", () => {
    const draft = startDraft("mosaic", "red", "thick", { x: 30, y: 40 });
    expect(draft).toEqual({
      type: "mosaic",
      x: 30,
      y: 40,
      width: 0,
      height: 0,
    });
    expect(draft).not.toHaveProperty("color");
    expect(draft).not.toHaveProperty("strokeWidth");
  });

  it("moveDraft updates width and height for a mosaic draft", () => {
    const draft = moveDraft(
      startDraft("mosaic", "blue", "thick", { x: 0, y: 0 }),
      { x: 80, y: 50 },
    );
    expect(draft).toMatchObject({ type: "mosaic", width: 80, height: 50 });
  });

  it("finalizeDraft returns a MosaicShape with id and normalised bounds, no color", () => {
    const draft = moveDraft(
      startDraft("mosaic", "black", "thick", { x: 100, y: 200 }),
      { x: 50, y: 150 },
    );
    const shape = finalizeDraft(draft, fixedId);
    expect(shape).toEqual({
      id: "id-1",
      type: "mosaic",
      x: 50,
      y: 150,
      width: 50,
      height: 50,
    });
  });

  it("finalizeDraft returns null for a mosaic smaller than MIN_MOSAIC_DIM", () => {
    const draft = moveDraft(
      startDraft("mosaic", "red", "thick", { x: 0, y: 0 }),
      { x: 3, y: 3 },
    );
    expect(finalizeDraft(draft, fixedId)).toBeNull();
  });
});
