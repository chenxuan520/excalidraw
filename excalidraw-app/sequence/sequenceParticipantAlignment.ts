import type { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  ALIGNMENT_REFERENCE_GAP,
  type AlignmentGuide,
  type AlignmentGuideEdge,
} from "../alignmentGuideTypes";
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
  bottomY: number;
  centerX: number;
  centerY: number;
};

export type SequenceParticipantAlignmentGuide = AlignmentGuide;

type AlignmentContext = {
  selectedLanes: LaneHeaderBounds[];
  referenceLanes: LaneHeaderBounds[];
  threshold: number;
  maxReferenceGap: number;
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
  let bottomY = -Infinity;

  for (const element of laneMembers) {
    leftX = Math.min(leftX, element.x);
    rightX = Math.max(rightX, element.x + element.width);
    topY = Math.min(topY, element.y);
    bottomY = Math.max(bottomY, element.y + element.height);
  }

  return {
    key: laneKey,
    leftX,
    rightX,
    topY,
    bottomY,
    centerX: (leftX + rightX) / 2,
    centerY: (topY + bottomY) / 2,
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
    maxReferenceGap: ALIGNMENT_REFERENCE_GAP / zoomValue,
  };
};

const getAxisGap = (
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) => {
  if (endA < startB) {
    return startB - endA;
  }
  if (endB < startA) {
    return startA - endB;
  }
  return 0;
};

const getClosestReferenceLaneByEdge = (
  selectedLane: LaneHeaderBounds,
  referenceLanes: readonly LaneHeaderBounds[],
  threshold: number,
  maxReferenceGap: number,
  edge: AlignmentGuideEdge,
) => {
  let closest: LaneHeaderBounds | null = null;
  let closestEdgeDistance = Infinity;
  let closestSecondaryDistance = Infinity;

  for (const referenceLane of referenceLanes) {
    const edgeDistance =
      edge === "top"
        ? Math.abs(selectedLane.topY - referenceLane.topY)
        : edge === "left"
          ? Math.abs(selectedLane.leftX - referenceLane.leftX)
          : Math.abs(selectedLane.rightX - referenceLane.rightX);
    if (edgeDistance > threshold) {
      continue;
    }

    const orthogonalGap =
      edge === "top"
        ? getAxisGap(
            selectedLane.leftX,
            selectedLane.rightX,
            referenceLane.leftX,
            referenceLane.rightX,
          )
        : getAxisGap(
            selectedLane.topY,
            selectedLane.bottomY,
            referenceLane.topY,
            referenceLane.bottomY,
          );
    if (orthogonalGap > maxReferenceGap) {
      continue;
    }

    const secondaryDistance = Math.abs(
      edge === "top"
        ? selectedLane.centerX - referenceLane.centerX
        : selectedLane.centerY - referenceLane.centerY,
    );
    if (
      edgeDistance < closestEdgeDistance ||
      (edgeDistance === closestEdgeDistance &&
        secondaryDistance < closestSecondaryDistance)
    ) {
      closest = referenceLane;
      closestEdgeDistance = edgeDistance;
      closestSecondaryDistance = secondaryDistance;
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
    const referenceLane = getClosestReferenceLaneByEdge(
      selectedLane,
      context.referenceLanes,
      context.threshold,
      context.maxReferenceGap,
      "top",
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

  const seenPairs = new Set<string>();
  const guides: SequenceParticipantAlignmentGuide[] = [];

  for (const selectedLane of context.selectedLanes) {
    for (const edge of ["top", "left", "right"] as const) {
      const referenceLane = getClosestReferenceLaneByEdge(
        selectedLane,
        context.referenceLanes,
        context.threshold,
        context.maxReferenceGap,
        edge,
      );
      if (!referenceLane) {
        continue;
      }

      const pairKey = `${edge}::${[selectedLane.key, referenceLane.key]
        .sort()
        .join("::")}`;
      if (seenPairs.has(pairKey)) {
        continue;
      }
      seenPairs.add(pairKey);

      if (edge === "top") {
        guides.push({
          edge,
          position: referenceLane.topY,
          start: selectedLane.leftX,
          end: selectedLane.rightX,
          referenceStart: referenceLane.leftX,
          referenceEnd: referenceLane.rightX,
        });
        continue;
      }

      guides.push({
        edge,
        position: edge === "left" ? referenceLane.leftX : referenceLane.rightX,
        start: selectedLane.topY,
        end: selectedLane.bottomY,
        referenceStart: referenceLane.topY,
        referenceEnd: referenceLane.bottomY,
      });
    }
  }

  return guides;
};
