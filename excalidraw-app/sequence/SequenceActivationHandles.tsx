import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LinearElementEditor } from "../../packages/excalidraw/element/linearElementEditor";
import { newElementWith } from "../../packages/excalidraw/element/mutateElement";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import { syncMovedIndices } from "../../packages/excalidraw/fractionalIndex";
import { StoreAction } from "../../packages/excalidraw/store";
import {
  arrayToMap,
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "../../packages/excalidraw/utils";
import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawContainer,
  useExcalidrawElements,
} from "../../packages/excalidraw/components/App";
import { convertToExcalidrawElements } from "../../packages/excalidraw";
import { useI18n } from "../../packages/excalidraw/i18n";
import {
  DEFAULT_SEQUENCE_REQUEST_DIRECTION,
  createSequenceActivationStencil,
  createSequenceStencil,
  getSequenceStencilDefaults,
  getSequenceElementMeta,
  getSequenceLaneId,
  getSequenceMessageKindForDirection,
  isSequenceActivationElement,
  isSequenceLifelineElement,
  isSequenceParticipantElement,
  type SequenceRequestDirection,
  SEQUENCE_SELF_CALL_HEIGHT,
} from "./sequenceStencils";
import { synchronizeSequenceDiagramElements } from "./sequenceSystem";

import "./SequenceActivationHandles.scss";

const HANDLE_HIT_PADDING = 20;
const HANDLE_OFFSET = 14;
const DRAG_THRESHOLD = 10;
const HANDLE_VERTICAL_PADDING = 8;
const ACTIVATION_REUSE_THRESHOLD = 24;
const GHOST_ACTIVATION_HEIGHT = 88;
const GHOST_ACTIVATION_WIDTH = 18;
const LIFELINE_HIT_PADDING = 18;

type Side = "left" | "right";

type LaneAnchor = {
  laneId: string;
  centerX: number;
  topY: number;
  bottomY: number;
};

type ActivationSource = {
  activationId?: string;
  laneId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isGhost: boolean;
};

const getLaneAnchorId = (element: OrderedExcalidrawElement) => {
  return element.groupIds[0]
    ? `sequence-lane-${element.groupIds[0]}`
    : getSequenceLaneId(element) || element.id;
};

type DragState = {
  source: ActivationSource;
  side: Side;
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
};

type HoveredActivation = {
  source: ActivationSource;
  sceneY: number;
};

