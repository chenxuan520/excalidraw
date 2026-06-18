import type { ExcalidrawElement } from "../packages/excalidraw/element/types";
import { isBoundToContainer } from "../packages/excalidraw/element/typeChecks";
import {
  ALIGNMENT_REFERENCE_GAP,
  type AlignmentGuide,
  type AlignmentGuideEdge,
} from "./alignmentGuideTypes";
import { getSequenceElementMeta } from "./sequence/sequenceStencils";

const ALIGNMENT_THRESHOLD = 6;

type ElementBounds = {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
  centerX: number;
  centerY: number;
};

type GeneralAlignmentContext = {
  selectedBounds: ElementBounds;
  referenceBoundsList: ElementBounds[];
  threshold: number;
  maxReferenceGap: number;
  movableElementIds: Set<string>;
};

const isGeneralAlignmentElement = (element: ExcalidrawElement) => {
  return (
    !element.isDeleted &&
    !getSequenceElementMeta(element) &&
    !isBoundToContainer(element) &&
    element.type === "rectangle" &&
    Math.abs(element.angle) < 0.001
  );
};

const getGeneralAlignmentContext = ({
  elements,
  selectedElementIds,
  zoomValue,
}: {
  elements: readonly ExcalidrawElement[];
  selectedElementIds: Record<string, true> | undefined;
  zoomValue: number;
}) => {
  if (!selectedElementIds || !Object.keys(selectedElementIds).length) {
    return null as GeneralAlignmentContext | null;
  }

  const availableElements = elements.filter((element) => !element.isDeleted);
  const selectedElements = availableElements.filter(
    (element) => selectedElementIds[element.id],
  );

  if (!selectedElements.length) {
    return null as GeneralAlignmentContext | null;
  }

  const selectedAlignableElements = selectedElements.filter(
    isGeneralAlignmentElement,
  );

  if (!selectedAlignableElements.length) {
    return null as GeneralAlignmentContext | null;
  }

  const selectedAlignableIds = new Set(
    selectedAlignableElements.map((element) => element.id),
  );
  const isSupportedSelectedElement = (element: ExcalidrawElement) => {
    return (
      isGeneralAlignmentElement(element) ||
      (isBoundToContainer(element) &&
        !!element.containerId &&
        selectedAlignableIds.has(element.containerId))
    );
  };

  if (!selectedElements.every(isSupportedSelectedElement)) {
    return null as GeneralAlignmentContext | null;
  }

  const referenceBoundsList = availableElements
    .filter(
      (element) =>
        !selectedElementIds[element.id] && isGeneralAlignmentElement(element),
    )
    .map(getElementBounds);

  if (!referenceBoundsList.length) {
    return null as GeneralAlignmentContext | null;
  }

  const movableElementIds = new Set(
    selectedElements.map((element) => element.id),
  );
  for (const element of availableElements) {
    if (
      isBoundToContainer(element) &&
      element.containerId &&
      selectedAlignableIds.has(element.containerId)
    ) {
      movableElementIds.add(element.id);
    }
  }

  return {
    selectedBounds: getElementsBounds(selectedAlignableElements),
    referenceBoundsList,
    threshold: ALIGNMENT_THRESHOLD / zoomValue,
    maxReferenceGap: ALIGNMENT_REFERENCE_GAP / zoomValue,
    movableElementIds,
  } as GeneralAlignmentContext;
};

const getElementBounds = (
  element: Pick<ExcalidrawElement, "x" | "y" | "width" | "height">,
): ElementBounds => {
  const leftX = element.x;
  const topY = element.y;
  const rightX = element.x + element.width;
  const bottomY = element.y + element.height;
  return {
    leftX,
    rightX,
    topY,
    bottomY,
    centerX: (leftX + rightX) / 2,
    centerY: (topY + bottomY) / 2,
  };
};

const getElementsBounds = (
  elements: readonly ExcalidrawElement[],
): ElementBounds => {
  let leftX = Infinity;
  let rightX = -Infinity;
  let topY = Infinity;
  let bottomY = -Infinity;

  for (const element of elements) {
    leftX = Math.min(leftX, element.x);
    rightX = Math.max(rightX, element.x + element.width);
    topY = Math.min(topY, element.y);
    bottomY = Math.max(bottomY, element.y + element.height);
  }

  return {
    leftX,
    rightX,
    topY,
    bottomY,
    centerX: (leftX + rightX) / 2,
    centerY: (topY + bottomY) / 2,
  };
};

