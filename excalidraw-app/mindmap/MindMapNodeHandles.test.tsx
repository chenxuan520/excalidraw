import { beforeEach, describe, expect, it } from "vitest";
import {
  Excalidraw,
  StoreAction,
  convertToExcalidrawElements,
} from "../../packages/excalidraw";
import {
  fireEvent,
  mockBoundingClientRect,
  render,
  waitFor,
} from "../../packages/excalidraw/tests/test-utils";
import type { ExcalidrawImperativeAPI } from "../../packages/excalidraw/types";
import { resolvablePromise } from "../../packages/excalidraw/utils";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  createMindMapStencil,
  getMindMapElementMeta,
  getMindMapStencilDefaults,
  isMindMapConnectorElement,
  isMindMapNodeElement,
  MIND_MAP_FONT_FAMILY,
  type MindMapStencilDefaults,
} from "./mindMapStencils";
import { MindMapNodeHandles } from "./MindMapNodeHandles";

const defaults: MindMapStencilDefaults = {
  mainTopic: "输入文本",
  topic: "输入文本",
  subtopic: "输入文本",
  event: "输入文本",
};

describe("MindMapNodeHandles", () => {
  let excalidrawAPI: ExcalidrawImperativeAPI;
  const insertedDefaults = getMindMapStencilDefaults();

  beforeEach(async () => {
    mockBoundingClientRect({
      width: 1200,
      height: 900,
      top: 0,
      left: 0,
      x: 0,
      y: 0,
    });

    const apiPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    await render(
      <Excalidraw excalidrawAPI={(api) => apiPromise.resolve(api as any)}>
        <MindMapNodeHandles />
      </Excalidraw>,
    );
    excalidrawAPI = await apiPromise;
  });

  it("adds a child node from the selected mind map node handle", async () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const selectedNode = elements.find((element) => isMindMapNodeElement(element))!;

    excalidrawAPI.updateScene({
      elements,
      appState: {
        selectedElementIds: { [selectedNode.id]: true },
      },
      storeAction: StoreAction.UPDATE,
    });

    const initialNodeCount = elements.filter(isMindMapNodeElement).length;
    const initialConnectorCount = elements.filter(isMindMapConnectorElement).length;

    const button = await waitFor(() => {
      const node = document.querySelector(
        ".mind-map-node-handles__button",
      ) as HTMLButtonElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(window.h.elements.filter(isMindMapNodeElement)).toHaveLength(
        initialNodeCount + 1,
      );
      expect(window.h.elements.filter(isMindMapConnectorElement)).toHaveLength(
        initialConnectorCount + 3,
      );
      expect(
        window.h.elements.some(
          (element) =>
            isMindMapNodeElement(element) &&
            "text" in element &&
            element.text === insertedDefaults.topic,
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      const textarea = document.querySelector(
        ".excalidraw-textEditorContainer > textarea",
      ) as HTMLTextAreaElement | null;
      expect(textarea).toBeTruthy();
      expect(textarea?.value).toBe(insertedDefaults.topic);
      expect(textarea?.style.fontFamily).toContain("Comic Shanns");
    });
  });

  it("adds a sibling node from the sibling handle", async () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("mindmap-right", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const selectedNode = elements.find((element) => isMindMapNodeElement(element))!;

    excalidrawAPI.updateScene({
      elements,
      appState: {
        selectedElementIds: { [selectedNode.id]: true },
      },
      storeAction: StoreAction.UPDATE,
    });

    const siblingButton = await waitFor(() => {
      const node = document.querySelector(
        ".mind-map-node-handles__button--sibling",
      ) as HTMLButtonElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.click(siblingButton);

    await waitFor(() => {
      expect(window.h.elements.filter(isMindMapNodeElement)).toHaveLength(
        elements.filter(isMindMapNodeElement).length + 1,
      );
      expect(window.h.elements.filter(isMindMapConnectorElement)).toHaveLength(
        elements.filter(isMindMapConnectorElement).length + 2,
      );
    });
  });

  it("adds a child node from a horizontal timeline root", async () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const root = elements.find((element) => "customData" in element && !isMindMapNodeElement(element))!;

    excalidrawAPI.updateScene({
      elements,
      appState: {
        selectedElementIds: { [root.id]: true },
      },
      storeAction: StoreAction.UPDATE,
    });

    const button = await waitFor(() => {
      const node = document.querySelector(
        ".mind-map-node-handles__button",
      ) as HTMLButtonElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(window.h.elements.filter(isMindMapNodeElement)).toHaveLength(
        elements.filter(isMindMapNodeElement).length + 1,
      );
    });
  });

  it("adds a child node after a selected horizontal timeline center node", async () => {
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

    excalidrawAPI.updateScene({
      elements,
      appState: {
        selectedElementIds: { [selectedNode.id]: true },
      },
      storeAction: StoreAction.UPDATE,
    });

    const button = await waitFor(() => {
      const node = document.querySelector(
        ".mind-map-node-handles__button",
      ) as HTMLButtonElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.click(button);

    await waitFor(() => {
      const insertedId = Object.keys(window.h.state.selectedElementIds)[0]!;
      const centerNodes = window.h.elements
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
  });

  it("hides the branch handle for a horizontal timeline center node that already has a branch", async () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    // the first center node already carries a top branch in the stencil
    const selectedNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "center" &&
        getMindMapElementMeta(element)?.order === 0,
    )!;

    excalidrawAPI.updateScene({
      elements,
      appState: {
        selectedElementIds: { [selectedNode.id]: true },
      },
      storeAction: StoreAction.UPDATE,
    });

    // the child handle (extend the main axis) is still available
    await waitFor(() => {
      expect(
        document.querySelector(".mind-map-node-handles__button"),
      ).toBeTruthy();
    });

    // but the branch/sibling handle must not be shown, to avoid a duplicate
    expect(
      document.querySelector(".mind-map-node-handles__button--sibling"),
    ).toBeNull();
  });

  it("does not show add handles for selected horizontal timeline branch nodes", async () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-horizontal", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const selectedNode = elements.find(
      (element) =>
        isMindMapNodeElement(element) &&
        getMindMapElementMeta(element)?.lane === "top",
    )!;

    excalidrawAPI.updateScene({
      elements,
      appState: {
        selectedElementIds: { [selectedNode.id]: true },
      },
      storeAction: StoreAction.UPDATE,
    });

    await waitFor(() => {
      expect(document.querySelector(".mind-map-node-handles__button")).toBeNull();
    });
  });

  it("adds a sibling node from a vertical timeline node", async () => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil("timeline-vertical", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const selectedNode = elements.find((element) => isMindMapNodeElement(element))!;

    excalidrawAPI.updateScene({
      elements,
      appState: {
        selectedElementIds: { [selectedNode.id]: true },
      },
      storeAction: StoreAction.UPDATE,
    });

    const button = await waitFor(() => {
      const node = document.querySelector(
        ".mind-map-node-handles__button--sibling",
      ) as HTMLButtonElement | null;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.click(button);

    await waitFor(() => {
      expect(window.h.elements.filter(isMindMapNodeElement)).toHaveLength(
        elements.filter(isMindMapNodeElement).length + 1,
      );
    });
  });
});
