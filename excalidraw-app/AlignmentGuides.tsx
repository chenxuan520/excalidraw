import { createPortal } from "react-dom";
import {
  useExcalidrawAppState,
  useExcalidrawContainer,
} from "../packages/excalidraw/components/App";
import { sceneCoordsToViewportCoords } from "../packages/excalidraw/utils";
import type { AlignmentGuide } from "./alignmentGuideTypes";

import "./AlignmentGuides.scss";

const GUIDE_OFFSET = 10;
const CONNECTOR_GAP = 6;

export const AlignmentGuides = ({
  guides,
}: {
  guides: readonly AlignmentGuide[];
}) => {
  const appState = useExcalidrawAppState();
  const { container } = useExcalidrawContainer();

  if (!container || !guides.length) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();

  return createPortal(
    <div className="alignment-guides">
      <svg className="alignment-guides__svg" aria-hidden="true">
        {guides.map((guide, index) => {
          if (guide.edge === "top") {
            const selectedStart = sceneCoordsToViewportCoords(
              { sceneX: guide.start, sceneY: guide.position },
              appState,
            );
            const selectedEnd = sceneCoordsToViewportCoords(
              { sceneX: guide.end, sceneY: guide.position },
              appState,
            );
            const referenceStart = sceneCoordsToViewportCoords(
              { sceneX: guide.referenceStart, sceneY: guide.position },
              appState,
            );
            const referenceEnd = sceneCoordsToViewportCoords(
              { sceneX: guide.referenceEnd, sceneY: guide.position },
              appState,
            );

            const y = selectedStart.y - containerRect.top - GUIDE_OFFSET;
            const segments = [
              {
                start: selectedStart.x - containerRect.left,
                end: selectedEnd.x - containerRect.left,
              },
              {
                start: referenceStart.x - containerRect.left,
                end: referenceEnd.x - containerRect.left,
              },
            ]
              .map((segment) => ({
                start: Math.min(segment.start, segment.end),
                end: Math.max(segment.start, segment.end),
              }))
              .sort((a, b) => a.start - b.start);

            const connectorStart = segments[0].end + CONNECTOR_GAP;
            const connectorEnd = segments[1].start - CONNECTOR_GAP;

            return (
              <g
                key={`${guide.edge}-${guide.position}-${guide.start}-${guide.referenceStart}-${index}`}
              >
                {segments.map((segment, segmentIndex) => (
                  <path
                    key={segmentIndex}
                    className="alignment-guides__cap"
                    d={`M ${segment.start} ${y} H ${segment.end}`}
                  />
                ))}
                {connectorEnd > connectorStart && (
                  <path
                    className="alignment-guides__connector"
                    d={`M ${connectorStart} ${y} H ${connectorEnd}`}
                  />
                )}
              </g>
            );
          }

          const selectedStart = sceneCoordsToViewportCoords(
            { sceneX: guide.position, sceneY: guide.start },
            appState,
          );
          const selectedEnd = sceneCoordsToViewportCoords(
            { sceneX: guide.position, sceneY: guide.end },
            appState,
          );
          const referenceStart = sceneCoordsToViewportCoords(
            { sceneX: guide.position, sceneY: guide.referenceStart },
            appState,
          );
          const referenceEnd = sceneCoordsToViewportCoords(
            { sceneX: guide.position, sceneY: guide.referenceEnd },
            appState,
          );

          const x =
            selectedStart.x -
            containerRect.left +
            (guide.edge === "left" ? -GUIDE_OFFSET : GUIDE_OFFSET);
          const segments = [
            {
              start: selectedStart.y - containerRect.top,
              end: selectedEnd.y - containerRect.top,
            },
            {
              start: referenceStart.y - containerRect.top,
              end: referenceEnd.y - containerRect.top,
            },
          ]
            .map((segment) => ({
              start: Math.min(segment.start, segment.end),
              end: Math.max(segment.start, segment.end),
            }))
            .sort((a, b) => a.start - b.start);

          const connectorStart = segments[0].end + CONNECTOR_GAP;
          const connectorEnd = segments[1].start - CONNECTOR_GAP;

          return (
            <g
              key={`${guide.edge}-${guide.position}-${guide.start}-${guide.referenceStart}-${index}`}
            >
              {segments.map((segment, segmentIndex) => (
                <path
                  key={segmentIndex}
                  className="alignment-guides__cap"
                  d={`M ${x} ${segment.start} V ${segment.end}`}
                />
              ))}
              {connectorEnd > connectorStart && (
                <path
                  className="alignment-guides__connector"
                  d={`M ${x} ${connectorStart} V ${connectorEnd}`}
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
