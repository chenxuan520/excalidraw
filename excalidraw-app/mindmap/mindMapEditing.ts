import { StoreAction } from "../../packages/excalidraw/store";
import type { AppState } from "../../packages/excalidraw/types";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  getMindMapStencilDefaults,
  isMindMapNodeElement,
  type MindMapStencilDefaults,
} from "./mindMapStencils";
import {
  insertMindMapNode,
  type MindMapInsertMode,
} from "./mindMapSystem";

export const insertMindMapNodeAndEdit = ({
  app,
  appState,
  elements,
  mode,
  defaults = getMindMapStencilDefaults(),
}: {
  app: any;
  appState: AppState;
  elements: readonly OrderedExcalidrawElement[];
  mode: MindMapInsertMode;
  defaults?: MindMapStencilDefaults;
}) => {
  const result = insertMindMapNode({
    elements,
    selectedElementIds: appState.selectedElementIds,
    mode,
    defaults,
  });
  if (!result) {
    return false;
  }

  app.syncActionResult({
    elements: result.elements,
    appState: {
      ...appState,
      selectedElementIds: result.selectedElementIds,
      draggingElement: null,
      editingElement: null,
      editingLinearElement: null,
      multiElement: null,
      selectedLinearElement: null,
      suggestedBindings: [],
    },
    storeAction: StoreAction.CAPTURE,
  });

  const insertedNode = result.elements.find(
    (element) => element.id === result.insertedNodeId,
  );
  if (insertedNode && isMindMapNodeElement(insertedNode) && insertedNode.type === "text") {
    window.setTimeout(() => {
      const currentNode = app.scene.getElement(result.insertedNodeId);
      if (!currentNode || !isMindMapNodeElement(currentNode) || currentNode.type !== "text") {
        return;
      }

      (app as any).startTextEditing({
        sceneX: currentNode.x,
        sceneY: currentNode.y,
        insertAtParentCenter: false,
        autoEdit: true,
      });
    }, 0);
  }

  return true;
};
