import type { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  getSequenceLaneId,
  isSequenceLifelineElement,
  isSequenceParticipantElement,
} from "./sequenceStencils";

const ALIGNMENT_THRESHOLD = 6;

type LaneHeaderBounds = {
  key: string;
  leftX: number;
  rightX: number;
  topY: number;
  centerX: number;
};

export type SequenceParticipantAlignmentGuide = {
  y: number;
  leftX: number;
  rightX: number;
  referenceLeftX: number;
  referenceRightX: number;
};

const getLaneKey = (element: Pick<ExcalidrawElement, "groupIds" | "id" | "customData">) => {
  return element.groupIds[0] || getSequenceLaneId(element) || element.id;
};

const getLaneHeaderBounds = (
  elements: readonly ExcalidrawElement[],
  laneKey: string,
): LaneHeaderBounds | null => {
  const laneMembers = elements.filter(
    (element) => getLaneKey(element) === laneKey && !isSequenceLifelineElement(element),
  );

  if (!laneMembers.length) {
    return null;
  }

  let leftX = Infinity;
  let rightX = -Infinity;
  let topY = Infinity;

  for (const element of laneMembers) {
    leftX = Math.min(leftX, element.x);
    rightX = Math.max(rightX, element.x + element.width);
    topY = Math.min(topY, element.y);
  }

  return {
    key: laneKey,
    leftX,
    rightX,
    topY,
    centerX: (leftX + rightX) / 2,
  };
};

export const getSequenceParticipantAlignmentGuides = ({
  elements,
  selectedElementIds,
  zoomValue,
}: {
  elements: readonly ExcalidrawElement[];
  selectedElementIds: Record<string, true> | undefined;
  zoomValue: number;
}) => {
  if (!selectedElementIds || !Object.keys(selectedElementIds).length) {
    return [] as SequenceParticipantAlignmentGuide[];
  }

  const availableElements = elements.filter((element) => !element.isDeleted);
  const laneAnchors = availableElements.filter(
    (element) =>
      isSequenceParticipantElement(element) || isSequenceLifelineElement(element),
  );

  if (!laneAnchors.length) {
    return [] as SequenceParticipantAlignmentGuide[];
  }

  const laneKeys = new Set(laneAnchors.map((element) => getLaneKey(element)));
  const selectedLaneKeys = new Set(
    availableElements
      .filter((element) => selectedElementIds[element.id])
      .map((element) => getLaneKey(element))
      .filter((laneKey) => laneKeys.has(laneKey)),
  );

  if (!selectedLaneKeys.size) {
    return [] as SequenceParticipantAlignmentGuide[];
  }

  const laneHeaders = [...laneKeys]
    .map((laneKey) => getLaneHeaderBounds(availableElements, laneKey))
    .filter((lane): lane is LaneHeaderBounds => Boolean(lane));
  const selectedLanes = laneHeaders.filter((lane) => selectedLaneKeys.has(lane.key));
  const referenceLanes = laneHeaders.filter((lane) => !selectedLaneKeys.has(lane.key));
  const threshold = ALIGNMENT_THRESHOLD / zoomValue;
  const seenPairs = new Set<string>();

  return selectedLanes.flatMap((selectedLane) => {
    return referenceLanes.flatMap((referenceLane) => {
      if (Math.abs(selectedLane.topY - referenceLane.topY) > threshold) {
        return [];
      }

      const pairKey = [selectedLane.key, referenceLane.key].sort().join("::");
      if (seenPairs.has(pairKey)) {
        return [];
      }
      seenPairs.add(pairKey);

      const [leftLane, rightLane] =
        selectedLane.centerX <= referenceLane.centerX
          ? [selectedLane, referenceLane]
          : [referenceLane, selectedLane];

      return [
        {
          y: (selectedLane.topY + referenceLane.topY) / 2,
          leftX: leftLane.leftX,
          rightX: leftLane.rightX,
          referenceLeftX: rightLane.leftX,
          referenceRightX: rightLane.rightX,
        },
      ];
    });
  });
};