const getEdgeDistance = (
  selectedBounds: ElementBounds,
  referenceBounds: ElementBounds,
  edge: AlignmentGuideEdge,
) => {
  if (edge === "top") {
    return Math.abs(selectedBounds.topY - referenceBounds.topY);
  }

  if (edge === "left") {
    return Math.abs(selectedBounds.leftX - referenceBounds.leftX);
  }

  return Math.abs(selectedBounds.rightX - referenceBounds.rightX);
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

const getOrthogonalGap = (
  selectedBounds: ElementBounds,
  referenceBounds: ElementBounds,
  edge: AlignmentGuideEdge,
) => {
  return edge === "top"
    ? getAxisGap(
        selectedBounds.leftX,
        selectedBounds.rightX,
        referenceBounds.leftX,
        referenceBounds.rightX,
      )
    : getAxisGap(
        selectedBounds.topY,
        selectedBounds.bottomY,
        referenceBounds.topY,
        referenceBounds.bottomY,
      );
};

const getSecondaryDistance = (
  selectedBounds: ElementBounds,
  referenceBounds: ElementBounds,
  edge: AlignmentGuideEdge,
) => {
  return edge === "top"
    ? Math.abs(selectedBounds.centerX - referenceBounds.centerX)
    : Math.abs(selectedBounds.centerY - referenceBounds.centerY);
};

const getClosestReferenceBoundsByEdge = (
  selectedBounds: ElementBounds,
  referenceBoundsList: readonly ElementBounds[],
  threshold: number,
  maxReferenceGap: number,
  edge: AlignmentGuideEdge,
) => {
  let closest: ElementBounds | null = null;
  let closestDistance = Infinity;
  let closestSecondaryDistance = Infinity;

  for (const referenceBounds of referenceBoundsList) {
    const edgeDistance = getEdgeDistance(selectedBounds, referenceBounds, edge);
    if (edgeDistance > threshold) {
      continue;
    }

    const orthogonalGap = getOrthogonalGap(
      selectedBounds,
      referenceBounds,
      edge,
    );
    if (orthogonalGap > maxReferenceGap) {
      continue;
    }

    const secondaryDistance = getSecondaryDistance(
      selectedBounds,
      referenceBounds,
      edge,
    );
    if (
      edgeDistance < closestDistance ||
      (edgeDistance === closestDistance &&
        secondaryDistance < closestSecondaryDistance)
    ) {
      closest = referenceBounds;
      closestDistance = edgeDistance;
      closestSecondaryDistance = secondaryDistance;
    }
  }

  return closest;
};

const toGuide = (
  edge: AlignmentGuideEdge,
  selectedBounds: ElementBounds,
  referenceBounds: ElementBounds,
): AlignmentGuide => {
  if (edge === "top") {
    return {
      edge,
      position: referenceBounds.topY,
      start: selectedBounds.leftX,
      end: selectedBounds.rightX,
      referenceStart: referenceBounds.leftX,
      referenceEnd: referenceBounds.rightX,
    };
  }

  return {
    edge,
    position: edge === "left" ? referenceBounds.leftX : referenceBounds.rightX,
    start: selectedBounds.topY,
    end: selectedBounds.bottomY,
    referenceStart: referenceBounds.topY,
    referenceEnd: referenceBounds.bottomY,
  };
};

export const getGeneralElementAlignmentGuides = ({
  elements,
  selectedElementIds,
  zoomValue,
}: {
  elements: readonly ExcalidrawElement[];
  selectedElementIds: Record<string, true> | undefined;
  zoomValue: number;
}) => {
  const context = getGeneralAlignmentContext({
    elements,
    selectedElementIds,
    zoomValue,
  });
  if (!context) {
    return [] as AlignmentGuide[];
  }

  return (["top", "left", "right"] as const)
    .map((edge) => {
      const referenceBounds = getClosestReferenceBoundsByEdge(
        context.selectedBounds,
        context.referenceBoundsList,
        context.threshold,
        context.maxReferenceGap,
        edge,
      );
      return referenceBounds
        ? toGuide(edge, context.selectedBounds, referenceBounds)
        : null;
    })
    .filter((guide): guide is AlignmentGuide => Boolean(guide));
};

export const getGeneralElementAlignmentSnapOffset = ({
  elements,
  selectedElementIds,
  zoomValue,
}: {
  elements: readonly ExcalidrawElement[];
  selectedElementIds: Record<string, true> | undefined;
  zoomValue: number;
}) => {
  const context = getGeneralAlignmentContext({
    elements,
    selectedElementIds,
    zoomValue,
  });
  if (!context) {
    return null;
  }

  const topReference = getClosestReferenceBoundsByEdge(
    context.selectedBounds,
    context.referenceBoundsList,
    context.threshold,
    context.maxReferenceGap,
    "top",
  );
  const leftReference = getClosestReferenceBoundsByEdge(
    context.selectedBounds,
    context.referenceBoundsList,
    context.threshold,
    context.maxReferenceGap,
    "left",
  );
  const rightReference = getClosestReferenceBoundsByEdge(
    context.selectedBounds,
    context.referenceBoundsList,
    context.threshold,
    context.maxReferenceGap,
    "right",
  );

  const offsetY = topReference
    ? topReference.topY - context.selectedBounds.topY
    : 0;

  const leftOffsetX = leftReference
    ? leftReference.leftX - context.selectedBounds.leftX
    : null;
  const rightOffsetX = rightReference
    ? rightReference.rightX - context.selectedBounds.rightX
    : null;

  let offsetX = 0;
  if (typeof leftOffsetX === "number" && typeof rightOffsetX === "number") {
    offsetX =
      Math.abs(leftOffsetX) <= Math.abs(rightOffsetX)
        ? leftOffsetX
        : rightOffsetX;
  } else if (typeof leftOffsetX === "number") {
    offsetX = leftOffsetX;
  } else if (typeof rightOffsetX === "number") {
    offsetX = rightOffsetX;
  }

  if (Math.abs(offsetX) <= 0.5 && Math.abs(offsetY) <= 0.5) {
    return null;
  }

  return {
    offsetX,
    offsetY,
    movableElementIds: context.movableElementIds,
  };
};
