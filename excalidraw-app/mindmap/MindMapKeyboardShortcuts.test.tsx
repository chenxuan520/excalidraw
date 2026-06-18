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
import { createMindMapStencil, isMindMapNodeElement } from "./mindMapStencils";
import { MindMapKeyboardShortcuts } from "./MindMapKeyboardShortcuts";

const defaults = {
  mainTopic: "输入文本",
  topic: "输入文本",
  subtopic: "输入文本",
  event: "输入文本",
};

describe("MindMapKeyboardShortcuts", () => {
  let excalidrawAPI: ExcalidrawImperativeAPI;

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
        <MindMapKeyboardShortcuts />
      </Excalidraw>,
    );
    excalidrawAPI = await apiPromise;
  });

  it("uses Enter to add a sibling instead of entering text edit", async () => {
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

    fireEvent.keyDown(window, { key: "Enter" });

    await waitFor(() => {
      expect(window.h.elements.filter(isMindMapNodeElement)).toHaveLength(
        elements.filter(isMindMapNodeElement).length + 1,
      );
    });
  });
});
