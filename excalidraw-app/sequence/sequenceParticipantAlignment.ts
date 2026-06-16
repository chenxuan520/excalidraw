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

type AlignmentContext = {
  selectedLanes: LaneHeaderBounds[];
  referenceLanes: LaneHeaderBounds[];
  threshold: number;
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

const getAlignmentContext = ({
  elements,
  selectedElementIds,
  zoomValue,
}: {
  elements: readonly ExcalidrawElement[];
  selectedElementIds: Record<string, true> | undefined;
  zoomValue: number;
}): AlignmentContext | null => {
  if (!selectedElementIds || !Object.keys(selectedElementIds).length) {
    return null;
  }

  const availableElements = elements.filter((element) => !element.isDeleted);
  const laneAnchors = availableElements.filter(
    (element) =>
      isSequenceParticipantElement(element) || isSequenceLifelineElement(element),
  );

  if (!laneAnchors.length) {
    return null;
  }

  const laneKeys = new Set(laneAnchors.map((element) => getLaneKey(element)));
  const selectedLaneKeys = new Set(
    availableElements
      .filter((element) => selectedElementIds[element.id])
      .map((element) => getLaneKey(element))
      .filter((laneKey) => laneKeys.has(laneKey)),
  );

  if (!selectedLaneKeys.size) {
    return null;
  }

  const laneHeaders = [...laneKeys]
    .map((laneKey) => getLaneHeaderBounds(availableElements, laneKey))
    .filter((lane): lane is LaneHeaderBounds => Boolean(lane));
  const selectedLanes = laneHeaders.filter((lane) => selectedLaneKeys.has(lane.key));
  const referenceLanes = laneHeaders.filter((lane) => !selectedLaneKeys.has(lane.key));

  if (!selectedLanes.length || !referenceLanes.length) {
    return null;
  }

  return {
    selectedLanes,
    referenceLanes,
    threshold: ALIGNMENT_THRESHOLD / zoomValue,
  };
};

const getClosestReferenceLane = (
  selectedLane: LaneHeaderBounds,
  referenceLanes: readonly LaneHeaderBounds[],
  threshold: number,
) => {
  let closest: LaneHeaderBounds | null = null;
  let closestVerticalDistance = Infinity;
  let closestHorizontalDistance = Infinity;

  for (const referenceLane of referenceLanes) {
    const verticalDistance = Math.abs(selectedLane.topY - referenceLane.topY);
    if (verticalDistance > threshold) {
      continue;
    }

    const horizontalDistance = Math.abs(
      selectedLane.centerX - referenceLane.centerX,
    );
    if (
      verticalDistance < closestVerticalDistance ||
      (verticalDistance === closestVerticalDistance &&
        horizontalDistance < closestHorizontalDistance)
    ) {
      closest = referenceLane;
      closestVerticalDistance = verticalDistance;
      closestHorizontalDistance = horizontalDistance;
    }
  }

  return closest;
};

export const getSequenceParticipantAlignmentSnapTargets = ({
  elements,
  selectedElementIds,
  zoomValue,
}: {
  elements: readonly ExcalidrawElement[];
  selectedElementIds: Record<string, true> | undefined;
  zoomValue: number;
}) => {
  const context = getAlignmentContext({ elements, selectedElementIds, zoomValue });
  if (!context) {
    return new Map<string, number>();
  }

  const snapTargets = new Map<string, number>();

  for (const selectedLane of context.selectedLanes) {
    const referenceLane = getClosestReferenceLane(
      selectedLane,
      context.referenceLanes,
      context.threshold,
    );
    if (!referenceLane) {
      continue;
    }
    snapTargets.set(selectedLane.key, referenceLane.topY);
  }

  return snapTargets;
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
  const context = getAlignmentContext({ elements, selectedElementIds, zoomValue });
  if (!context) {
    return [] as SequenceParticipantAlignmentGuide[];
  }

  const snapTargets = getSequenceParticipantAlignmentSnapTargets({
    elements,
    selectedElementIds,
    zoomValue,
  });
  const seenPairs = new Set<string>();

  return context.selectedLanes.flatMap((selectedLane) => {
    const snapY = snapTargets.get(selectedLane.key);
    if (typeof snapY !== "number") {
      return [];
    }

    return context.referenceLanes.flatMap((referenceLane) => {
      if (Math.abs(referenceLane.topY - snapY) > 0.5) {
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
          y: snapY,
          leftX: leftLane.leftX,
          rightX: leftLane.rightX,
          referenceLeftX: rightLane.leftX,
          referenceRightX: rightLane.rightX,
        },
      ];
    });
  });
};
