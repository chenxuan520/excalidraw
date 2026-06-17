import { newElementWith } from "../../packages/excalidraw/element/mutateElement";
import { newTextElement } from "../../packages/excalidraw/element/newElement";
import {
  getBoundTextElement,
  measureTextElement,
} from "../../packages/excalidraw/element/textElement";
import { syncInvalidIndices } from "../../packages/excalidraw/fractionalIndex";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import {
  getSequenceElementMeta,
  getSequenceFragmentMeta,
  getSequenceLaneId,
  getSequenceMessageActivationIds,
  getSequenceMessageLaneIds,
  getSequenceFragmentHeaderWidth,
  measureSequenceText,
  isSequenceActivationElement,
  isSequenceFragmentElement,
  isSequenceLifelineElement,
  isSequenceMessageElement,
  isSequenceNoteElement,
  isSequenceParticipantElement,
  SEQUENCE_FRAGMENT_HEADER_HEIGHT,
  SEQUENCE_ACCENT_FILL,
  SEQUENCE_FRAGMENT_CONDITION_TEXT,
  SEQUENCE_FRAGMENT_ELSE_TEXT,
  SEQUENCE_PARTICIPANT_HEIGHT,
  SEQUENCE_SELF_CALL_HEIGHT,
  SEQUENCE_TEXT_FONT_FAMILY,
  SEQUENCE_TEXT_FONT_SIZE,
  SEQUENCE_TEXT_LINE_HEIGHT,
} from "./sequenceStencils";

const MIN_LIFELINE_HEIGHT = 180;
const ACTIVATION_BOTTOM_PADDING = 28;
const ACTIVATION_BIND_THRESHOLD = 96;
const NOTE_BIND_THRESHOLD = 160;
const DEFAULT_NOTE_OFFSET_X = 28;

type SequenceLane = {
  key: string;
  laneId: string;
  participant: OrderedExcalidrawElement | null;
  lifeline: OrderedExcalidrawElement | null;
  activations: OrderedExcalidrawElement[];
  members: OrderedExcalidrawElement[];
};

type SelectedElementIds = Record<string, true> | undefined;

type SequenceSyncOptions = {
  resizeHandleType?: string | boolean | null;
  originalElements?: Map<string, ExcalidrawElement> | null;
  alignmentSnapTopYByLaneKey?: Map<string, number>;
};

type SequenceMessage = OrderedExcalidrawElement & ExcalidrawLinearElement;

type SequenceFragment = {
  key: string;
  variant: string;
  outline: OrderedExcalidrawElement | null;
  header: OrderedExcalidrawElement | null;
  label: (OrderedExcalidrawElement & ExcalidrawTextElement) | null;
  conditionLabel: (OrderedExcalidrawElement & ExcalidrawTextElement) | null;
  elseLabel: (OrderedExcalidrawElement & ExcalidrawTextElement) | null;
  divider: (OrderedExcalidrawElement & ExcalidrawLinearElement) | null;
  dividerOffsetY?: number;
  fromLaneId?: string;
  toLaneId?: string;
};

const SEQUENCE_FRAGMENT_SECTION_PADDING_X = 8;
const SEQUENCE_FRAGMENT_SECTION_PADDING_Y = 10;

const getElementCenterX = (element: Pick<ExcalidrawElement, "x" | "width">) => {
  return element.x + element.width / 2;
};

const getElementBottomY = (
  element: Pick<ExcalidrawElement, "y" | "height">,
) => {
  return element.y + element.height;
};

const getLaneCenterX = (lane: SequenceLane) => {
  return lane.participant
    ? getElementCenterX(lane.participant)
    : lane.lifeline
    ? getElementCenterX(lane.lifeline)
    : 0;
};

const isMqParticipantLane = (lane: SequenceLane) => {
  if (!lane.participant || lane.participant.type !== "rectangle") {
    return false;
  }

  if (getSequenceElementMeta(lane.participant)?.variant === "mq") {
    return true;
  }

  const ellipses = lane.members.filter(
    (member): member is OrderedExcalidrawElement => member.type === "ellipse",
  );

  return (
    ellipses.length === 2 &&
    ellipses.every(
      (ellipse) =>
        Math.abs(ellipse.y - lane.participant!.y) <= 0.5 &&
        Math.abs(ellipse.height - lane.participant!.height) <= 0.5 &&
        ellipse.width < lane.participant!.width &&
        ellipse.width <= lane.participant!.width / 2,
    )
  );
};

const getMqStandaloneLabel = (lane: SequenceLane) => {
  if (!isMqParticipantLane(lane)) {
    return null;
  }

  return (
    lane.members.find(
      (
        member,
      ): member is OrderedExcalidrawElement & ExcalidrawTextElement =>
        member.type === "text" && !member.containerId,
    ) || null
  );
};

const getSequenceParticipantLabel = (
  lane: SequenceLane,
  elementsMap: Map<string, OrderedExcalidrawElement>,
) => {
  if (!lane.participant) {
    return null;
  }

  const boundLabel = getBoundTextElement(
    lane.participant,
    elementsMap,
  ) as (OrderedExcalidrawElement & ExcalidrawTextElement) | null;

  if (isMqParticipantLane(lane)) {
    return getMqStandaloneLabel(lane) || boundLabel;
  }

  return boundLabel || getMqStandaloneLabel(lane);
};

const getLaneAnchorCenterX = (
  lane: SequenceLane,
  selectedElementIds: SelectedElementIds,
) => {
  const participantSelected = !!(
    lane.participant && selectedElementIds?.[lane.participant.id]
  );
  const lifelineSelected = !!(
    lane.lifeline && selectedElementIds?.[lane.lifeline.id]
  );

  if (lifelineSelected && !participantSelected && lane.lifeline) {
    return getElementCenterX(lane.lifeline);
  }

  if (lane.participant) {
    return getElementCenterX(lane.participant);
  }

  return lane.lifeline ? getElementCenterX(lane.lifeline) : 0;
};

