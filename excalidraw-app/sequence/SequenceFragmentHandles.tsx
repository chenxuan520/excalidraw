import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StoreAction } from "../../packages/excalidraw/store";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import { newElementWith } from "../../packages/excalidraw/element/mutateElement";
import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawContainer,
  useExcalidrawElements,
} from "../../packages/excalidraw/components/App";
import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "../../packages/excalidraw/utils";
import {
  getSequenceElementMeta,
  isSequenceFragmentElement,
  SEQUENCE_FRAGMENT_HEADER_HEIGHT,
} from "./sequenceStencils";
import { synchronizeSequenceDiagramElements } from "./sequenceSystem";

import "./SequenceFragmentHandles.scss";

const HANDLE_MIN_OFFSET_Y = SEQUENCE_FRAGMENT_HEADER_HEIGHT + 18;
const HANDLE_BOTTOM_PADDING = 24;

type ActiveAltFragment = {
  key: string;
  outline: OrderedExcalidrawElement;
  divider: OrderedExcalidrawElement;
};

type DragState = {
  fragmentKey: string;
  currentClientX: number;
  currentClientY: number;
};

const DividerHandleIcon = () => {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 6h10" strokeLinecap="round" />
      <path d="M3 10h10" strokeLinecap="round" />
    </svg>
  );
};

const getFragmentKey = (element: OrderedExcalidrawElement) => {
  return element.groupIds[0] || element.id;
};

const getClampedDividerOffsetY = (
  outline: Pick<OrderedExcalidrawElement, "height">,
  offsetY: number,
) => {
  return Math.min(
    Math.max(HANDLE_MIN_OFFSET_Y, offsetY),
    Math.max(outline.height - HANDLE_BOTTOM_PADDING, HANDLE_MIN_OFFSET_Y),
  );
};

