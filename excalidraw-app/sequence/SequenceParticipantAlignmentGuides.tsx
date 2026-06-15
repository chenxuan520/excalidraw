import { useMemo } from "react";
import { createPortal } from "react-dom";
import {
  useExcalidrawAppState,
  useExcalidrawContainer,
  useExcalidrawElements,
} from "../../packages/excalidraw/components/App";
import type { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import { sceneCoordsToViewportCoords } from "../../packages/excalidraw/utils";
import { getSequenceParticipantAlignmentGuides } from "./sequenceParticipantAlignment";

import "./SequenceParticipantAlignmentGuides.scss";

const GUIDE_OFFSET_Y = 10;
const CONNECTOR_GAP = 6;

export const SequenceParticipantAlignmentGuides = () => {
  const appState = useExcalidrawAppState();
  const { container } = useExcalidrawContainer();
  const elements = useExcalidrawElements() as readonly ExcalidrawElement[];

  const guides = useMemo(() => {
    if (
      !appState.selectedElementsAreBeingDragged ||
      appState.viewModeEnabled ||
      appState.activeTool.type !== "selection"
    ) {
      return [];
    }

    return getSequenceParticipantAlignmentGuides({
      elements,
      selectedElementIds: appState.selectedElementIds,
      zoomValue: appState.zoom.value,
    });
  }, [
    appState.activeTool.type,
    appState.selectedElementIds,
    appState.selectedElementsAreBeingDragged,
    appState.viewModeEnabled,
    appState.zoom.value,
    elements,
  ]);

  if (!container || !guides.length) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();

  return createPortal(
    <div className="sequence-participant-alignment-guides">
      <svg
        className="sequence-participant-alignment-guides__svg"
        aria-hidden="true"
      >
        {guides.map((guide, index) => {
          const leftStart = sceneCoordsToViewportCoords(
            { sceneX: guide.leftX, sceneY: guide.y },
            appState,
          );
          const leftEnd = sceneCoordsToViewportCoords(
            { sceneX: guide.rightX, sceneY: guide.y },
            appState,
          );
          const rightStart = sceneCoordsToViewportCoords(
            { sceneX: guide.referenceLeftX, sceneY: guide.y },
            appState,
          );
          const rightEnd = sceneCoordsToViewportCoords(
            { sceneX: guide.referenceRightX, sceneY: guide.y },
            appState,
          );

          const y = leftStart.y - containerRect.top - GUIDE_OFFSET_Y;
          const leftX1 = leftStart.x - containerRect.left;
          const leftX2 = leftEnd.x - containerRect.left;
          const rightX1 = rightStart.x - containerRect.left;
          const rightX2 = rightEnd.x - containerRect.left;
          const connectorStart = leftX2 + CONNECTOR_GAP;
          const connectorEnd = rightX1 - CONNECTOR_GAP;

          return (
            <g key={`${guide.leftX}-${guide.referenceLeftX}-${index}`}>
              <path
                className="sequence-participant-alignment-guides__cap"
                d={`M ${leftX1} ${y} H ${leftX2}`}
              />
              <path
                className="sequence-participant-alignment-guides__cap"
                d={`M ${rightX1} ${y} H ${rightX2}`}
              />
              {connectorEnd > connectorStart && (
                <path
                  className="sequence-participant-alignment-guides__connector"
                  d={`M ${connectorStart} ${y} H ${connectorEnd}`}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>,
    container,
  );
};