const getLanePreviousCenterX = (
  lane: SequenceLane,
  selectedElementIds: SelectedElementIds,
) => {
  const participantSelected = !!(
    lane.participant && selectedElementIds?.[lane.participant.id]
  );
  const lifelineSelected = !!(
    lane.lifeline && selectedElementIds?.[lane.lifeline.id]
  );

  if (participantSelected && !lifelineSelected && lane.lifeline) {
    return lane.lifeline.x;
  }

  if (lifelineSelected && !participantSelected && lane.participant) {
    return getElementCenterX(lane.participant);
  }

  return getLaneCenterX(lane);
};

const getLaneHeaderTopY = (lane: SequenceLane) => {
  let topY = Infinity;

  for (const member of lane.members) {
    if (member.id === lane.lifeline?.id) {
      continue;
    }
    topY = Math.min(topY, member.y);
  }

  if (Number.isFinite(topY)) {
    return topY;
  }

  return lane.participant?.y ?? lane.lifeline?.y ?? 0;
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
  const activations: OrderedExcalidrawElement[] = [];
  const messages: SequenceMessage[] = [];
  const fragments = new Map<string, SequenceFragment>();
  const notes: OrderedExcalidrawElement[] = [];

  for (const element of elements) {
    if (element.isDeleted) {
      continue;
    }

    if (isSequenceActivationElement(element)) {
      activations.push(element);
      continue;
    }

    if (isSequenceMessageElement(element)) {
      messages.push(element as SequenceMessage);
      continue;
    }

    if (isSequenceFragmentElement(element)) {
      const fragmentElement = element as OrderedExcalidrawElement;
      const fragmentKey = fragmentElement.groupIds[0] || fragmentElement.id;
      const fragmentMeta = getSequenceFragmentMeta(fragmentElement);
      const fragment = fragments.get(fragmentKey) || {
        key: fragmentKey,
        variant: fragmentMeta?.variant || "loop",
        outline: null,
        header: null,
        label: null,
        conditionLabel: null,
        elseLabel: null,
        divider: null,
        dividerOffsetY: fragmentMeta?.offsetY,
        fromLaneId: fragmentMeta?.fromLaneId,
        toLaneId: fragmentMeta?.toLaneId,
      };

      fragment.variant = fragmentMeta?.variant || fragment.variant;
      fragment.fromLaneId = fragmentMeta?.fromLaneId || fragment.fromLaneId;
      fragment.toLaneId = fragmentMeta?.toLaneId || fragment.toLaneId;

      if (fragmentMeta?.part === "header") {
        fragment.header = fragmentElement;
      } else if (fragmentMeta?.part === "label") {
        fragment.label = fragmentElement as SequenceFragment["label"];
      } else if (fragmentMeta?.part === "condition") {
        fragment.conditionLabel =
          fragmentElement as SequenceFragment["conditionLabel"];
      } else if (fragmentMeta?.part === "else") {
        fragment.elseLabel = fragmentElement as SequenceFragment["elseLabel"];
      } else if (fragmentMeta?.part === "divider") {
        fragment.divider = fragmentElement as SequenceFragment["divider"];
        fragment.dividerOffsetY =
          typeof fragmentMeta?.offsetY === "number"
            ? fragmentMeta.offsetY
            : fragment.dividerOffsetY;
      } else {
        fragment.outline = fragmentElement;
      }

      fragments.set(fragmentKey, fragment);
      continue;
    }

    if (isSequenceNoteElement(element)) {
      notes.push(element);
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
      members: [],
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

  for (const element of elements) {
    if (element.isDeleted) {
      continue;
    }

    const laneKey = element.groupIds[0];
    if (!laneKey) {
      continue;
    }

    const lane = lanes.get(laneKey);
    if (!lane) {
      continue;
    }

    lane.members.push(element);
  }

  return { lanes, activations, messages, fragments, notes };
};

const getClosestLane = (
  lanes: readonly SequenceLane[],
  x: number,
  preferredLaneId?: string,
) => {
  if (preferredLaneId) {
    const preferred = lanes.find((lane) => lane.laneId === preferredLaneId);
    if (preferred) {
      return preferred;
    }
  }

  let closest: SequenceLane | null = null;
  let closestDistance = Infinity;
  for (const lane of lanes) {
    const distance = Math.abs(x - getLaneCenterX(lane));
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = lane;
    }
  }
  return closest;
};

const synchronizeMessages = (
  lanes: Map<string, SequenceLane>,
  messages: readonly SequenceMessage[],
  selectedElementIds: SelectedElementIds,
) => {
  const updates = new Map<string, OrderedExcalidrawElement>();
  const laneList = [...lanes.values()].filter(
    (lane) => lane.participant || lane.lifeline,
  );
  const activationMap = new Map(
    laneList
      .flatMap((lane) => lane.activations)
      .map((activation) => [activation.id, activation] as const),
  );

  for (const message of messages) {
    if (!laneList.length || message.points.length < 2) {
      continue;
    }

    const meta = getSequenceElementMeta(message);
    const { fromLaneId, toLaneId } = getSequenceMessageLaneIds(message);
    const { fromActivationId, toActivationId } =
      getSequenceMessageActivationIds(message);
    const selected = !!selectedElementIds?.[message.id];
    const hasLaneContext = Boolean(fromLaneId || toLaneId);
    const startPoint = message.points[0];
    const endPoint = message.points[message.points.length - 1];
    const startX = message.x + startPoint[0];
    const endX = message.x + endPoint[0];
    const baseY = message.y + startPoint[1];
    const variant =
      meta?.variant || (message.points.length > 2 ? "self" : "message");

    const fromLane = getClosestLane(
      laneList,
      startX,
      selected ? undefined : fromLaneId,
    );
    let toLane =
      variant === "self"
        ? fromLane
        : getClosestLane(laneList, endX, selected ? undefined : toLaneId);

    let resolvedFromLane = fromLane;

    if (
      variant === "return" &&
      !selected &&
      !hasLaneContext &&
      laneList.length > 1
    ) {
      const leftLane = getClosestLane(laneList, Math.min(startX, endX));
      let rightLane = getClosestLane(laneList, Math.max(startX, endX));

      if (leftLane && rightLane && leftLane.laneId === rightLane.laneId) {
        rightLane =
          laneList.find(
            (lane) =>
              getLaneCenterX(lane) > getLaneCenterX(leftLane) &&
              lane.laneId !== leftLane.laneId,
          ) ||
          laneList.find((lane) => lane.laneId !== leftLane.laneId) ||
          rightLane;
      }

      if (leftLane && rightLane && leftLane.laneId !== rightLane.laneId) {
        resolvedFromLane = rightLane;
        toLane = leftLane;
      }
    }

    if (!resolvedFromLane || !toLane) {
      continue;
    }

    const laneFromX = getLaneAnchorCenterX(
      resolvedFromLane,
      selectedElementIds,
    );
    const laneToX = getLaneAnchorCenterX(toLane, selectedElementIds);
    const isForward = laneFromX <= laneToX;
    const fromActivation = fromActivationId
      ? activationMap.get(fromActivationId)
      : undefined;
    const toActivation = toActivationId
      ? activationMap.get(toActivationId)
      : undefined;
    const canUseFromActivation =
      fromActivation &&
      getSequenceLaneId(fromActivation) === resolvedFromLane.laneId &&
      variant !== "self";
    const canUseToActivation =
      toActivation &&
      getSequenceLaneId(toActivation) === toLane.laneId &&
      variant !== "self";
    const fromX = canUseFromActivation
      ? isForward
        ? fromActivation.x + fromActivation.width
        : fromActivation.x
      : laneFromX;
    const toX = canUseToActivation
      ? isForward
        ? toActivation.x
        : toActivation.x + toActivation.width
      : laneToX;

    if (variant === "self") {
      const selfSourceActivation =
        fromActivation &&
        getSequenceLaneId(fromActivation) === resolvedFromLane.laneId
          ? fromActivation
          : undefined;
      const selfFromX = selfSourceActivation
        ? selfSourceActivation.x + selfSourceActivation.width
        : laneFromX;
      const rawStartY = baseY;
      const rawEndY = message.y + endPoint[1];
      const resolvedEndY =
        rawEndY === rawStartY ? rawStartY + SEQUENCE_SELF_CALL_HEIGHT : rawEndY;
      const topY = Math.min(rawStartY, resolvedEndY);
      const startOffsetY = rawStartY - topY;
      const endOffsetY = resolvedEndY - topY;
      const loopRightDelta = Math.max(
        56,
        message.points[1]?.[0] || message.points[2]?.[0] || 88,
      );
      const nextPoints: ExcalidrawLinearElement["points"] = [
        [0, startOffsetY],
        [loopRightDelta, startOffsetY],
        [loopRightDelta, endOffsetY],
        [0, endOffsetY],
      ];
      const needsUpdate =
        Math.abs(message.x - selfFromX) > 0.5 ||
        Math.abs(message.y - topY) > 0.5 ||
        message.points.length !== nextPoints.length ||
        message.points[1][0] !== loopRightDelta ||
        message.points[0][1] !== startOffsetY ||
        message.points[2][1] !== endOffsetY ||
        message.points[3]?.[0] !== 0 ||
        message.points[3]?.[1] !== endOffsetY ||
        fromLaneId !== resolvedFromLane.laneId ||
        toLaneId !== resolvedFromLane.laneId ||
        fromActivationId !== selfSourceActivation?.id ||
        toActivationId !== undefined;

      if (needsUpdate) {
        updates.set(
          message.id,
          newElementWith(message, {
            x: selfFromX,
            y: topY,
            width: loopRightDelta,
            height: Math.abs(resolvedEndY - rawStartY),
            points: nextPoints,
            customData: mergeSequenceMeta(message, {
              variant: "self",
              fromLaneId: resolvedFromLane.laneId,
              toLaneId: resolvedFromLane.laneId,
              fromActivationId: selfSourceActivation?.id,
              toActivationId: undefined,
            }),
          }) as OrderedExcalidrawElement,
        );
      }
      continue;
    }

    const deltaX = toX - fromX;
    const nextPoints: ExcalidrawLinearElement["points"] = [
      [0, 0],
      [deltaX, 0],
    ];
      const needsUpdate =
        Math.abs(message.x - fromX) > 0.5 ||
        Math.abs(message.y - baseY) > 0.5 ||
        message.points.length !== 2 ||
        message.points[1][0] !== deltaX ||
        message.points[1][1] !== 0 ||
        fromLaneId !== resolvedFromLane.laneId ||
        toLaneId !== toLane.laneId ||
        fromActivationId !==
          (canUseFromActivation ? fromActivation.id : undefined) ||
        toActivationId !== (canUseToActivation ? toActivation.id : undefined) ||
        meta?.variant !== variant;

    if (needsUpdate) {
      updates.set(
        message.id,
        newElementWith(message, {
          x: fromX,
          y: baseY,
          width: Math.abs(deltaX),
          height: 1,
          points: nextPoints,
          customData: mergeSequenceMeta(message, {
            variant,
            fromLaneId: resolvedFromLane.laneId,
            toLaneId: toLane.laneId,
            fromActivationId: canUseFromActivation
              ? fromActivation.id
              : undefined,
            toActivationId: canUseToActivation ? toActivation.id : undefined,
          }),
        }) as OrderedExcalidrawElement,
      );
    }
  }

  return updates;
};

const createFragmentSectionLabel = ({
  fragment,
  text,
  x,
  y,
  part,
  strokeColor,
  fromLaneId,
  toLaneId,
}: {
  fragment: SequenceFragment;
  text: string;
  x: number;
  y: number;
  part: "condition" | "else";
  strokeColor: string;
  fromLaneId: string;
  toLaneId: string;
}) => {
  return newTextElement({
    x,
    y,
    text,
    originalText: text,
    fontFamily: SEQUENCE_TEXT_FONT_FAMILY,
    fontSize: SEQUENCE_TEXT_FONT_SIZE,
    lineHeight: SEQUENCE_TEXT_LINE_HEIGHT,
    autoResize: true,
    containerId: null,
    strokeColor,
    groupIds: fragment.header?.groupIds || fragment.outline?.groupIds || [],
    customData: {
      sequenceDiagram: {
        role: "fragment",
        variant: fragment.variant,
        part,
        fromLaneId,
        toLaneId,
      },
    },
  }) as OrderedExcalidrawElement;
};

const getTextMetrics = (
  element: ExcalidrawTextElement | null | undefined,
  text: string,
) => {
  return element ? measureTextElement(element, { text }) : measureSequenceText(text);
};

const getFragmentTextStyleSource = (
  element: (OrderedExcalidrawElement & ExcalidrawTextElement) | null | undefined,
  selected: boolean,
  options?: SequenceSyncOptions,
) => {
  if (!element) {
    return null;
  }

  if (!selected || !options?.resizeHandleType) {
    return element;
  }

  const original = options.originalElements?.get(element.id);
  return original?.type === "text" ? (original as ExcalidrawTextElement) : element;
};

const synchronizeFragments = (
  lanes: Map<string, SequenceLane>,
  fragments: Map<string, SequenceFragment>,
  selectedElementIds: SelectedElementIds,
  elementsMap: Map<string, OrderedExcalidrawElement>,
  options?: SequenceSyncOptions,
) => {
  const updates = new Map<string, OrderedExcalidrawElement>();
  const inserted: OrderedExcalidrawElement[] = [];
  const laneList = [...lanes.values()].filter(
    (lane) => lane.participant || lane.lifeline,
  );

  for (const fragment of fragments.values()) {
    if (!fragment.outline || !fragment.header || !laneList.length) {
      continue;
    }

    const selected = !!(
      selectedElementIds?.[fragment.outline.id] ||
      selectedElementIds?.[fragment.header.id] ||
      (fragment.label && selectedElementIds?.[fragment.label.id]) ||
      (fragment.conditionLabel && selectedElementIds?.[fragment.conditionLabel.id]) ||
      (fragment.elseLabel && selectedElementIds?.[fragment.elseLabel.id]) ||
      (fragment.divider && selectedElementIds?.[fragment.divider.id])
    );
    const left = fragment.outline.x;
    const right = fragment.outline.x + fragment.outline.width;
    const fromLane = getClosestLane(
      laneList,
      left,
      selected ? undefined : fragment.fromLaneId,
    );
    const toLane = getClosestLane(
      laneList,
      right,
      selected ? undefined : fragment.toLaneId,
    );

    if (!fromLane || !toLane) {
      continue;
    }

    const fromX = getLaneAnchorCenterX(fromLane, selectedElementIds);
    const toX = getLaneAnchorCenterX(toLane, selectedElementIds);
    const isHorizontalResize =
      selected &&
      typeof options?.resizeHandleType === "string" &&
      (options.resizeHandleType.includes("w") ||
        options.resizeHandleType.includes("e"));
    const frameLeft = fragment.outline.x;
    const frameWidth = fragment.outline.width;
    const headerVariant = fragment.variant === "alt" ? "alt" : "loop";
    const boundHeaderLabel = getBoundTextElement(fragment.header, elementsMap) as
      | (OrderedExcalidrawElement & ExcalidrawTextElement)
      | null;
    const headerLabel = fragment.label || boundHeaderLabel;
    const labelText = headerLabel?.originalText || headerLabel?.text;
    const headerLabelStyleSource = getFragmentTextStyleSource(
      headerLabel,
      selected,
      options,
    );
    const headerTextMetrics = labelText
      ? getTextMetrics(headerLabelStyleSource, labelText)
      : null;
    const headerWidth = getSequenceFragmentHeaderWidth(
      headerVariant,
      headerTextMetrics?.width,
    );
    const nextHeaderBoundElements = fragment.header.boundElements?.filter(
      (boundElement) => boundElement.type !== "text",
    );
    const nextHeader = newElementWith(fragment.header, {
      x: frameLeft,
      y: fragment.outline.y,
      width: headerWidth,
      height: SEQUENCE_FRAGMENT_HEADER_HEIGHT,
      boundElements:
        nextHeaderBoundElements && nextHeaderBoundElements.length
          ? nextHeaderBoundElements
          : [],
      customData: mergeSequenceMeta(fragment.header, {
        variant: fragment.variant,
        part: "header",
        fromLaneId: fromLane.laneId,
        toLaneId: toLane.laneId,
      }),
    }) as OrderedExcalidrawElement;

    if (
      Math.abs(fragment.outline.x - frameLeft) > 0.5 ||
      Math.abs(fragment.outline.width - frameWidth) > 0.5 ||
      fragment.fromLaneId !== fromLane.laneId ||
      fragment.toLaneId !== toLane.laneId
    ) {
      updates.set(
        fragment.outline.id,
        newElementWith(fragment.outline, {
          x: frameLeft,
          width: frameWidth,
          customData: mergeSequenceMeta(fragment.outline, {
            variant: fragment.variant,
            part: "outline",
            fromLaneId: fromLane.laneId,
            toLaneId: toLane.laneId,
          }),
        }) as OrderedExcalidrawElement,
      );
    }

    if (
      Math.abs(fragment.header.x - frameLeft) > 0.5 ||
      Math.abs(fragment.header.y - fragment.outline.y) > 0.5 ||
      Math.abs(fragment.header.width - headerWidth) > 0.5 ||
      Math.abs(
        fragment.header.height - SEQUENCE_FRAGMENT_HEADER_HEIGHT,
      ) > 0.5 ||
      (fragment.header.boundElements?.some(
        (boundElement) => boundElement.type === "text",
      ) ?? false) ||
      fragment.fromLaneId !== fromLane.laneId ||
      fragment.toLaneId !== toLane.laneId
    ) {
      updates.set(fragment.header.id, nextHeader);
    }

    if (headerLabel && headerTextMetrics && labelText) {
      const nextLabelX =
        frameLeft + Math.max((headerWidth - headerTextMetrics.width) / 2, 0);
      const nextLabelY =
        fragment.outline.y +
        Math.max(
          (SEQUENCE_FRAGMENT_HEADER_HEIGHT - headerTextMetrics.height) / 2,
          0,
        );
      const nextLabel = newElementWith(headerLabel, {
        text: labelText,
        originalText: labelText,
        x: nextLabelX,
        y: nextLabelY,
        width: headerTextMetrics.width,
        height: headerTextMetrics.height,
        fontFamily: headerLabelStyleSource?.fontFamily,
        fontSize: headerLabelStyleSource?.fontSize,
        lineHeight: headerLabelStyleSource?.lineHeight,
        strokeColor: headerLabelStyleSource?.strokeColor,
        autoResize: true,
        containerId: null,
        groupIds: fragment.header.groupIds,
        customData: {
          ...headerLabel.customData,
          sequenceDiagram: {
            role: "fragment",
            variant: fragment.variant,
            part: "label",
            fromLaneId: fromLane.laneId,
            toLaneId: toLane.laneId,
          },
        },
      }) as OrderedExcalidrawElement;

      if (
        headerLabel.containerId !== null ||
        headerLabel.text !== labelText ||
        headerLabel.originalText !== labelText ||
        Math.abs(headerLabel.width - headerTextMetrics.width) > 0.5 ||
        Math.abs(headerLabel.height - headerTextMetrics.height) > 0.5 ||
        Math.abs(headerLabel.x - nextLabelX) > 0.5 ||
        Math.abs(headerLabel.y - nextLabelY) > 0.5 ||
        getSequenceElementMeta(headerLabel)?.part !== "label" ||
        getSequenceElementMeta(headerLabel)?.fromLaneId !== fromLane.laneId ||
        getSequenceElementMeta(headerLabel)?.toLaneId !== toLane.laneId
      ) {
        updates.set(headerLabel.id, nextLabel);
      }
    }

    const sectionTextColor = headerLabel?.strokeColor || "#1f2328";
    const conditionLabel = fragment.conditionLabel;
    const conditionText =
      conditionLabel?.originalText ||
      conditionLabel?.text ||
      SEQUENCE_FRAGMENT_CONDITION_TEXT;
    const conditionLabelStyleSource = getFragmentTextStyleSource(
      conditionLabel,
      selected,
      options,
    );
    const conditionTextMetrics = getTextMetrics(
      conditionLabelStyleSource,
      conditionText,
    );
    const nextConditionX = frameLeft + SEQUENCE_FRAGMENT_SECTION_PADDING_X;
    const nextConditionY =
      fragment.outline.y +
      SEQUENCE_FRAGMENT_HEADER_HEIGHT +
      SEQUENCE_FRAGMENT_SECTION_PADDING_Y;

    if (conditionLabel) {
      const nextConditionLabel = newElementWith(conditionLabel, {
        text: conditionText,
        originalText: conditionText,
        x: nextConditionX,
        y: nextConditionY,
        width: conditionTextMetrics.width,
        height: conditionTextMetrics.height,
        fontFamily: conditionLabelStyleSource?.fontFamily,
        fontSize: conditionLabelStyleSource?.fontSize,
        lineHeight: conditionLabelStyleSource?.lineHeight,
        strokeColor: conditionLabelStyleSource?.strokeColor,
        autoResize: true,
        containerId: null,
        groupIds: fragment.header.groupIds,
        customData: {
          ...conditionLabel.customData,
          sequenceDiagram: {
            role: "fragment",
            variant: fragment.variant,
            part: "condition",
            fromLaneId: fromLane.laneId,
            toLaneId: toLane.laneId,
          },
        },
      }) as OrderedExcalidrawElement;

      if (
        conditionLabel.containerId !== null ||
        conditionLabel.text !== conditionText ||
        conditionLabel.originalText !== conditionText ||
        Math.abs(conditionLabel.width - conditionTextMetrics.width) > 0.5 ||
        Math.abs(conditionLabel.height - conditionTextMetrics.height) > 0.5 ||
        Math.abs(conditionLabel.x - nextConditionX) > 0.5 ||
        Math.abs(conditionLabel.y - nextConditionY) > 0.5 ||
        getSequenceElementMeta(conditionLabel)?.part !== "condition" ||
        getSequenceElementMeta(conditionLabel)?.fromLaneId !== fromLane.laneId ||
        getSequenceElementMeta(conditionLabel)?.toLaneId !== toLane.laneId
      ) {
        updates.set(conditionLabel.id, nextConditionLabel);
      }
    } else {
      inserted.push(
        createFragmentSectionLabel({
          fragment,
          text: conditionText,
          x: nextConditionX,
          y: nextConditionY,
          part: "condition",
          strokeColor: sectionTextColor,
          fromLaneId: fromLane.laneId,
          toLaneId: toLane.laneId,
        }),
      );
    }

    if (fragment.variant === "alt" && fragment.divider) {
      const dividerMinOffsetY = SEQUENCE_FRAGMENT_HEADER_HEIGHT + 18;
      const dividerMaxOffsetY = Math.max(
        fragment.outline.height - 24,
        dividerMinOffsetY,
      );
      const rawDividerOffsetY = selectedElementIds?.[fragment.divider.id]
        ? fragment.divider.y - fragment.outline.y
        : typeof fragment.dividerOffsetY === "number"
        ? fragment.dividerOffsetY
        : fragment.divider.y - fragment.outline.y;
      const dividerOffsetY = Math.min(
        dividerMaxOffsetY,
        Math.max(dividerMinOffsetY, rawDividerOffsetY),
      );
      const dividerY = fragment.outline.y + dividerOffsetY;
      const nextPoints: ExcalidrawLinearElement["points"] = [
        [0, 0],
        [frameWidth, 0],
      ];
      if (
        Math.abs(fragment.divider.x - frameLeft) > 0.5 ||
        Math.abs(fragment.divider.y - dividerY) > 0.5 ||
        fragment.divider.points[1]?.[0] !== frameWidth ||
        fragment.dividerOffsetY !== dividerOffsetY ||
        fragment.fromLaneId !== fromLane.laneId ||
        fragment.toLaneId !== toLane.laneId
      ) {
        updates.set(
          fragment.divider.id,
          newElementWith(fragment.divider, {
            x: frameLeft,
            y: dividerY,
            width: frameWidth,
            height: 0,
            points: nextPoints,
            customData: mergeSequenceMeta(fragment.divider, {
              variant: fragment.variant,
              part: "divider",
              offsetY: dividerOffsetY,
              fromLaneId: fromLane.laneId,
              toLaneId: toLane.laneId,
            }),
          }) as OrderedExcalidrawElement,
        );
      }

      const elseLabel = fragment.elseLabel;
      const elseText =
        elseLabel?.originalText || elseLabel?.text || SEQUENCE_FRAGMENT_ELSE_TEXT;
      const elseLabelStyleSource = getFragmentTextStyleSource(
        elseLabel,
        selected,
        options,
      );
      const elseTextMetrics = getTextMetrics(elseLabelStyleSource, elseText);
      const nextElseX = frameLeft + SEQUENCE_FRAGMENT_SECTION_PADDING_X;
      const nextElseY = dividerY + SEQUENCE_FRAGMENT_SECTION_PADDING_Y;

      if (elseLabel) {
        const nextElseLabel = newElementWith(elseLabel, {
          text: elseText,
          originalText: elseText,
          x: nextElseX,
          y: nextElseY,
          width: elseTextMetrics.width,
          height: elseTextMetrics.height,
          fontFamily: elseLabelStyleSource?.fontFamily,
          fontSize: elseLabelStyleSource?.fontSize,
          lineHeight: elseLabelStyleSource?.lineHeight,
          strokeColor: elseLabelStyleSource?.strokeColor,
          autoResize: true,
          containerId: null,
          groupIds: fragment.header.groupIds,
          customData: {
            ...elseLabel.customData,
            sequenceDiagram: {
              role: "fragment",
              variant: fragment.variant,
              part: "else",
              fromLaneId: fromLane.laneId,
              toLaneId: toLane.laneId,
            },
          },
        }) as OrderedExcalidrawElement;

        if (
          elseLabel.containerId !== null ||
          elseLabel.text !== elseText ||
          elseLabel.originalText !== elseText ||
          Math.abs(elseLabel.width - elseTextMetrics.width) > 0.5 ||
          Math.abs(elseLabel.height - elseTextMetrics.height) > 0.5 ||
          Math.abs(elseLabel.x - nextElseX) > 0.5 ||
          Math.abs(elseLabel.y - nextElseY) > 0.5 ||
          getSequenceElementMeta(elseLabel)?.part !== "else" ||
          getSequenceElementMeta(elseLabel)?.fromLaneId !== fromLane.laneId ||
          getSequenceElementMeta(elseLabel)?.toLaneId !== toLane.laneId
        ) {
          updates.set(elseLabel.id, nextElseLabel);
        }
      } else {
        inserted.push(
          createFragmentSectionLabel({
            fragment,
            text: elseText,
            x: nextElseX,
            y: nextElseY,
            part: "else",
            strokeColor: sectionTextColor,
            fromLaneId: fromLane.laneId,
            toLaneId: toLane.laneId,
          }),
        );
      }
    }
  }

  return { updates, inserted };
};

const bindActivations = (
  lanes: Map<string, SequenceLane>,
  activations: readonly OrderedExcalidrawElement[],
  selectedElementIds: SelectedElementIds,
) => {
  const updates = new Map<string, OrderedExcalidrawElement>();
  const laneList = [...lanes.values()].filter((lane) => lane.participant);

  for (const activation of activations) {
    const activationCenterX = getElementCenterX(activation);
    const activationMeta = getSequenceElementMeta(activation);
    const currentLaneId = getSequenceLaneId(activation);
    const currentLane = currentLaneId
      ? laneList.find((lane) => lane.laneId === currentLaneId) || null
      : null;
    let targetLane = currentLane;
    if (!targetLane) {
      const closestLane = getClosestLane(laneList, activationCenterX, currentLaneId);
      const closestDistance = closestLane
        ? Math.abs(activationCenterX - getLaneCenterX(closestLane))
        : Infinity;
      if (closestLane && closestDistance <= ACTIVATION_BIND_THRESHOLD) {
        targetLane = closestLane;
      }
    }

    if (!targetLane) {
      continue;
    }

    const targetCenterX = targetLane.participant
      ? getElementCenterX(targetLane.participant)
      : activationCenterX;
    const targetX = targetCenterX - activation.width / 2;

    if (
      Math.abs(targetX - activation.x) > 0.5 ||
      activationMeta?.laneId !== targetLane.laneId ||
      activation.backgroundColor !== SEQUENCE_ACCENT_FILL
    ) {
      const nextActivation = newElementWith(activation, {
        x: targetX,
        backgroundColor: SEQUENCE_ACCENT_FILL,
        customData: mergeSequenceMeta(activation, {
          laneId: targetLane.laneId,
        }),
      });

      updates.set(nextActivation.id, nextActivation as OrderedExcalidrawElement);
      targetLane.activations.push(nextActivation as OrderedExcalidrawElement);
      continue;
    }

    targetLane.activations.push(activation);
  }

  return updates;
};

const synchronizeNotes = (
  lanes: Map<string, SequenceLane>,
  notes: readonly OrderedExcalidrawElement[],
  selectedElementIds: SelectedElementIds,
) => {
  const updates = new Map<string, OrderedExcalidrawElement>();
  const laneList = [...lanes.values()].filter(
    (lane) => lane.participant || lane.lifeline,
  );

  for (const note of notes) {
    if (!laneList.length) {
      continue;
    }

    const noteMeta = getSequenceElementMeta(note);
    const noteCenterX = getElementCenterX(note);
    const selected = !!selectedElementIds?.[note.id];
    const targetLane = getClosestLane(
      laneList,
      noteCenterX,
      selected ? undefined : noteMeta?.laneId,
    );

    if (!targetLane) {
      continue;
    }

    const laneCenterX = getLaneAnchorCenterX(targetLane, selectedElementIds);
    const distance = Math.abs(noteCenterX - laneCenterX);

    if (!noteMeta?.laneId && !selected && distance > NOTE_BIND_THRESHOLD) {
      continue;
    }

    const offsetX = selected
      ? note.x - laneCenterX
      : noteMeta?.offsetX ?? DEFAULT_NOTE_OFFSET_X;
    const nextX = laneCenterX + offsetX;

    if (
      Math.abs(note.x - nextX) > 0.5 ||
      noteMeta?.laneId !== targetLane.laneId ||
      noteMeta?.offsetX !== offsetX
    ) {
      updates.set(
        note.id,
        newElementWith(note, {
          x: nextX,
          customData: mergeSequenceMeta(note, {
            laneId: targetLane.laneId,
            offsetX,
          }),
        }) as OrderedExcalidrawElement,
      );
    }
  }

  return updates;
};

const synchronizeLane = (
  lane: SequenceLane,
  selectedElementIds: SelectedElementIds,
  elementsMap: Map<string, OrderedExcalidrawElement>,
  options?: SequenceSyncOptions,
) => {
  if (!lane.participant || !lane.lifeline) {
    return new Map<string, OrderedExcalidrawElement>();
  }

  const updates = new Map<string, OrderedExcalidrawElement>();
  const originalParticipant = options?.originalElements?.get(lane.participant.id);
  const originalLifeline = options?.originalElements?.get(lane.lifeline.id);
  const previousCenterX = getLanePreviousCenterX(lane, selectedElementIds);
  const isMqLane = isMqParticipantLane(lane);
  const participantMeta = getSequenceElementMeta(lane.participant);
  const participantLabel = getSequenceParticipantLabel(lane, elementsMap);
  const nextParticipantBoundElements = isMqLane
    ? lane.participant.boundElements?.filter(
        (boundElement) => boundElement.type !== "text",
      ) || []
    : lane.participant.boundElements;
  const shouldStripMqBoundLabel =
    isMqLane &&
    (lane.participant.boundElements?.some(
      (boundElement) => boundElement.type === "text",
    ) || false);
  const isVerticalResize =
    options?.resizeHandleType === "n" || options?.resizeHandleType === "s";
  const isSimpleRectangleLane =
    lane.participant.type === "rectangle" &&
    lane.members.every(
      (member) => member.id === lane.participant!.id || member.id === lane.lifeline!.id,
    );
  const shouldOnlyExtendLifeline =
    isVerticalResize &&
    isSimpleRectangleLane &&
    (!!selectedElementIds?.[lane.participant.id] ||
      !!selectedElementIds?.[lane.lifeline.id]);
  const targetCenterX = shouldOnlyExtendLifeline && originalParticipant
    ? originalParticipant.x + originalParticipant.width / 2
    : getLaneAnchorCenterX(lane, selectedElementIds);
  const laneDeltaX = targetCenterX - previousCenterX;
  const targetParticipantWidth = shouldOnlyExtendLifeline
    ? originalParticipant?.width ?? lane.participant.width
    : lane.participant.width;
  const targetParticipantHeight = shouldOnlyExtendLifeline
    ? originalParticipant?.height ?? SEQUENCE_PARTICIPANT_HEIGHT
    : lane.participant.height;
  const snapTopY = shouldOnlyExtendLifeline
    ? undefined
    : options?.alignmentSnapTopYByLaneKey?.get(lane.key);
  const laneDeltaY =
    typeof snapTopY === "number" ? snapTopY - getLaneHeaderTopY(lane) : 0;
  const targetParticipantX = targetCenterX - targetParticipantWidth / 2;
  const targetParticipantY = shouldOnlyExtendLifeline
    ? originalParticipant?.y ?? lane.participant.y
    : lane.participant.y + laneDeltaY;
  if (
    participantMeta?.laneId !== lane.laneId ||
    (isMqLane && participantMeta?.variant !== "mq") ||
    shouldStripMqBoundLabel ||
    Math.abs(lane.participant.x - targetParticipantX) > 0.5 ||
    Math.abs(lane.participant.y - targetParticipantY) > 0.5 ||
    Math.abs(lane.participant.width - targetParticipantWidth) > 0.5 ||
    Math.abs(lane.participant.height - targetParticipantHeight) > 0.5
  ) {
    updates.set(
      lane.participant.id,
      newElementWith(lane.participant, {
        x: targetParticipantX,
        y: targetParticipantY,
        width: targetParticipantWidth,
        height: targetParticipantHeight,
        ...(isMqLane ? { boundElements: nextParticipantBoundElements } : null),
        customData: mergeSequenceMeta(lane.participant, {
          laneId: lane.laneId,
          ...(isMqLane ? { variant: "mq" } : null),
        }),
      }) as OrderedExcalidrawElement,
    );
  }

  if (Math.abs(laneDeltaX) > 0.5 || Math.abs(laneDeltaY) > 0.5) {
    for (const member of lane.members) {
      if (member.id === lane.participant.id || member.id === lane.lifeline.id) {
        continue;
      }

      updates.set(
        member.id,
        newElementWith(member, {
          x: member.x + laneDeltaX,
          y: member.y + laneDeltaY,
        }) as OrderedExcalidrawElement,
      );
    }
  }

  if (participantLabel) {
    const labelText = participantLabel.originalText || participantLabel.text;
    const metrics = shouldOnlyExtendLifeline
      ? measureSequenceText(labelText)
      : {
          width: participantLabel.width,
          height: participantLabel.height,
        };
    const nextLabelX =
      targetParticipantX +
      Math.max((targetParticipantWidth - metrics.width) / 2, 0);
    const nextLabelY =
      targetParticipantY +
      Math.max((targetParticipantHeight - metrics.height) / 2, 0);

    const nextParticipantLabel = newElementWith(participantLabel, {
      ...(shouldOnlyExtendLifeline
        ? {
            text: labelText,
            originalText: labelText,
            fontFamily: SEQUENCE_TEXT_FONT_FAMILY,
            fontSize: SEQUENCE_TEXT_FONT_SIZE,
            lineHeight: SEQUENCE_TEXT_LINE_HEIGHT,
            width: metrics.width,
            height: metrics.height,
          }
        : null),
      ...(isMqLane
        ? {
            containerId: null,
            groupIds: lane.participant.groupIds,
          }
        : null),
      x: nextLabelX,
      y: nextLabelY,
    }) as OrderedExcalidrawElement;

    if (
      Math.abs(participantLabel.x - nextLabelX) > 0.5 ||
      Math.abs(participantLabel.y - nextLabelY) > 0.5 ||
      (isMqLane &&
        (participantLabel.containerId !== null ||
          participantLabel.groupIds[0] !== lane.participant.groupIds[0])) ||
      (shouldOnlyExtendLifeline &&
        (participantLabel.text !== labelText ||
          participantLabel.originalText !== labelText ||
          participantLabel.fontFamily !== SEQUENCE_TEXT_FONT_FAMILY ||
          Math.abs(participantLabel.fontSize - SEQUENCE_TEXT_FONT_SIZE) > 0.5 ||
          Math.abs(participantLabel.lineHeight - SEQUENCE_TEXT_LINE_HEIGHT) >
            0.001 ||
          Math.abs(participantLabel.width - metrics.width) > 0.5 ||
          Math.abs(participantLabel.height - metrics.height) > 0.5))
    ) {
      updates.set(
        participantLabel.id,
        nextParticipantLabel,
      );
    }
  }

  const lifeline = lane.lifeline as OrderedExcalidrawElement &
    ExcalidrawLinearElement;
  const lifelineMeta = getSequenceElementMeta(lifeline);
  const topOffset = shouldOnlyExtendLifeline
    ? originalLifeline && originalParticipant
      ? originalLifeline.y - originalParticipant.y
      : SEQUENCE_PARTICIPANT_HEIGHT
    : lifelineMeta?.topOffset ?? lifeline.y - lane.participant.y;
  const targetY = targetParticipantY + topOffset;

  let targetBottom = shouldOnlyExtendLifeline
    ? Math.max(getElementBottomY(lifeline), targetY + MIN_LIFELINE_HEIGHT)
    : targetY + Math.max(MIN_LIFELINE_HEIGHT, lifeline.height);

  for (const activation of lane.activations) {
    targetBottom = Math.max(
      targetBottom,
      getElementBottomY(activation) + ACTIVATION_BOTTOM_PADDING,
    );

    const activationMeta = getSequenceElementMeta(activation);
    const targetX = targetCenterX - activation.width / 2;
    if (
      Math.abs(targetX - activation.x) > 0.5 ||
      getSequenceLaneId(activation) !== lane.laneId ||
      activation.backgroundColor !== SEQUENCE_ACCENT_FILL
    ) {
      updates.set(
        activation.id,
        newElementWith(activation, {
          x: targetX,
          backgroundColor: SEQUENCE_ACCENT_FILL,
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
  selectedElementIds?: SelectedElementIds,
  options?: SequenceSyncOptions,
) => {
  const elementsMap = new Map(elements.map((element) => [element.id, element]));
  const { lanes, activations, messages, fragments, notes } =
    buildSequenceLanes(elements);
  const updates = bindActivations(lanes, activations, selectedElementIds);

  const messageUpdates = synchronizeMessages(
    lanes,
    messages,
    selectedElementIds,
  );
  messageUpdates.forEach((value, key) => updates.set(key, value));

  const { updates: fragmentUpdates, inserted: insertedFragmentElements } =
    synchronizeFragments(
      lanes,
      fragments,
      selectedElementIds,
      elementsMap,
      options,
    );
  fragmentUpdates.forEach((value, key) => updates.set(key, value));

  const noteUpdates = synchronizeNotes(lanes, notes, selectedElementIds);
  noteUpdates.forEach((value, key) => updates.set(key, value));

  for (const lane of lanes.values()) {
    const laneUpdates = synchronizeLane(
      lane,
      selectedElementIds,
      elementsMap,
      options,
    );
    laneUpdates.forEach((value, key) => updates.set(key, value));
  }

  if (!updates.size && !insertedFragmentElements.length) {
    return { changed: false as const, elements };
  }

  const nextElements = elements.map((element) => updates.get(element.id) || element);

  return {
    changed: true as const,
    elements: insertedFragmentElements.length
      ? syncInvalidIndices([...nextElements, ...insertedFragmentElements])
      : nextElements,
  };
};