const HandleIcon = ({ side }: { side: Side }) => {
  const direction = side === "left" ? -1 : 1;

  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={`M ${side === "left" ? 11 : 5} 4 L ${side === "left" ? 5 : 11} 8 L ${
          side === "left" ? 11 : 5
        } 12`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={`M ${8 - direction * 5} 8 H ${8 + direction * 4}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

const mergeSequenceMeta = (
  element: ExcalidrawElement,
  patch: Record<string, unknown>,
) => {
  return {
    ...element.customData,
    sequenceDiagram: {
      ...getSequenceElementMeta(element),
      ...patch,
    },
  };
};

const clampActivationSceneY = (
  activation: Pick<ExcalidrawElement, "y" | "height">,
  sceneY: number,
) => {
  return Math.min(
    activation.y + activation.height - HANDLE_VERTICAL_PADDING,
    Math.max(activation.y + HANDLE_VERTICAL_PADDING, sceneY),
  );
};

const createActivationSource = (
  laneId: string,
  rect: Pick<ActivationSource, "x" | "y" | "width" | "height">,
  opts?: { activationId?: string; isGhost?: boolean },
): ActivationSource => ({
  laneId,
  x: rect.x,
  y: rect.y,
  width: rect.width,
  height: rect.height,
  activationId: opts?.activationId,
  isGhost: opts?.isGhost ?? false,
});

const getGhostActivationSource = (
  lane: LaneAnchor,
  sceneY: number,
): ActivationSource => {
  const topY = Math.min(
    lane.bottomY - GHOST_ACTIVATION_HEIGHT,
    Math.max(lane.topY, sceneY),
  );

  return createActivationSource(
    lane.laneId,
    {
      x: lane.centerX - GHOST_ACTIVATION_WIDTH / 2,
      y: topY,
      width: GHOST_ACTIVATION_WIDTH,
      height: GHOST_ACTIVATION_HEIGHT,
    },
    { isGhost: true },
  );
};

export const SequenceActivationHandles = ({
  requestDirection = DEFAULT_SEQUENCE_REQUEST_DIRECTION,
}: {
  requestDirection?: SequenceRequestDirection;
}) => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const elements =
    useExcalidrawElements() as readonly OrderedExcalidrawElement[];
  const { container } = useExcalidrawContainer();
  const { t } = useI18n();

  const [hoveredActivation, setHoveredActivation] =
    useState<HoveredActivation | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const defaults = getSequenceStencilDefaults(t);

  const laneAnchors = useMemo(() => {
    const laneMap = new Map<string, LaneAnchor>();

    for (const element of elements) {
      const laneId = getLaneAnchorId(element);
      if (!laneId) {
        continue;
      }

      if (
        !isSequenceParticipantElement(element) &&
        !isSequenceLifelineElement(element)
      ) {
        continue;
      }

      const centerX = element.x + element.width / 2;
      const existing = laneMap.get(laneId) || {
        laneId,
        centerX,
        topY: Infinity,
        bottomY: -Infinity,
      };
      if (isSequenceParticipantElement(element)) {
        existing.centerX = centerX;
      }
      if (isSequenceLifelineElement(element)) {
        existing.topY = element.y;
        existing.bottomY = element.y + element.height;
        if (!laneMap.has(laneId)) {
          existing.centerX = centerX;
        }
      }

      laneMap.set(laneId, existing);
    }

    return [...laneMap.values()]
      .filter(
        (lane) => Number.isFinite(lane.topY) && Number.isFinite(lane.bottomY),
      )
      .sort((a, b) => a.centerX - b.centerX);
  }, [elements]);

  const activationElements = useMemo(() => {
    return elements.filter((element) => isSequenceActivationElement(element));
  }, [elements]);

  const activeSource = dragState?.source || hoveredActivation?.source || null;

  const findClosestLane = useCallback(
    (sceneX: number) => {
      let closest: LaneAnchor | null = null;
      let distance = Infinity;

      for (const lane of laneAnchors) {
        const delta = Math.abs(lane.centerX - sceneX);
        if (delta < distance) {
          distance = delta;
          closest = lane;
        }
      }

      return closest;
    },
    [laneAnchors],
  );

  useEffect(() => {
    if (
      !app.interactiveCanvas ||
      dragState ||
      app.device.editor.isMobile ||
      appState.viewModeEnabled ||
      appState.activeTool.type !== "selection" ||
      appState.draggingElement ||
      appState.selectedElementsAreBeingDragged
    ) {
      setHoveredActivation(null);
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const canvasRect = app.interactiveCanvas?.getBoundingClientRect();
      if (!canvasRect) {
        return;
      }

      if (
        event.clientX < canvasRect.left ||
        event.clientX > canvasRect.right ||
        event.clientY < canvasRect.top ||
        event.clientY > canvasRect.bottom
      ) {
        setHoveredActivation(null);
        return;
      }

      const { x: sceneX, y: sceneY } = viewportCoordsToSceneCoords(
        { clientX: event.clientX, clientY: event.clientY },
        appState,
      );

      const hovered = [...activationElements].reverse().find((activation) => {
        return (
          sceneX >= activation.x - HANDLE_HIT_PADDING &&
          sceneX <= activation.x + activation.width + HANDLE_HIT_PADDING &&
          sceneY >= activation.y - 8 &&
          sceneY <= activation.y + activation.height + 8
        );
      });

      if (!hovered) {
        const hoveredLane = laneAnchors.find(
          (lane) =>
            Math.abs(sceneX - lane.centerX) <= LIFELINE_HIT_PADDING &&
            sceneY >= lane.topY - 8 &&
            sceneY <= lane.bottomY + 8,
        );

        if (!hoveredLane) {
          setHoveredActivation(null);
          return;
        }

        const ghostSource = getGhostActivationSource(hoveredLane, sceneY);
        setHoveredActivation({
          source: ghostSource,
          sceneY: ghostSource.y,
        });
        return;
      }

      const laneId = getLaneAnchorId(hovered);

      setHoveredActivation({
        source: createActivationSource(
          laneId,
          hovered,
          { activationId: hovered.id },
        ),
        sceneY: clampActivationSceneY(hovered, sceneY),
      });
    };

    const onBlur = () => setHoveredActivation(null);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    activationElements,
    app.device.editor.isMobile,
    app.interactiveCanvas,
    appState,
    dragState,
  ]);

  const finishDrag = useCallback(
    (
      currentDragState: DragState,
      event: PointerEvent,
    ) => {
      const sourceLane =
        laneAnchors.find(
          (lane) => lane.laneId === currentDragState.source.laneId,
        ) ||
        findClosestLane(
          currentDragState.source.x + currentDragState.source.width / 2,
        );
      const dragDistance = Math.hypot(
        event.clientX - currentDragState.startClientX,
        event.clientY - currentDragState.startClientY,
      );

      setDragState(null);

      if (!sourceLane || dragDistance < DRAG_THRESHOLD) {
        return;
      }

      const scenePoint = viewportCoordsToSceneCoords(
        { clientX: event.clientX, clientY: event.clientY },
        appState,
      );
      const dragStartScenePoint = viewportCoordsToSceneCoords(
        {
          clientX: currentDragState.startClientX,
          clientY: currentDragState.startClientY,
        },
        appState,
      );
      const targetLane = findClosestLane(scenePoint.x);
      if (!targetLane) {
        return;
      }

      const kind =
        targetLane.laneId === sourceLane.laneId
          ? "self"
          : getSequenceMessageKindForDirection({
              sourceX: sourceLane.centerX,
              targetX: targetLane.centerX,
              requestDirection,
            });
      const draftElements = convertToExcalidrawElements(
        createSequenceStencil(kind, appState.theme, defaults),
        { regenerateIds: false },
      ) as OrderedExcalidrawElement[];
      const sourceActivationElements = currentDragState.source.isGhost
        ? (convertToExcalidrawElements(
            createSequenceActivationStencil({
              centerX: sourceLane.centerX,
              y: currentDragState.source.y,
              height: currentDragState.source.height,
              theme: appState.theme,
              laneId: sourceLane.laneId,
            }),
            { regenerateIds: false },
          ).map((element) =>
            newElementWith(element as OrderedExcalidrawElement, {
              customData: mergeSequenceMeta(element, {
                laneId: sourceLane.laneId,
                offsetX: 0,
              }),
            }) as OrderedExcalidrawElement,
          ) as OrderedExcalidrawElement[])
        : [];
      const sourceActivation = currentDragState.source.activationId
        ? activationElements.find(
            (candidate) => candidate.id === currentDragState.source.activationId,
          )
        : sourceActivationElements[0];

      if (!sourceActivation) {
        return;
      }

      const startSceneY = currentDragState.source.isGhost
        ? currentDragState.source.y
        : clampActivationSceneY(sourceActivation, dragStartScenePoint.y);
      const messageY = currentDragState.source.isGhost
        ? startSceneY
        : scenePoint.y;

      const existingTargetActivation =
        kind !== "self" && targetLane.laneId !== sourceLane.laneId
          ? activationElements.find((candidate) => {
              if (candidate.id === sourceActivation.id) {
                return false;
              }

              const candidateLane =
                laneAnchors.find(
                  (lane) =>
                    Math.abs(
                      lane.centerX - (candidate.x + candidate.width / 2),
                    ) <= candidate.width,
                ) || findClosestLane(candidate.x + candidate.width / 2);

              if (
                !candidateLane ||
                candidateLane.laneId !== targetLane.laneId
              ) {
                return false;
              }

              return currentDragState.source.isGhost
                ? Math.abs(candidate.y - messageY) <= ACTIVATION_REUSE_THRESHOLD
                : scenePoint.y >= candidate.y - ACTIVATION_REUSE_THRESHOLD &&
                    scenePoint.y <=
                      candidate.y + candidate.height + ACTIVATION_REUSE_THRESHOLD;
            })
          : undefined;
      let targetActivationElements: OrderedExcalidrawElement[] = [];
      if (
        targetLane.laneId !== sourceLane.laneId &&
        !existingTargetActivation
      ) {
        targetActivationElements = convertToExcalidrawElements(
          createSequenceActivationStencil({
            centerX: targetLane.centerX,
            y: messageY,
            height: 88,
            theme: appState.theme,
            laneId: targetLane.laneId,
          }),
          { regenerateIds: false },
        ) as OrderedExcalidrawElement[];
      }
      const targetActivation = existingTargetActivation || targetActivationElements[0];
      const endSceneY = scenePoint.y;
      const targetOnRight = targetLane.centerX >= sourceLane.centerX;
      const sourceAnchorX =
        kind === "self"
          ? currentDragState.side === "left"
            ? sourceActivation.x
            : sourceActivation.x + sourceActivation.width
          : targetOnRight
          ? sourceActivation.x + sourceActivation.width
          : sourceActivation.x;

      const insertedElements = draftElements.map((element) => {
        const meta = getSequenceElementMeta(element);
        if (meta?.role !== "message") {
          return element;
        }

        if (kind === "self") {
          const topY = Math.min(startSceneY, endSceneY);
          const startOffsetY = startSceneY - topY;
          const endOffsetY =
            endSceneY === startSceneY
              ? startOffsetY + SEQUENCE_SELF_CALL_HEIGHT
              : endSceneY - topY;
          const rightDelta = Math.max(56, scenePoint.x - sourceAnchorX);
          return newElementWith(
            element as OrderedExcalidrawElement & ExcalidrawLinearElement,
            {
              x: sourceAnchorX,
              y: topY,
              width: rightDelta,
              height: Math.abs(endOffsetY - startOffsetY),
              points: [
                [0, startOffsetY],
                [rightDelta, startOffsetY],
                [rightDelta, endOffsetY],
                [0, endOffsetY],
              ],
              customData: mergeSequenceMeta(element, {
                fromLaneId: sourceLane.laneId,
                toLaneId: sourceLane.laneId,
                variant: "self",
                fromActivationId: sourceActivation.id,
                toActivationId: undefined,
              }),
            },
          ) as OrderedExcalidrawElement;
        }

        const targetAnchorX = targetActivation
          ? targetOnRight
            ? targetActivation.x
            : targetActivation.x + targetActivation.width
          : targetLane.centerX;
        const deltaX = targetAnchorX - sourceAnchorX;

        return newElementWith(
          element as OrderedExcalidrawElement & ExcalidrawLinearElement,
          {
            x: sourceAnchorX,
            y: messageY,
            width: Math.abs(deltaX),
            height: 1,
            points: [
              [0, 0],
              [deltaX, 0],
            ],
            customData: mergeSequenceMeta(element, {
              fromLaneId: sourceLane.laneId,
              toLaneId: targetLane.laneId,
              variant: kind === "return" ? "return" : "message",
              fromActivationId: sourceActivation.id,
              toActivationId: targetActivation?.id,
            }),
          },
        ) as OrderedExcalidrawElement;
      });

      const insertedMessage = insertedElements.find(
        (element) => getSequenceElementMeta(element)?.role === "message",
      ) as OrderedExcalidrawElement | undefined;
      if (!insertedMessage) {
        return;
      }

      const selectedElementIds = { [insertedMessage.id]: true } as Record<
        string,
        true
      >;
      const nextElements = [
        ...app.scene.getElementsIncludingDeleted(),
        ...sourceActivationElements,
        ...targetActivationElements,
        ...insertedElements,
      ] as OrderedExcalidrawElement[];
      syncMovedIndices(
        nextElements,
        arrayToMap([
          ...sourceActivationElements,
          ...targetActivationElements,
          ...insertedElements,
        ]),
      );
      const synced = synchronizeSequenceDiagramElements(
        nextElements,
        selectedElementIds,
      );
      const finalMessage = (
        synced.changed ? synced.elements : nextElements
      ).find((element) => element.id === insertedMessage.id) as
        | (OrderedExcalidrawElement & ExcalidrawLinearElement)
        | undefined;

      app.syncActionResult({
        elements: synced.changed ? synced.elements : nextElements,
        appState: {
          ...appState,
          selectedElementIds,
          selectedGroupIds: {},
          editingGroupId: null,
          draggingElement: null,
          editingElement: null,
          multiElement: null,
          startBoundElement: null,
          suggestedBindings: [],
          selectedLinearElement: finalMessage
            ? new LinearElementEditor(finalMessage)
            : null,
        },
        storeAction: StoreAction.CAPTURE,
      });

      container?.focus();
    },
    [
      activationElements,
      app,
      appState,
      container,
      defaults,
      findClosestLane,
      laneAnchors,
      requestDirection,
    ],
  );

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  if (!container || !activeSource || app.device.editor.isMobile) {
    return null;
  }

  const laneId = activeSource.laneId;
  if (!laneId) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const handleSceneY = (() => {
    if (activeSource.isGhost) {
      return activeSource.y;
    }

    if (dragState) {
      const pointerScene = viewportCoordsToSceneCoords(
        {
          clientX: dragState.currentClientX,
          clientY: dragState.currentClientY,
        },
        appState,
      );
      return clampActivationSceneY(activeSource, pointerScene.y);
    }

    if (
      hoveredActivation &&
      hoveredActivation.source.laneId === activeSource.laneId &&
      hoveredActivation.source.activationId === activeSource.activationId &&
      hoveredActivation.source.isGhost === activeSource.isGhost
    ) {
      return clampActivationSceneY(activeSource, hoveredActivation.sceneY);
    }

    return activeSource.y + activeSource.height / 2;
  })();
  const leftHandleViewport = sceneCoordsToViewportCoords(
    { sceneX: activeSource.x, sceneY: handleSceneY },
    appState,
  );
  const rightHandleViewport = sceneCoordsToViewportCoords(
    {
      sceneX: activeSource.x + activeSource.width,
      sceneY: handleSceneY,
    },
    appState,
  );

  const handleStyles = {
    left: {
      left: leftHandleViewport.x - containerRect.left - HANDLE_OFFSET,
      top: leftHandleViewport.y - containerRect.top,
    },
    right: {
      left: rightHandleViewport.x - containerRect.left + HANDLE_OFFSET,
      top: rightHandleViewport.y - containerRect.top,
    },
  };
  const hoverGhostActivation =
    activeSource.isGhost && !dragState
      ? {
          x: leftHandleViewport.x - containerRect.left,
          y:
            sceneCoordsToViewportCoords(
              {
                sceneX: activeSource.x,
                sceneY: activeSource.y,
              },
              appState,
            ).y - containerRect.top,
          width: activeSource.width,
          height: activeSource.height,
        }
      : null;

  const preview = (() => {
    if (!dragState) {
      return null;
    }

    const targetScene = viewportCoordsToSceneCoords(
      {
        clientX: dragState.currentClientX,
        clientY: dragState.currentClientY,
      },
      appState,
    );
    const targetLane = findClosestLane(targetScene.x);
    const sourceLane = laneAnchors.find((lane) => lane.laneId === dragState.source.laneId);
    const previewLineSceneY = dragState.source.isGhost
      ? dragState.source.y
      : targetScene.y;
    const previewKind =
      targetLane && sourceLane && targetLane.laneId !== sourceLane.laneId
        ? getSequenceMessageKindForDirection({
            sourceX: sourceLane.centerX,
            targetX: targetLane.centerX,
            requestDirection,
          })
        : targetLane && sourceLane && targetLane.laneId === sourceLane.laneId
        ? "self"
        : null;
    const targetOnRight =
      sourceLane && targetLane ? targetLane.centerX >= sourceLane.centerX : true;
    const endViewport = targetLane
      ? sceneCoordsToViewportCoords(
          {
            sceneX:
              targetOnRight ? targetLane.centerX - 9 : targetLane.centerX + 9,
            sceneY: previewLineSceneY,
          },
          appState,
        )
      : { x: dragState.currentClientX, y: dragState.currentClientY };

    const start = {
      x:
        ((previewKind === "self"
          ? dragState.side === "left"
            ? leftHandleViewport.x
            : rightHandleViewport.x
          : targetOnRight
          ? rightHandleViewport.x
          : leftHandleViewport.x) - containerRect.left),
      y: dragState.source.isGhost
        ? ((previewKind === "self"
            ? dragState.side === "left"
              ? leftHandleViewport.y
              : rightHandleViewport.y
            : targetOnRight
            ? rightHandleViewport.y
            : leftHandleViewport.y) - containerRect.top)
        : dragState.currentClientY - containerRect.top,
    };
    const end = {
      x: endViewport.x - containerRect.left,
      y: endViewport.y - containerRect.top,
    };
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowSize = 7;
    const previewActivation = targetLane
      ? {
          x: targetLane.centerX - 9 - containerRect.left,
          y:
            (dragState.source.isGhost
              ? start.y
              : end.y),
          width: 18,
          height: 88,
        }
      : null;

    return {
      start,
      end,
      sourceActivation: activeSource.isGhost
        ? {
            x:
              sceneCoordsToViewportCoords(
                {
                  sceneX: activeSource.x,
                  sceneY: activeSource.y,
                },
                appState,
              ).x - containerRect.left,
            y:
              sceneCoordsToViewportCoords(
                {
                  sceneX: activeSource.x,
                  sceneY: activeSource.y,
                },
                appState,
              ).y - containerRect.top,
            width: activeSource.width,
            height: activeSource.height,
          }
        : null,
      arrowA: {
        x: end.x - arrowSize * Math.cos(angle - Math.PI / 6),
        y: end.y - arrowSize * Math.sin(angle - Math.PI / 6),
      },
      arrowB: {
        x: end.x - arrowSize * Math.cos(angle + Math.PI / 6),
        y: end.y - arrowSize * Math.sin(angle + Math.PI / 6),
      },
      dashed: previewKind === "return",
      previewActivation: previewKind === "self" ? null : previewActivation,
    };
  })();

  return createPortal(
    <div className="sequence-activation-handles">
      {hoverGhostActivation && (
        <svg
          className="sequence-activation-handles__preview"
          aria-hidden="true"
        >
          <rect
            className="sequence-activation-handles__ghost-activation sequence-activation-handles__hover-activation"
            x={hoverGhostActivation.x}
            y={hoverGhostActivation.y}
            width={hoverGhostActivation.width}
            height={hoverGhostActivation.height}
            rx="6"
          />
        </svg>
      )}
      {preview && (
        <svg
          className="sequence-activation-handles__preview"
          aria-hidden="true"
        >
          {preview.sourceActivation && (
            <rect
              className="sequence-activation-handles__ghost-activation sequence-activation-handles__hover-activation"
              x={preview.sourceActivation.x}
              y={preview.sourceActivation.y}
              width={preview.sourceActivation.width}
              height={preview.sourceActivation.height}
              rx="6"
            />
          )}
          {preview.previewActivation && (
            <rect
              className="sequence-activation-handles__ghost-activation"
              x={preview.previewActivation.x}
              y={preview.previewActivation.y}
              width={preview.previewActivation.width}
              height={preview.previewActivation.height}
              rx="6"
            />
          )}
          <path
            d={`M ${preview.start.x} ${preview.start.y} L ${preview.end.x} ${preview.end.y}`}
            strokeDasharray={preview.dashed ? "5 4" : undefined}
          />
          <path
            d={`M ${preview.arrowA.x} ${preview.arrowA.y} L ${preview.end.x} ${preview.end.y} L ${preview.arrowB.x} ${preview.arrowB.y}`}
          />
        </svg>
      )}

      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          type="button"
          className="sequence-activation-handles__handle"
          style={handleStyles[side]}
          aria-label={
            side === "left"
              ? t("sequenceDiagram.items.return.label")
              : t("sequenceDiagram.items.message.label")
          }
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const nextDragState: DragState = {
              source: activeSource,
              side,
              startClientX: event.clientX,
              startClientY: event.clientY,
              currentClientX: event.clientX,
              currentClientY: event.clientY,
            };

            setDragState(nextDragState);
            const ownerDocument = container?.ownerDocument || document;
            const ownerWindow = ownerDocument.defaultView || window;

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

            const cleanup = () => {
              ownerDocument.removeEventListener("pointermove", onPointerMove);
              ownerDocument.removeEventListener("pointerup", onPointerUp);
              ownerWindow.removeEventListener("blur", onCancel);
              dragCleanupRef.current = null;
            };

            const onCancel = () => {
              cleanup();
              setDragState(null);
            };

            const onPointerUp = (upEvent: PointerEvent) => {
              cleanup();
              finishDrag(nextDragState, upEvent);
            };

            dragCleanupRef.current?.();
            dragCleanupRef.current = cleanup;
            ownerDocument.addEventListener("pointermove", onPointerMove, {
              passive: true,
            });
            ownerDocument.addEventListener("pointerup", onPointerUp);
            ownerWindow.addEventListener("blur", onCancel);
          }}
          onPointerMove={(event) => {
            if (
              !dragState ||
              dragState.source.laneId !== activeSource.laneId ||
              dragState.source.activationId !== activeSource.activationId ||
              dragState.side !== side
            ) {
              return;
            }

            setDragState({
              ...dragState,
              currentClientX: event.clientX,
              currentClientY: event.clientY,
            });
          }}
          onPointerCancel={(event) => {
            if (
              !dragState ||
              dragState.source.laneId !== activeSource.laneId ||
              dragState.source.activationId !== activeSource.activationId ||
              dragState.side !== side
            ) {
              return;
            }

            dragCleanupRef.current?.();
            setDragState(null);
          }}
        >
          <HandleIcon side={side} />
        </button>
      ))}
    </div>,
    container,
  );
};
