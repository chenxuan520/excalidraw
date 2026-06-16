import { newLinearElement } from "../element/newElement";
import { shouldKeepOpenArrowheadSolid } from "../scene/Shape";

describe("shouldKeepOpenArrowheadSolid", () => {
  it("returns true only for sequence return open arrowheads", () => {
    const sequenceReturn = newLinearElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 180,
      height: 0,
      points: [
        [0, 0],
        [180, 0],
      ],
      strokeStyle: "dotted",
      endArrowhead: "arrow",
      customData: {
        sequenceDiagram: {
          role: "message",
          variant: "return",
        },
      },
    });

    expect(shouldKeepOpenArrowheadSolid(sequenceReturn, "arrow")).toBe(true);
  });

  it("returns false for non-return arrows", () => {
    const regularArrow = newLinearElement({
      type: "arrow",
      x: 0,
      y: 0,
      width: 180,
      height: 0,
      points: [
        [0, 0],
        [180, 0],
      ],
      strokeStyle: "dotted",
      endArrowhead: "arrow",
    });

    expect(shouldKeepOpenArrowheadSolid(regularArrow, "arrow")).toBe(false);
  });
});