export const SequenceFragmentHandles = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const elements = useExcalidrawElements() as readonly OrderedExcalidrawElement[];
  const { container } = useExcalidrawContainer();
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const activeFragment = useMemo(() => {
    const selectedIds = appState.selectedElementIds || {};
    const selectedKeys = new Set(
      elements
        .filter((element) => selectedIds[element.id])
        .map((element) => getFragmentKey(element)),
    );
    const fragments = new Map<string, ActiveAltFragment>();

    for (const element of elements) {
      if (element.isDeleted || !isSequenceFragmentElement(element)) {
        continue;
      }

      const meta = getSequenceElementMeta(element);
      if (meta?.variant !== "alt") {
        continue;
      }

      const key = getFragmentKey(element as OrderedExcalidrawElement);
      const fragment =
        fragments.get(key) ||
        ({ key, outline: null, divider: null } as unknown as ActiveAltFragment);

      if (meta?.part === "outline") {
        fragment.outline = element as OrderedExcalidrawElement;
      }
      if (meta?.part === "divider") {
        fragment.divider = element as OrderedExcalidrawElement;
      }

      fragments.set(key, fragment);
    }

    const targetKey = dragState?.fragmentKey
      ? dragState.fragmentKey
      : selectedKeys.size === 1
      ? [...selectedKeys][0]
      : null;

    if (!targetKey) {
      return null;
    }

    const fragment = fragments.get(targetKey);
    if (!fragment?.outline || !fragment.divider) {
      return null;
    }

    return fragment;
  }, [appState.selectedElementIds, dragState?.fragmentKey, elements]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  if (
    !container ||
    !activeFragment ||
    app.device.editor.isMobile ||
    appState.viewModeEnabled ||
    appState.activeTool.type !== "selection"
  ) {
    return null;
  }

  const { outline, divider } = activeFragment;
  const containerRect = container.getBoundingClientRect();
  const dividerOffsetY = (() => {
    if (dragState) {
      const pointerScene = viewportCoordsToSceneCoords(
        {
          clientX: dragState.currentClientX,
          clientY: dragState.currentClientY,
        },
        appState,
      );
      return getClampedDividerOffsetY(outline, pointerScene.y - outline.y);
    }

    return getClampedDividerOffsetY(
      outline,
      getSequenceElementMeta(divider)?.offsetY ?? divider.y - outline.y,
    );
  })();
  const dividerY = outline.y + dividerOffsetY;
  const leftViewport = sceneCoordsToViewportCoords(
    { sceneX: outline.x, sceneY: dividerY },
    appState,
  );
  const rightViewport = sceneCoordsToViewportCoords(
    { sceneX: outline.x + outline.width, sceneY: dividerY },
    appState,
  );
  const centerViewport = sceneCoordsToViewportCoords(
    { sceneX: outline.x + outline.width / 2, sceneY: dividerY },
    appState,
  );

  return createPortal(
    <div className="sequence-fragment-handles">
      <svg className="sequence-fragment-handles__preview" aria-hidden="true">
        <path
          d={`M ${leftViewport.x - containerRect.left} ${leftViewport.y - containerRect.top} H ${rightViewport.x - containerRect.left}`}
        />
      </svg>
      <button
        type="button"
        className="sequence-fragment-handles__handle"
        style={{
          left: centerViewport.x - containerRect.left,
          top: centerViewport.y - containerRect.top,
        }}
        aria-label="Drag alt divider"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();

          const ownerDocument = container.ownerDocument || document;
          const ownerWindow = ownerDocument.defaultView || window;
          const nextDragState: DragState = {
            fragmentKey: activeFragment.key,
            currentClientX: event.clientX,
            currentClientY: event.clientY,
          };

          const cleanup = () => {
            ownerDocument.removeEventListener("pointermove", onPointerMove);
            ownerDocument.removeEventListener("pointerup", onPointerUp);
            ownerWindow.removeEventListener("blur", onCancel);
            dragCleanupRef.current = null;
          };

          const finishDrag = (clientX: number, clientY: number) => {
            const pointerScene = viewportCoordsToSceneCoords(
              { clientX, clientY },
              appState,
            );
            const nextOffsetY = getClampedDividerOffsetY(
              outline,
              pointerScene.y - outline.y,
            );
            const nextSelectedElementIds = {
              ...(appState.selectedElementIds || {}),
              [divider.id]: true,
            } as Record<string, true>;
            const nextDivider = newElementWith(divider, {
              y: outline.y + nextOffsetY,
              customData: {
                ...divider.customData,
                sequenceDiagram: {
                  ...getSequenceElementMeta(divider),
                  role: "fragment",
                  variant: "alt",
                  part: "divider",
                  offsetY: nextOffsetY,
                },
              },
            }) as OrderedExcalidrawElement;
            const nextElements = app.scene
              .getElementsIncludingDeleted()
              .map((element) =>
                element.id === divider.id ? nextDivider : element,
              ) as OrderedExcalidrawElement[];
            const synced = synchronizeSequenceDiagramElements(
              nextElements,
              nextSelectedElementIds,
            );

            app.syncActionResult({
              elements: synced.changed ? synced.elements : nextElements,
              appState: {
                ...appState,
                selectedElementIds: nextSelectedElementIds,
                draggingElement: null,
                editingElement: null,
                multiElement: null,
                selectedLinearElement: null,
                suggestedBindings: [],
              },
              storeAction: StoreAction.CAPTURE,
            });
            container.focus();
          };

          const onCancel = () => {
            cleanup();
            setDragState(null);
          };

          const onPointerMove = (moveEvent: PointerEvent) => {
            setDragState((current) =>
              current
                ? {
                    ...current,
                    currentClientX: moveEvent.clientX,
                    currentClientY: moveEvent.clientY,
                  }
                : current,
            );
          };

          const onPointerUp = (upEvent: PointerEvent) => {
            cleanup();
            setDragState(null);
            finishDrag(upEvent.clientX, upEvent.clientY);
          };

          setDragState(nextDragState);
          dragCleanupRef.current?.();
          dragCleanupRef.current = cleanup;
          ownerDocument.addEventListener("pointermove", onPointerMove, {
            passive: true,
          });
          ownerDocument.addEventListener("pointerup", onPointerUp);
          ownerWindow.addEventListener("blur", onCancel);
        }}
      >
        <DividerHandleIcon />
      </button>
    </div>,
    container,
  );
};
