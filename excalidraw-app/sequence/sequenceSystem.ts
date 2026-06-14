import { newElementWith } from "../../packages/excalidraw/element/mutateElement";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import {
  getSequenceElementMeta,
  getSequenceLaneId,
  isSequenceActivationElement,
  isSequenceLifelineElement,
  isSequenceParticipantElement,
} from "./sequenceStencils";

const MIN_LIFELINE_HEIGHT = 180;
const ACTIVATION_BOTTOM_PADDING = 28;
const ACTIVATION_BIND_THRESHOLD = 96;

type SequenceLane = {
  key: string;
  laneId: string;
  participant: OrderedExcalidrawElement | null;
  lifeline: OrderedExcalidrawElement | null;
  activations: OrderedExcalidrawElement[];
};

const getElementCenterX = (element: Pick<ExcalidrawElement, "x" | "width">) => {
  return element.x + element.width / 2;
};

const getElementBottomY = (
  element: Pick<ExcalidrawElement, "y" | "height">,
) => {
  return element.y + element.height;
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

const getLaneKeyForElement = (element: OrderedExcalidrawElement) => {
  return element.groupIds[0] || getSequenceLaneId(element) || element.id;
};

const buildSequenceLanes = (elements: readonly OrderedExcalidrawElement[]) => {
  const lanes = new Map<string, SequenceLane>();
  const unboundActivations: OrderedExcalidrawElement[] = [];

  for (const element of elements) {
    if (element.isDeleted) {
      continue;
    }

    if (isSequenceActivationElement(element)) {
      unboundActivations.push(element);
      continue;
    }

    if (
      !isSequenceParticipantElement(element) &&
      !isSequenceLifelineElement(element)
    ) {
      continue;
    }

    const laneKey = getLaneKeyForElement(element);
    const laneId = `sequence-lane-${laneKey}`;

    const lane = lanes.get(laneKey) || {
      key: laneKey,
      laneId,
      participant: null,
      lifeline: null,
      activations: [],
    };

    if (isSequenceParticipantElement(element)) {
      lane.participant = lane.participant || element;
    } else if (isSequenceLifelineElement(element)) {
      lane.lifeline = lane.lifeline || element;
    } else if (isSequenceActivationElement(element)) {
      lane.activations.push(element);
    }

    lanes.set(laneKey, lane);
  }

  return { lanes, unboundActivations };
};

const bindUnboundActivations = (
  lanes: Map<string, SequenceLane>,
  activations: readonly OrderedExcalidrawElement[],
) => {
  const updates = new Map<string, OrderedExcalidrawElement>();

  for (const activation of activations) {
    const activationCenterX = getElementCenterX(activation);
    let targetLane: SequenceLane | null = null;
    let closestDistance = Infinity;

    for (const lane of lanes.values()) {
      if (!lane.participant) {
        continue;
      }
      const distance = Math.abs(
        activationCenterX - getElementCenterX(lane.participant),
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        targetLane = lane;
      }
    }

    if (!targetLane || closestDistance > ACTIVATION_BIND_THRESHOLD) {
      continue;
    }

    const targetCenterX = targetLane.participant
      ? getElementCenterX(targetLane.participant)
      : activationCenterX;

    const nextActivation = newElementWith(activation, {
      x: targetCenterX - activation.width / 2,
      customData: mergeSequenceMeta(activation, {
        laneId: targetLane.laneId,
      }),
    });

    updates.set(nextActivation.id, nextActivation as OrderedExcalidrawElement);
    targetLane.activations.push(nextActivation as OrderedExcalidrawElement);
  }

  return updates;
};

const synchronizeLane = (lane: SequenceLane) => {
  if (!lane.participant || !lane.lifeline) {
    return new Map<string, OrderedExcalidrawElement>();
  }

  const updates = new Map<string, OrderedExcalidrawElement>();
  const targetCenterX = getElementCenterX(lane.participant);
  const participantMeta = getSequenceElementMeta(lane.participant);
  if (participantMeta?.laneId !== lane.laneId) {
    updates.set(
      lane.participant.id,
      newElementWith(lane.participant, {
        customData: mergeSequenceMeta(lane.participant, {
          laneId: lane.laneId,
        }),
      }) as OrderedExcalidrawElement,
    );
  }

  const lifeline = lane.lifeline as OrderedExcalidrawElement &
    ExcalidrawLinearElement;
  const lifelineMeta = getSequenceElementMeta(lifeline);
  const topOffset = lifelineMeta?.topOffset ?? lifeline.y - lane.participant.y;
  const targetY = lane.participant.y + topOffset;

  let targetBottom = targetY + Math.max(MIN_LIFELINE_HEIGHT, lifeline.height);

  for (const activation of lane.activations) {
    targetBottom = Math.max(
      targetBottom,
      getElementBottomY(activation) + ACTIVATION_BOTTOM_PADDING,
    );

    const targetX = targetCenterX - activation.width / 2;
    if (
      Math.abs(targetX - activation.x) > 0.5 ||
      getSequenceLaneId(activation) !== lane.laneId
    ) {
      updates.set(
        activation.id,
        newElementWith(activation, {
          x: targetX,
          customData: mergeSequenceMeta(activation, {
            laneId: lane.laneId,
          }),
        }) as OrderedExcalidrawElement,
      );
    }
  }

  const targetHeight = Math.max(MIN_LIFELINE_HEIGHT, targetBottom - targetY);
  const currentPoints = lifeline.points;
  const nextPoints: ExcalidrawLinearElement["points"] = [
    [0, 0],
    [0, targetHeight],
  ];
  const shouldRefreshLifelineMeta =
    lifelineMeta?.laneId !== lane.laneId ||
    lifelineMeta?.topOffset !== topOffset;

  if (
    shouldRefreshLifelineMeta ||
    Math.abs(lifeline.x - targetCenterX) > 0.5 ||
    Math.abs(lifeline.y - targetY) > 0.5 ||
    Math.abs(lifeline.height - targetHeight) > 0.5 ||
    currentPoints.length !== 2 ||
    currentPoints[1][1] !== targetHeight
  ) {
    updates.set(
      lifeline.id,
      newElementWith(lifeline, {
        x: targetCenterX,
        y: targetY,
        width: 1,
        height: targetHeight,
        points: nextPoints,
        customData: mergeSequenceMeta(lifeline, {
          laneId: lane.laneId,
          topOffset,
        }),
      }) as OrderedExcalidrawElement,
    );
  }

  return updates;
};

export const synchronizeSequenceDiagramElements = (
  elements: readonly OrderedExcalidrawElement[],
) => {
  const { lanes, unboundActivations } = buildSequenceLanes(elements);
  const updates = bindUnboundActivations(lanes, unboundActivations);

  for (const lane of lanes.values()) {
    const laneUpdates = synchronizeLane(lane);
    laneUpdates.forEach((value, key) => updates.set(key, value));
  }

  if (!updates.size) {
    return { changed: false as const, elements };
  }

  return {
    changed: true as const,
    elements: elements.map((element) => updates.get(element.id) || element),
  };
};
