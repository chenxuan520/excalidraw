import { useEffect } from "react";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawElements,
} from "../../packages/excalidraw/components/App";
import { KEYS } from "../../packages/excalidraw/keys";
import { isInputLike } from "../../packages/excalidraw/utils";
import { useI18n } from "../../packages/excalidraw/i18n";
import { getMindMapStencilDefaults } from "./mindMapStencils";
import { insertMindMapNodeAndEdit } from "./mindMapEditing";

export const MindMapKeyboardShortcuts = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const elements = useExcalidrawElements() as readonly OrderedExcalidrawElement[];
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isChildShortcut = event.key === KEYS.TAB;
      const isSiblingShortcut = event.key === KEYS.ENTER;
      if (!isChildShortcut && !isSiblingShortcut) {
        return;
      }

      if (
        event.defaultPrevented ||
        event.altKey ||
        event[KEYS.CTRL_OR_CMD] ||
        event.shiftKey ||
        isInputLike(event.target) ||
        appState.openDialog ||
        appState.viewModeEnabled ||
        appState.activeTool.type !== "selection" ||
        appState.selectedElementsAreBeingDragged ||
        appState.draggingElement ||
        appState.isResizing ||
        appState.editingElement
      ) {
        return;
      }

      const inserted = insertMindMapNodeAndEdit({
        app,
        appState,
        elements,
        mode: isChildShortcut ? "child" : "sibling",
        defaults: getMindMapStencilDefaults(t),
      });
      if (!inserted) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [app, appState, elements, t]);

  return null;
};
