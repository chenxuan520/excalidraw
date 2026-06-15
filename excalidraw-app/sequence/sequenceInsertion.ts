import { newElementWith } from "../../packages/excalidraw/element/mutateElement";
import type { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  DEFAULT_SEQUENCE_REQUEST_DIRECTION,
  getSequenceElementMeta,
  getSequenceLaneId,
  getSequenceMessageLaneIds,
  isSequenceLifelineElement,
  isSequenceMessageElement,
  isSequenceParticipantElement,
  type SequenceRequestDirection,
  type SequenceStencilKind,
} from "./sequenceStencils";

const DEFAULT_NOTE_OFFSET_X = 28;

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

export const applySequenceInsertionContext = ({
  kind,
  elements,
  sceneElements,
  selectedElementIds,
  requestDirection = DEFAULT_SEQUENCE_REQUEST_DIRECTION,
}: {
  kind: SequenceStencilKind;
  elements: readonly ExcalidrawElement[];
  sceneElements: readonly ExcalidrawElement[];
  selectedElementIds: Record<string, true> | undefined;
  requestDirection?: SequenceRequestDirection;
}) => {
  if (!selectedElementIds || !Object.keys(selectedElementIds).length) {
    return elements;
  }

  const availableElements = sceneElements.filter(
    (element) => !element.isDeleted,
  );
  const laneAnchors = availableElements
    .filter(
      (element) =>
        isSequenceParticipantElement(element) ||
        isSequenceLifelineElement(element),
    )
    .sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2));
  const laneCenterById = new Map(
    laneAnchors
      .map((element) => {
        const laneId = getSequenceLaneId(element);
        return laneId
          ? ([laneId, element.x + element.width / 2] as const)
          : null;
      })
      .filter(
        (entry): entry is readonly [string, number] => Boolean(entry),
      ),
  );
  const laneGroupIds = new Set(
    laneAnchors
      .map((element) => element.groupIds[0])
      .filter((groupId): groupId is string => Boolean(groupId)),
  );
  const selectedElements = availableElements.filter(
    (element) => selectedElementIds[element.id],
  );
  const selectedLaneGroupIds = new Set(
    selectedElements
      .map((element) => element.groupIds[0])
      .filter((groupId): groupId is string => Boolean(groupId)),
  );
  const selectedSequenceElements = selectedElements.filter(
    (element) =>
      Boolean(getSequenceElementMeta(element)) ||
      (element.groupIds[0] ? laneGroupIds.has(element.groupIds[0]) : false),
  );

  if (!selectedSequenceElements.length) {
    return elements;
  }
  const orderedSelectedLaneIds = Array.from(
    new Set(
      laneAnchors
        .filter(
          (element) =>
            selectedElementIds[element.id] ||
            selectedLaneGroupIds.has(element.groupIds[0]),
        )
        .map((element) => getSequenceLaneId(element))
        .filter((laneId): laneId is string => Boolean(laneId)),
    ),
  );

  const selectedMessages = selectedSequenceElements.filter((element) =>
    isSequenceMessageElement(element),
  );
  const selectedMessage =
    selectedMessages.length === 1 ? selectedMessages[0] : null;
  const selectedMessageLaneIds = selectedMessage
    ? getSequenceMessageLaneIds(selectedMessage)
    : null;
  const selectedLaneMeta = selectedSequenceElements
    .map((element) => getSequenceElementMeta(element))
    .find((meta) => meta?.laneId);
  const selectedFragmentMeta = selectedSequenceElements
    .map((element) => getSequenceElementMeta(element))
    .find(
      (meta) => meta?.role === "fragment" && (meta.fromLaneId || meta.toLaneId),
    );

  const targetLaneId =
    selectedMessageLaneIds?.toLaneId ||
    selectedMessageLaneIds?.fromLaneId ||
    selectedFragmentMeta?.toLaneId ||
    selectedFragmentMeta?.fromLaneId ||
    selectedLaneMeta?.laneId ||
    orderedSelectedLaneIds[orderedSelectedLaneIds.length - 1] ||
    orderedSelectedLaneIds[0];

  const hasSelectedMessageContext = Boolean(
    selectedMessageLaneIds?.fromLaneId || selectedMessageLaneIds?.toLaneId,
  );
  const hasSelectedFragmentContext = Boolean(
    selectedFragmentMeta?.fromLaneId || selectedFragmentMeta?.toLaneId,
  );
  const hasLaneSpanContext = orderedSelectedLaneIds.length >= 2;
  const spanFromLaneId = hasSelectedMessageContext
    ? selectedMessageLaneIds?.fromLaneId
    : hasSelectedFragmentContext
    ? selectedFragmentMeta?.fromLaneId
    : hasLaneSpanContext
    ? orderedSelectedLaneIds[0]
    : undefined;
  const spanToLaneId = hasSelectedMessageContext
    ? selectedMessageLaneIds?.toLaneId || selectedMessageLaneIds?.fromLaneId
    : hasSelectedFragmentContext
    ? selectedFragmentMeta?.toLaneId || selectedFragmentMeta?.fromLaneId
    : hasLaneSpanContext
    ? orderedSelectedLaneIds[orderedSelectedLaneIds.length - 1]
    : undefined;

  const orderLaneIds = (left: string | undefined, right: string | undefined) => {
    if (!left || !right || left === right) {
      return { leftLaneId: left, rightLaneId: right };
    }

    return (laneCenterById.get(left) ?? 0) <= (laneCenterById.get(right) ?? 0)
      ? { leftLaneId: left, rightLaneId: right }
      : { leftLaneId: right, rightLaneId: left };
  };

  if (kind === "activation" && targetLaneId) {
    return elements.map((element) => {
      const meta = getSequenceElementMeta(element);
      if (meta?.role !== "activation") {
        return element;
      }
      return newElementWith(element, {
        customData: mergeSequenceMeta(element, { laneId: targetLaneId }),
      });
    });
  }

  if (kind === "note" && targetLaneId) {
    return elements.map((element) => {
      const meta = getSequenceElementMeta(element);
      if (meta?.role !== "note") {
        return element;
      }
      return newElementWith(element, {
        customData: mergeSequenceMeta(element, {
          laneId: targetLaneId,
          offsetX: DEFAULT_NOTE_OFFSET_X,
        }),
      });
    });
  }

  if (
    (kind === "message" || kind === "return") &&
    spanFromLaneId &&
    spanToLaneId
  ) {
    const laneIds = hasSelectedMessageContext
      ? {
          fromLaneId:
            kind === "return" ? spanToLaneId : spanFromLaneId,
          toLaneId: kind === "return" ? spanFromLaneId : spanToLaneId,
        }
      : (() => {
          const { leftLaneId, rightLaneId } = orderLaneIds(
            spanFromLaneId,
            spanToLaneId,
          );
          if (!leftLaneId || !rightLaneId) {
            return {
              fromLaneId:
                kind === "return" ? spanToLaneId : spanFromLaneId,
              toLaneId: kind === "return" ? spanFromLaneId : spanToLaneId,
            };
          }

          const requestLaneIds =
            requestDirection === "ltr"
              ? { fromLaneId: leftLaneId, toLaneId: rightLaneId }
              : { fromLaneId: rightLaneId, toLaneId: leftLaneId };

          return kind === "message"
            ? requestLaneIds
            : {
                fromLaneId: requestLaneIds.toLaneId,
                toLaneId: requestLaneIds.fromLaneId,
              };
        })();

    return elements.map((element) => {
      const meta = getSequenceElementMeta(element);
      if (meta?.role !== "message") {
        return element;
      }
      return newElementWith(element, {
        customData: mergeSequenceMeta(element, {
          fromLaneId: laneIds.fromLaneId,
          toLaneId: laneIds.toLaneId,
          variant: kind === "return" ? "return" : "message",
        }),
      });
    });
  }

  if (kind === "self" && targetLaneId) {
    return elements.map((element) => {
      const meta = getSequenceElementMeta(element);
      if (meta?.role !== "message") {
        return element;
      }
      return newElementWith(element, {
        customData: mergeSequenceMeta(element, {
          fromLaneId: targetLaneId,
          toLaneId: targetLaneId,
          variant: "self",
        }),
      });
    });
  }

  if ((kind === "loop" || kind === "alt") && spanFromLaneId && spanToLaneId) {
    return elements.map((element) => {
      const meta = getSequenceElementMeta(element);
      if (meta?.role !== "fragment") {
        return element;
      }
      return newElementWith(element, {
        customData: mergeSequenceMeta(element, {
          fromLaneId: spanFromLaneId,
          toLaneId: spanToLaneId,
          variant: kind,
        }),
      });
    });
  }

  return elements;
};
