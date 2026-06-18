import { convertToExcalidrawElements } from "../../packages/excalidraw";
import { FONT_FAMILY } from "../../packages/excalidraw/constants";
import {
  getMindMapDragAnchor,
  getMindMapInsertAnchor,
  getMindMapPasteAnchor,
} from "./MindMapSidebar";
import {
  createMindMapStencil,
  getMindMapElementMeta,
  mindMapStencilSections,
  type MindMapStencilDefaults,
} from "./mindMapStencils";

const defaults: MindMapStencilDefaults = {
  mainTopic: "输入文本",
  topic: "输入文本",
  subtopic: "输入文本",
  event: "输入文本",
};

describe("mind map stencils", () => {
  it("defines the expected sidebar sections", () => {
    expect(mindMapStencilSections).toEqual([
      { key: "maps", items: ["mindmap-right", "mindmap-left"] },
      {
        key: "trees",
        items: ["tree-right", "tree-left", "tree-balanced"],
      },
      {
        key: "timelines",
        items: ["timeline-horizontal", "timeline-vertical"],
      },
    ]);
  });

  it("anchors right-facing mind maps on the root node for insertion", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    );

    expect(getMindMapInsertAnchor(elements)).toEqual({ x: 64, y: 110 });
  });

  it("uses root-center relative drag anchor for non-zero minX templates", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("tree-balanced", "light", defaults),
      { regenerateIds: false },
    );

    expect(getMindMapDragAnchor(elements)).toEqual({ x: 144, y: 22 });
  });

  it("anchors left-facing pasted mind maps on the root center", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-left", "light", defaults),
      { regenerateIds: false },
    );

    expect(getMindMapPasteAnchor(elements)).toEqual({ x: 396, y: 110 });
  });

  it("creates timeline templates with one root and a connector", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-vertical", "light", defaults),
      { regenerateIds: false },
    );

    expect(
      elements.filter((element) => getMindMapElementMeta(element)?.role === "root")
        .length,
    ).toBe(1);
    expect(
      elements.filter(
        (element) => getMindMapElementMeta(element)?.role === "connector",
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("creates connectors as straight lines without rounded corners", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    );

    expect(
      elements
        .filter((element) => getMindMapElementMeta(element)?.role === "connector")
        .every((element) => element.roundness === null),
    ).toBe(true);
  });

  it("does not create degenerate timeline connectors", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-vertical", "light", defaults),
      { regenerateIds: false },
    );

    expect(
      elements
        .filter((element) => getMindMapElementMeta(element)?.role === "connector")
        .every(
          (element) =>
            "points" in element &&
            Array.isArray(element.points) &&
            element.points.length >= 2,
        ),
    ).toBe(true);
  });

  it("uses Comic Shanns for generated node text", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    );

    expect(
      elements
        .filter((element) => element.type === "text")
        .every(
          (element) =>
            "fontFamily" in element &&
            element.fontFamily === FONT_FAMILY["Comic Shanns"],
        ),
    ).toBe(true);
  });
});
