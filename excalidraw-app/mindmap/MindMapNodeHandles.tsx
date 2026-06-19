import { useMemo } from "react";
import { createPortal } from "react-dom";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawContainer,
  useExcalidrawElements,
} from "../../packages/excalidraw/components/App";
import { sceneCoordsToViewportCoords } from "../../packages/excalidraw/utils";
import { useI18n } from "../../packages/excalidraw/i18n";
import {
  getMindMapStencilDefaults,
  getMindMapElementMeta,
  getMindMapTemplateFamily,
  getMindMapTimelineOrientation,
  MIND_MAP_PLUS_OFFSET,
  type MindMapSide,
} from "./mindMapStencils";
import {
  buildMindMapTrees,
  getMindMapInsertPreview,
  getNextMindMapChildSide,
  resolveSelectedMindMapNodeElement,
} from "./mindMapSystem";
import { insertMindMapNodeAndEdit } from "./mindMapEditing";

import "./MindMapNodeHandles.scss";

const MindMapPlusIcon = () => {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 3v10M3 8h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

const getNodeRightHandlePoint = (node: OrderedExcalidrawElement) => ({
  x: node.x + node.width + MIND_MAP_PLUS_OFFSET,
  y: node.y + node.height / 2,
});

export const MindMapNodeHandles = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const elements = useExcalidrawElements() as readonly OrderedExcalidrawElement[];
  const { container } = useExcalidrawContainer();
  const { t } = useI18n();

  const selectedNode = useMemo(
    () => resolveSelectedMindMapNodeElement(elements, appState.selectedElementIds),
    [appState.selectedElementIds, elements],
  );

  const activeTree = useMemo(() => {
    if (!selectedNode) {
      return null;
    }
    return buildMindMapTrees(elements).trees.find((tree) => tree.nodes.has(selectedNode.id));
  }, [elements, selectedNode]);

  const defaults = getMindMapStencilDefaults(t);
  const canAddSibling = Boolean(activeTree?.nodes.get(selectedNode?.id || "")?.parentId);
  const childPreview = useMemo(() => {
    if (!selectedNode) {
      return null;
    }
    return getMindMapInsertPreview({
      elements,
      selectedElementIds: { [selectedNode.id]: true },
      mode: "child",
      defaults,
    });
  }, [defaults, elements, selectedNode]);
  const siblingPreview = useMemo(() => {
    if (!selectedNode || !canAddSibling) {
      return null;
    }
    return getMindMapInsertPreview({
      elements,
      selectedElementIds: { [selectedNode.id]: true },
      mode: "sibling",
      defaults,
    });
  }, [canAddSibling, defaults, elements, selectedNode]);

  const getHandleScenePoint = (
    preview: typeof childPreview,
    fallback: { x: number; y: number },
  ) => {
    if (!preview) {
      return fallback;
    }

    const anchorNode = selectedNode;
    if (!anchorNode) {
      return fallback;
    }

    const previewMeta = getMindMapElementMeta(preview.node);
    const previewOrientation = getMindMapTimelineOrientation(
      activeTree?.template || previewMeta?.template || "mindmap-right",
    );
    if (previewOrientation) {
      if (previewMeta?.lane === "top") {
        return {
          x: anchorNode.x + anchorNode.width / 2,
          y: anchorNode.y - MIND_MAP_PLUS_OFFSET,
        };
      }
      if (previewMeta?.lane === "bottom") {
        return {
          x: anchorNode.x + anchorNode.width / 2,
          y: anchorNode.y + anchorNode.height + MIND_MAP_PLUS_OFFSET,
        };
      }
      if (previewMeta?.lane === "left") {
        return {
          x: anchorNode.x - MIND_MAP_PLUS_OFFSET,
          y: anchorNode.y + anchorNode.height / 2,
        };
      }
      if (previewMeta?.lane === "right") {
        return {
          x: anchorNode.x + anchorNode.width + MIND_MAP_PLUS_OFFSET,
          y: anchorNode.y + anchorNode.height / 2,
        };
      }
      return fallback;
    }

    return {
      x:
        previewMeta?.side === "left"
          ? preview.node.x + preview.node.width + MIND_MAP_PLUS_OFFSET
          : preview.node.x - MIND_MAP_PLUS_OFFSET,
      y: preview.y,
    };
  };

  if (
    !container ||
    !selectedNode ||
    !activeTree ||
    app.device.editor.isMobile ||
    appState.viewModeEnabled ||
    appState.activeTool.type !== "selection" ||
    appState.selectedElementsAreBeingDragged ||
    appState.draggingElement ||
    appState.isResizing ||
    appState.editingElement
  ) {
    return null;
  }

  const nextSide: MindMapSide = getNextMindMapChildSide(
    activeTree,
    activeTree.nodes.get(selectedNode.id)!,
  );
  const containerRect = container.getBoundingClientRect();
  const timelineOrientation = getMindMapTimelineOrientation(activeTree.template);
  const isTimeline = getMindMapTemplateFamily(activeTree.template) === "timeline";
  const selectedMeta = getMindMapElementMeta(selectedNode);
  if (isTimeline && selectedMeta?.lane && selectedMeta.lane !== "center") {
    return null;
  }
  const childHandlePoint = getHandleScenePoint(
    childPreview,
    {
      x: isTimeline
        ? timelineOrientation === "vertical"
          ? selectedNode.x + selectedNode.width / 2
          : getNodeRightHandlePoint(selectedNode).x
        : nextSide === "right"
        ? getNodeRightHandlePoint(selectedNode).x
        : selectedNode.x - MIND_MAP_PLUS_OFFSET,
      y: isTimeline
        ? timelineOrientation === "vertical"
          ? selectedNode.y + selectedNode.height + MIND_MAP_PLUS_OFFSET
          : getNodeRightHandlePoint(selectedNode).y
        : selectedNode.y + selectedNode.height / 2,
    },
  );
  const siblingHandlePoint = getHandleScenePoint(
    siblingPreview,
    {
      x:
        isTimeline && timelineOrientation === "vertical"
          ? selectedNode.x + selectedNode.width + MIND_MAP_PLUS_OFFSET
          : selectedNode.x + selectedNode.width / 2,
      y:
        isTimeline && timelineOrientation === "vertical"
          ? selectedNode.y + selectedNode.height / 2
          : selectedNode.y + selectedNode.height + MIND_MAP_PLUS_OFFSET,
    },
  );
  const siblingViewportPoint = sceneCoordsToViewportCoords(
    { sceneX: siblingHandlePoint.x, sceneY: siblingHandlePoint.y },
    appState,
  );
  const viewportPoint = sceneCoordsToViewportCoords(
    { sceneX: childHandlePoint.x, sceneY: childHandlePoint.y },
    appState,
  );

  return createPortal(
    <div className="mind-map-node-handles">
      <button
        type="button"
        className="mind-map-node-handles__button"
        aria-label={t("mindMap.addChild")}
        title={t("mindMap.addChild")}
        style={{
          left: viewportPoint.x - containerRect.left,
          top: viewportPoint.y - containerRect.top,
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          const inserted = insertMindMapNodeAndEdit({
            app,
            appState,
            elements: app.scene.getElementsIncludingDeleted() as OrderedExcalidrawElement[],
            mode: "child",
            defaults,
          });
          if (!inserted) {
            return;
          }
          container.focus();
        }}
      >
        <MindMapPlusIcon />
      </button>
      {canAddSibling && (
        <button
          type="button"
          className="mind-map-node-handles__button mind-map-node-handles__button--sibling"
          aria-label={t("mindMap.addSibling")}
          title={t("mindMap.addSibling")}
          style={{
            left: siblingViewportPoint.x - containerRect.left,
            top: siblingViewportPoint.y - containerRect.top,
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();

            const inserted = insertMindMapNodeAndEdit({
              app,
              appState,
              elements:
                app.scene.getElementsIncludingDeleted() as OrderedExcalidrawElement[],
              mode: "sibling",
              defaults,
            });
            if (!inserted) {
              return;
            }
            container.focus();
          }}
        >
          <MindMapPlusIcon />
        </button>
      )}
    </div>,
    container,
  );
};
