import { convertToExcalidrawElements } from "../../packages/excalidraw";
import { syncInvalidIndices } from "../../packages/excalidraw/fractionalIndex";
import { newElementWith } from "../../packages/excalidraw/element/mutateElement";
import type {
  ExcalidrawTextElement,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import {
  createMindMapStencil,
  getMindMapElementMeta,
  isMindMapConnectorElement,
  isMindMapNodeElement,
  isMindMapRootElement,
  type MindMapStencilDefaults,
} from "./mindMapStencils";
import {
  buildMindMapTrees,
  createMindMapChildElements,
  createMindMapSiblingElements,
  insertMindMapNode,
  synchronizeMindMapElements,
} from "./mindMapSystem";

const defaults: MindMapStencilDefaults = {
  mainTopic: "输入文本",
  topic: "输入文本",
  subtopic: "输入文本",
  event: "输入文本",
};

describe("mind map system", () => {
  it("does not resync an unchanged mind map on a no-op pass", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const firstSync = synchronizeMindMapElements(elements);
    const secondSync = synchronizeMindMapElements(firstSync.elements);

    expect(firstSync.changed).toBe(true);
    expect(secondSync.changed).toBe(false);
  });

  it("adds a child node and reflows a right-facing mind map", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const tree = buildMindMapTrees(elements).trees[0];
    const middleNode = [...tree.nodes.values()].find(
      (node) => node.parentId === tree.root.id && node.order === 1,
    )!;

    const inserted = createMindMapChildElements({
      tree,
      parentId: middleNode.id,
      defaults,
    });
    const childNode = inserted.find((element) => isMindMapNodeElement(element))!;
    const synced = synchronizeMindMapElements(
      syncInvalidIndices([...elements, ...inserted]),
      { [childNode.id]: true },
    );

    const syncedChild = synced.elements.find((element) => element.id === childNode.id)!;
    const syncedMiddle = synced.elements.find((element) => element.id === middleNode.id)!;

    expect(synced.elements.filter(isMindMapNodeElement)).toHaveLength(
      elements.filter(isMindMapNodeElement).length + 1,
    );
    expect(synced.elements.filter(isMindMapConnectorElement)).toHaveLength(
      elements.filter(isMindMapConnectorElement).length + 3,
    );
    expect(syncedChild.x).toBeGreaterThan(syncedMiddle.x + syncedMiddle.width);
  });

  it("adds a sibling after the selected node", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const tree = buildMindMapTrees(elements).trees[0];
    const middleNode = [...tree.nodes.values()].find(
      (node) => node.parentId === tree.root.id && node.order === 1,
    )!;

    const inserted = createMindMapSiblingElements({
      tree,
      nodeId: middleNode.id,
      defaults,
    });
    expect(inserted.find((element) => isMindMapNodeElement(element))).toBeTruthy();
    const synced = insertMindMapNode({
      elements,
      selectedElementIds: { [middleNode.id]: true },
      mode: "sibling",
      defaults,
    })!;
    const selectedIds = Object.keys(synced.selectedElementIds);
    expect(selectedIds).toHaveLength(1);
    const syncedSibling = synced.elements.find(
      (element) => element.id === selectedIds[0],
    )!;

    expect(syncedSibling.y).toBeGreaterThan(middleNode.element.y);
  });

  it("adds a center timeline node when creating a child from the horizontal timeline root", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const root = elements.find((element) => isMindMapRootElement(element))!;

    const synced = insertMindMapNode({
      elements,
      selectedElementIds: { [root.id]: true },
      mode: "child",
      defaults,
    })!;
    const selectedIds = Object.keys(synced.selectedElementIds);
    const insertedNode = synced.elements.find((element) => element.id === selectedIds[0])!;

    expect(synced.elements.filter(isMindMapNodeElement)).toHaveLength(
      elements.filter(isMindMapNodeElement).length + 1,
    );
    expect(synced.elements.filter(isMindMapConnectorElement).length).toBeGreaterThan(
      elements.filter(isMindMapConnectorElement).length,
    );
    expect(getMindMapElementMeta(insertedNode)?.lane).toBe("center");
  });

  it("inserts a vertical timeline sibling after the selected center node", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-vertical", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const selectedNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center" &&
        getMindMapElementMeta(element)?.order === 1,
    )!;

    const synced = insertMindMapNode({
      elements,
      selectedElementIds: { [selectedNode.id]: true },
      mode: "sibling",
      defaults,
    })!;

    expect(synced.elements.filter(isMindMapNodeElement)).toHaveLength(
      elements.filter(isMindMapNodeElement).length + 1,
    );
    const insertedId = Object.keys(synced.selectedElementIds)[0]!;
    const insertedNode = synced.elements.find(
      (element) => element.id === insertedId,
    )!;

    expect(getMindMapElementMeta(insertedNode)?.lane).toBe("left");
    expect(getMindMapElementMeta(insertedNode)?.parentId).toBe(selectedNode.id);
    expect(insertedNode.x).toBeLessThan(selectedNode.x);
    expect(Math.abs(insertedNode.y - selectedNode.y)).toBeLessThanOrEqual(4);
  });

  it("inserts a vertical timeline child after the selected center node", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-vertical", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const selectedNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center" &&
        getMindMapElementMeta(element)?.order === 1,
    )!;

    const synced = insertMindMapNode({
      elements,
      selectedElementIds: { [selectedNode.id]: true },
      mode: "child",
      defaults,
    })!;
    const insertedId = Object.keys(synced.selectedElementIds)[0]!;
    const centerNodes = synced.elements
      .filter(
        (element) =>
          isMindMapNodeElement(element) &&
          getMindMapElementMeta(element)?.lane === "center",
      )
      .sort(
        (left, right) =>
          (getMindMapElementMeta(left)?.order || 0) -
          (getMindMapElementMeta(right)?.order || 0),
      );
    const selectedIndex = centerNodes.findIndex(
      (element) => element.id === selectedNode.id,
    );
    const insertedIndex = centerNodes.findIndex(
      (element) => element.id === insertedId,
    );

    expect(insertedIndex).toBe(selectedIndex + 1);
    expect(insertedIndex).toBeLessThan(centerNodes.length - 1);
    expect(centerNodes[insertedIndex]!.y).toBeGreaterThan(
      centerNodes[selectedIndex]!.y,
    );
    expect(centerNodes[insertedIndex]!.y).toBeLessThan(
      centerNodes[insertedIndex + 1]!.y,
    );
  });

  it("repairs stale vertical timeline order before inserting from a center node", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-vertical", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const centerNodes = elements.filter(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center",
    );
    const selectedNode = centerNodes[1]!;
    const staleElements = elements.map((element) => {
      const meta = getMindMapElementMeta(element);
      if (!isMindMapNodeElement(element) || meta?.lane !== "center") {
        return element;
      }
      return newElementWith(element, {
        customData: {
          ...element.customData,
          mindMap: {
            ...meta,
            order: 0,
          },
        },
      }) as OrderedExcalidrawElement;
    });

    const synced = insertMindMapNode({
      elements: staleElements,
      selectedElementIds: { [selectedNode.id]: true },
      mode: "child",
      defaults,
    })!;
    const insertedId = Object.keys(synced.selectedElementIds)[0]!;
    const syncedCenterNodes = synced.elements
      .filter(
        (element) =>
          isMindMapNodeElement(element) &&
          getMindMapElementMeta(element)?.lane === "center",
      )
      .sort(
        (left, right) =>
          (getMindMapElementMeta(left)?.order || 0) -
          (getMindMapElementMeta(right)?.order || 0),
      );
    const selectedIndex = syncedCenterNodes.findIndex(
      (element) => element.id === selectedNode.id,
    );
    const insertedIndex = syncedCenterNodes.findIndex(
      (element) => element.id === insertedId,
    );

    expect(insertedIndex).toBe(selectedIndex + 1);
    expect(insertedIndex).toBeLessThan(syncedCenterNodes.length - 1);
  });

  it("extends the main axis when creating a child from a timeline center node", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const centerNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center",
    )!;

    const synced = insertMindMapNode({
      elements,
      selectedElementIds: { [centerNode.id]: true },
      mode: "child",
      defaults,
    })!;
    const selectedIds = Object.keys(synced.selectedElementIds);
    const insertedNode = synced.elements.find((element) => element.id === selectedIds[0])!;

    expect(getMindMapElementMeta(insertedNode)?.lane).toBe("center");
  });

  it("inserts a horizontal timeline child after the selected center node", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const selectedNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center" &&
        getMindMapElementMeta(element)?.order === 0,
    )!;

    const synced = insertMindMapNode({
      elements,
      selectedElementIds: { [selectedNode.id]: true },
      mode: "child",
      defaults,
    })!;
    const insertedId = Object.keys(synced.selectedElementIds)[0]!;
    const centerNodes = synced.elements
      .filter(
        (element) =>
          isMindMapNodeElement(element) &&
          getMindMapElementMeta(element)?.lane === "center",
      )
      .sort(
        (left, right) =>
          (getMindMapElementMeta(left)?.order || 0) -
          (getMindMapElementMeta(right)?.order || 0),
      );
    const selectedIndex = centerNodes.findIndex(
      (element) => element.id === selectedNode.id,
    );
    const insertedIndex = centerNodes.findIndex(
      (element) => element.id === insertedId,
    );

    expect(insertedIndex).toBe(selectedIndex + 1);
    expect(insertedIndex).toBeLessThan(centerNodes.length - 1);
    expect(centerNodes[insertedIndex]!.x).toBeGreaterThan(
      centerNodes[selectedIndex]!.x,
    );
    expect(centerNodes[insertedIndex]!.x).toBeLessThan(
      centerNodes[insertedIndex + 1]!.x,
    );
  });

  it("inserts a horizontal timeline sibling after the selected center node", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const selectedNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center" &&
        getMindMapElementMeta(element)?.order === 0,
    )!;

    const synced = insertMindMapNode({
      elements,
      selectedElementIds: { [selectedNode.id]: true },
      mode: "sibling",
      defaults,
    })!;
    const insertedId = Object.keys(synced.selectedElementIds)[0]!;
    const insertedNode = synced.elements.find(
      (element) => element.id === insertedId,
    )!;

    expect(getMindMapElementMeta(insertedNode)?.lane).toBe("top");
    expect(getMindMapElementMeta(insertedNode)?.parentId).toBe(selectedNode.id);
    expect(insertedNode.y).toBeLessThan(selectedNode.y);
    expect(insertedNode.x).toBeGreaterThan(selectedNode.x);
  });

  it("keeps a selected horizontal timeline center node on the center lane", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const centerNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center",
    ) as OrderedExcalidrawElement;

    const synced = synchronizeMindMapElements(
      elements.map((element) =>
        element.id === centerNode.id
          ? (newElementWith(element, {
              y: element.y - 80,
            }) as OrderedExcalidrawElement)
          : element,
      ),
      { [centerNode.id]: true },
    );
    const movedNode = synced.elements.find((element) => element.id === centerNode.id)!;

    expect(getMindMapElementMeta(movedNode)?.lane).toBe("center");
  });

  it("keeps a selected vertical timeline center node on the center lane", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-vertical", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center" &&
        getMindMapElementMeta(element)?.side === "right",
    ) as OrderedExcalidrawElement;

    const synced = synchronizeMindMapElements(
      elements.map((element) =>
        element.id === rightNode.id
          ? (newElementWith(element, {
              x: element.x - 500,
            }) as OrderedExcalidrawElement)
          : element,
      ),
      { [rightNode.id]: true },
    );
    const movedNode = synced.elements.find((element) => element.id === rightNode.id)!;

    expect(getMindMapElementMeta(movedNode)?.lane).toBe("center");
  });

  it("normalizes a horizontal timeline into a center chain with top/bottom branches", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const synced = synchronizeMindMapElements(elements);
    const nodes = synced.elements.filter(isMindMapNodeElement);
    const centerNodes = nodes.filter(
      (element) => getMindMapElementMeta(element)?.lane === "center",
    );
    const topNodes = nodes.filter(
      (element) => getMindMapElementMeta(element)?.lane === "top",
    );
    const bottomNodes = nodes.filter(
      (element) => getMindMapElementMeta(element)?.lane === "bottom",
    );

    expect(centerNodes).toHaveLength(2);
    expect(topNodes).toHaveLength(1);
    expect(bottomNodes).toHaveLength(1);
    expect(centerNodes[0]!.x).toBeLessThan(centerNodes[1]!.x);
    expect(Math.abs(centerNodes[0]!.y - centerNodes[1]!.y)).toBeLessThanOrEqual(1);
    expect(topNodes[0]!.y).toBeLessThan(centerNodes[0]!.y);
    expect(bottomNodes[0]!.y).toBeGreaterThan(centerNodes[1]!.y);

    const topConnector = synced.elements.find(
      (element) =>
        isMindMapConnectorElement(element) &&
        getMindMapElementMeta(element)?.targetId === topNodes[0]!.id,
    )!;

    expect("points" in topConnector && topConnector.points).toHaveLength(3);
    if ("points" in topConnector) {
      const [start, bend, end] = topConnector.points;
      expect(start[0]).toBe(bend[0]);
      expect(bend[1]).toBe(end[1]);
      expect(Math.abs(end[0] - bend[0])).toBeGreaterThan(24);
    }
  });

  it("normalizes a vertical timeline into a center chain on the main axis", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-vertical", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const synced = synchronizeMindMapElements(elements);
    const nodes = synced.elements.filter(isMindMapNodeElement);
    const centerNodes = nodes.filter(
      (element) => getMindMapElementMeta(element)?.lane === "center",
    );

    expect(centerNodes).toHaveLength(4);
    expect(centerNodes[0]!.y).toBeLessThan(centerNodes[1]!.y);
    expect(centerNodes[1]!.y).toBeLessThan(centerNodes[2]!.y);
    expect(Math.abs(centerNodes[0]!.x - centerNodes[1]!.x)).toBeLessThanOrEqual(1);

    const trunkConnector = synced.elements.find(
      (element) =>
        isMindMapConnectorElement(element) &&
        getMindMapElementMeta(element)?.part === "trunk",
    )!;

    expect("points" in trunkConnector && trunkConnector.points).toHaveLength(2);
    if ("points" in trunkConnector) {
      const [start, end] = trunkConnector.points;
      expect(start[0]).toBe(end[0]);
      expect(Math.abs(end[1] - start[1])).toBeGreaterThan(24);
    }
  });

  it("moves descendants together when the root moves", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const firstSync = synchronizeMindMapElements(elements);
    const root = firstSync.elements.find((element) => isMindMapRootElement(element))!;
    const child = firstSync.elements.find((element) => isMindMapNodeElement(element))!;

    const movedRootElements = firstSync.elements.map((element) =>
      element.id === root.id
        ? (newElementWith(element, {
            x: element.x + 80,
            y: element.y + 36,
          }) as OrderedExcalidrawElement)
        : element,
    );
    const secondSync = synchronizeMindMapElements(movedRootElements, {
      [root.id]: true,
    });
    const movedChild = secondSync.elements.find((element) => element.id === child.id)!;

    expect(movedChild.x - child.x).toBeCloseTo(80, 1);
    expect(movedChild.y - child.y).toBeCloseTo(36, 1);
  });

  it("reorders siblings when a selected node is dragged above another sibling", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const siblings = elements.filter(isMindMapNodeElement) as (
      ExcalidrawTextElement & OrderedExcalidrawElement
    )[];
    const topNode = siblings[0]!;
    const bottomNode = siblings[2]!;

    const synced = synchronizeMindMapElements(
      elements.map((element) =>
        element.id === bottomNode.id
          ? (newElementWith(element, {
              y: topNode.y - 30,
            }) as OrderedExcalidrawElement)
          : element,
      ),
      { [bottomNode.id]: true },
    );
    const movedBottom = synced.elements.find((element) => element.id === bottomNode.id)!;
    const movedTop = synced.elements.find((element) => element.id === topNode.id)!;

    expect(movedBottom.y).toBeLessThan(movedTop.y);
  });

  it("reflows descendant branches when a parent label becomes wider", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const topNode = elements.filter(isMindMapNodeElement)[0] as ExcalidrawTextElement &
      OrderedExcalidrawElement;
    const childNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.parentId === topNode.id,
    ) as ExcalidrawTextElement & OrderedExcalidrawElement;

    const widenedTopNode = newElementWith(topNode, {
      text: "输入一段更长的文本内容",
      originalText: "输入一段更长的文本内容",
      width: topNode.width + 120,
    }) as OrderedExcalidrawElement;
    const synced = synchronizeMindMapElements(
      elements.map((element) =>
        element.id === topNode.id ? widenedTopNode : element,
      ),
      { [topNode.id]: true },
    );
    const syncedChild = synced.elements.find((element) => element.id === childNode.id)!;

    expect(syncedChild.x).toBeGreaterThan(childNode.x);
  });

  it("preserves manually edited child text styles while relayouting", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const root = elements.find((element) => isMindMapRootElement(element))!;
    const child = elements.find((element) => isMindMapNodeElement(element))!;
    const editedChild = newElementWith(child as ExcalidrawTextElement, {
      fontSize: 28,
      strokeColor: "#111827",
      fontFamily: 3,
    }) as OrderedExcalidrawElement;

    const synced = synchronizeMindMapElements(
      elements.map((element) => {
        if (element.id === root.id) {
          return newElementWith(element, {
            x: element.x + 40,
          }) as OrderedExcalidrawElement;
        }
        return element.id === child.id ? editedChild : element;
      }),
      { [root.id]: true },
    );
    const syncedChild = synced.elements.find(
      (element) => element.id === child.id,
    ) as ExcalidrawTextElement;

    expect(syncedChild.fontSize).toBe(28);
    expect(syncedChild.strokeColor).toBe("#111827");
    expect(syncedChild.fontFamily).toBe(3);
  });

  it("deletes descendant nodes and connectors when a parent node is deleted", () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const topNode = elements.filter(isMindMapNodeElement)[0] as OrderedExcalidrawElement;
    const childNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.parentId === topNode.id,
    ) as OrderedExcalidrawElement;

    const synced = synchronizeMindMapElements(
      elements.map((element) =>
        element.id === topNode.id
          ? (newElementWith(element, {
              isDeleted: true,
            }) as OrderedExcalidrawElement)
          : element,
      ),
    );
    const deletedChild = synced.elements.find((element) => element.id === childNode.id)!;
    const descendantConnector = synced.elements.find(
      (element) =>
        isMindMapConnectorElement(element) &&
        getMindMapElementMeta(element)?.targetId === childNode.id,
    )!;

    expect(deletedChild.isDeleted).toBe(true);
    expect(descendantConnector.isDeleted).toBe(true);
  });
});
