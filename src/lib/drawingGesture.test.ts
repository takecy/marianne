import { finalizeDraft, moveDraft, startDraft } from "./drawingGesture";

const fixedId = () => "id-1";

describe("drawingGesture - rect", () => {
  it("startDraft creates a zero-size rect at the origin point with selected color", () => {
    const draft = startDraft("rect", "red", { x: 10, y: 20 });
    expect(draft).toEqual({
      type: "rect",
      color: "red",
      x: 10,
      y: 20,
      width: 0,
      height: 0,
    });
  });

  it("moveDraft updates width and height from the original origin", () => {
    const draft = moveDraft(startDraft("rect", "red", { x: 10, y: 20 }), { x: 60, y: 70 });
    expect(draft).toMatchObject({ width: 50, height: 50 });
  });

  it("finalizeDraft normalises negative width/height into positive bounds", () => {
    const draft = moveDraft(startDraft("rect", "blue", { x: 100, y: 100 }), { x: 40, y: 60 });
    const shape = finalizeDraft(draft, fixedId);
    expect(shape).toEqual({
      id: "id-1",
      type: "rect",
      color: "blue",
      x: 40,
      y: 60,
      width: 60,
      height: 40,
    });
  });

  it("finalizeDraft returns null for a rect below MIN_RECT_DIM", () => {
    const draft = moveDraft(startDraft("rect", "red", { x: 10, y: 10 }), { x: 11, y: 11 });
    expect(finalizeDraft(draft, fixedId)).toBeNull();
  });
});

describe("drawingGesture - arrow", () => {
  it("startDraft places fromX/fromY/toX/toY at the origin point", () => {
    const draft = startDraft("arrow", "green", { x: 5, y: 5 });
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
    const draft = moveDraft(startDraft("arrow", "green", { x: 5, y: 5 }), { x: 50, y: 30 });
    expect(draft).toMatchObject({ fromX: 5, fromY: 5, toX: 50, toY: 30 });
  });

  it("finalizeDraft returns an ArrowShape with assigned id and preserved color", () => {
    const draft = moveDraft(startDraft("arrow", "pink", { x: 0, y: 0 }), { x: 100, y: 100 });
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
    const draft = moveDraft(startDraft("arrow", "red", { x: 0, y: 0 }), { x: 2, y: 1 });
    expect(finalizeDraft(draft, fixedId)).toBeNull();
  });
});
