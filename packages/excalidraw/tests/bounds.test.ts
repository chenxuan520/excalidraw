import { getArrowheadSize } from "../element/bounds";

describe("getArrowheadSize", () => {
  it("keeps regular open arrowheads unchanged", () => {
    expect(getArrowheadSize("arrow")).toBe(25);
    expect(
      getArrowheadSize("arrow", {
        customData: {
          sequenceDiagram: {
            variant: "message",
          },
        },
      } as any),
    ).toBe(25);
  });

  it("shrinks only sequence return open arrowheads", () => {
    expect(
      getArrowheadSize("arrow", {
        customData: {
          sequenceDiagram: {
            variant: "return",
          },
        },
      } as any),
    ).toBe(15);
  });
});
