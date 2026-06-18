import type { OrderedExcalidrawElement } from "../packages/excalidraw/element/types";
import {
  getGeneralElementAlignmentGuides,
  getGeneralElementAlignmentSnapOffset,
} from "./elementAlignment";

const createElement = ({
  id,
  type = "rectangle",
  x,
  y,
  width,
  height,
  angle = 0,
  customData,
  containerId = null,
}: {
  id: string;
  type?: OrderedExcalidrawElement["type"];
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  customData?: OrderedExcalidrawElement["customData"];
  containerId?: string | null;
}) =>
  ({
    id,
    type,
    x,
    y,
    width,
    height,
    angle,
    customData,
    containerId,
    isDeleted: false,
    locked: false,
    groupIds: [],
  }) as unknown as OrderedExcalidrawElement;

describe("getGeneralElementAlignmentGuides", () => {
  it("returns a top-alignment guide for nearby rectangles", () => {
    const reference = createElement({
      id: "reference",
      x: 0,
      y: 0,
      width: 140,
      height: 80,
    });
    const selected = createElement({
      id: "selected",
      x: 260,
      y: 4,
      width: 120,
      height: 72,
    });

    const guides = getGeneralElementAlignmentGuides({
      elements: [reference, selected],
      selectedElementIds: { selected: true },
      zoomValue: 1,
    });

    expect(guides).toHaveLength(1);
    expect(guides[0]).toMatchObject({ edge: "top", position: 0 });
  });

  it("returns left and right guides for vertically stacked rectangles", () => {
    const reference = createElement({
      id: "reference",
      x: 40,
      y: 0,
      width: 140,
      height: 80,
    });
    const selected = createElement({
      id: "selected",
      x: 44,
      y: 220,
      width: 140,
      height: 72,
    });

    const guides = getGeneralElementAlignmentGuides({
      elements: [reference, selected],
      selectedElementIds: { selected: true },
      zoomValue: 1,
    });

    expect(guides.map((guide) => guide.edge).sort()).toEqual(["left", "right"]);
  });

  it("does not override mixed selections with non-alignable elements", () => {
    const reference = createElement({
      id: "reference",
      x: 0,
      y: 0,
      width: 140,
      height: 80,
    });
    const selected = createElement({
      id: "selected",
      x: 0,
      y: 200,
      width: 140,
      height: 80,
    });
    const arrow = createElement({
      id: "arrow",
      type: "arrow",
      x: 0,
      y: 200,
      width: 0,
      height: 0,
    });

    const guides = getGeneralElementAlignmentGuides({
      elements: [reference, selected, arrow],
      selectedElementIds: { selected: true, arrow: true },
      zoomValue: 1,
    });

    expect(guides).toHaveLength(0);
  });

  it("ignores sequence elements so the sequence overlay owns them", () => {
    const reference = createElement({
      id: "reference",
      x: 0,
      y: 0,
      width: 140,
      height: 80,
    });
    const selected = createElement({
      id: "selected",
      x: 260,
      y: 4,
      width: 140,
      height: 80,
      customData: {
        sequenceDiagram: {
          role: "participant",
          laneId: "lane-1",
        },
      },
    });

    const guides = getGeneralElementAlignmentGuides({
      elements: [reference, selected],
      selectedElementIds: { selected: true },
      zoomValue: 1,
    });

    expect(guides).toHaveLength(0);
  });

  it("ignores frames so their children keep native dragging behavior", () => {
    const reference = createElement({
      id: "reference",
      x: 0,
      y: 0,
      width: 140,
      height: 80,
    });
    const selectedFrame = createElement({
      id: "frame",
      type: "frame",
      x: 4,
      y: 220,
      width: 140,
      height: 72,
    });

    const guides = getGeneralElementAlignmentGuides({
      elements: [reference, selectedFrame],
      selectedElementIds: { frame: true },
      zoomValue: 1,
    });
    const snapOffset = getGeneralElementAlignmentSnapOffset({
      elements: [reference, selectedFrame],
      selectedElementIds: { frame: true },
      zoomValue: 1,
    });

    expect(guides).toHaveLength(0);
    expect(snapOffset).toBeNull();
  });

  it("returns a left-edge snap offset for nearby rectangles", () => {
    const reference = createElement({
      id: "reference",
      x: 40,
      y: 0,
      width: 140,
      height: 80,
    });
    const selected = createElement({
      id: "selected",
      x: 44,
      y: 220,
      width: 120,
      height: 72,
    });

    const snapOffset = getGeneralElementAlignmentSnapOffset({
      elements: [reference, selected],
      selectedElementIds: { selected: true },
      zoomValue: 1,
    });

    expect(snapOffset).toMatchObject({ offsetX: -4, offsetY: 0 });
    expect([...snapOffset!.movableElementIds]).toEqual(["selected"]);
  });

  it("does not align rectangles that are too far apart vertically", () => {
    const reference = createElement({
      id: "reference",
      x: 40,
      y: 0,
      width: 140,
      height: 80,
    });
    const selected = createElement({
      id: "selected",
      x: 44,
      y: 520,
      width: 140,
      height: 72,
    });

    const guides = getGeneralElementAlignmentGuides({
      elements: [reference, selected],
      selectedElementIds: { selected: true },
      zoomValue: 1,
    });
    const snapOffset = getGeneralElementAlignmentSnapOffset({
      elements: [reference, selected],
      selectedElementIds: { selected: true },
      zoomValue: 1,
    });

    expect(guides).toHaveLength(0);
    expect(snapOffset).toBeNull();
  });

  it("allows a selected rectangle and its bound text to snap together", () => {
    const reference = createElement({
      id: "reference",
      x: 0,
      y: 0,
      width: 140,
      height: 80,
    });
    const selected = createElement({
      id: "selected",
      x: 4,
      y: 220,
      width: 140,
      height: 72,
    });
    const boundText = createElement({
      id: "label",
      type: "text",
      x: 36,
      y: 242,
      width: 72,
      height: 24,
      containerId: "selected",
    });

    const guides = getGeneralElementAlignmentGuides({
      elements: [reference, selected, boundText],
      selectedElementIds: { selected: true, label: true },
      zoomValue: 1,
    });
    const snapOffset = getGeneralElementAlignmentSnapOffset({
      elements: [reference, selected, boundText],
      selectedElementIds: { selected: true, label: true },
      zoomValue: 1,
    });

    expect(guides.map((guide) => guide.edge).sort()).toEqual(["left", "right"]);
    expect(snapOffset).toMatchObject({ offsetX: -4, offsetY: 0 });
    expect([...snapOffset!.movableElementIds].sort()).toEqual(["label", "selected"]);
  });
});
