import { convertToExcalidrawElements } from "../../packages/excalidraw";
import { FONT_FAMILY } from "../../packages/excalidraw/constants";
import type { ExcalidrawElementSkeleton } from "../../packages/excalidraw/data/transform";
import { newElementWith } from "../../packages/excalidraw/element/mutateElement";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import {
  SEQUENCE_ACCENT_FILL,
  SEQUENCE_FRAGMENT_CONDITION_TEXT,
  SEQUENCE_FRAGMENT_ELSE_TEXT,
  SEQUENCE_FRAGMENT_HEADER_HEIGHT,
  SEQUENCE_PARTICIPANT_HEIGHT,
  SEQUENCE_SELF_CALL_HEIGHT,
  SEQUENCE_TEXT_FONT_SIZE,
  SEQUENCE_TEXT_LINE_HEIGHT,
  createSequenceActivationStencil,
  createSequenceStencil,
  getSequenceLaneId,
  getSequenceMessageLaneIds,
  isSequenceActivationElement,
  isSequenceFragmentElement,
  isSequenceLifelineElement,
  isSequenceMessageElement,
  isSequenceNoteElement,
  type SequenceStencilDefaults,
} from "./sequenceStencils";
import { synchronizeSequenceDiagramElements } from "./sequenceSystem";

const defaults: SequenceStencilDefaults = {
  actor: "角色",
  service: "服务",
  boundary: "边界",
  control: "控制",
  entity: "实体",
  participant: "参与者",
  database: "数据库",
  mq: "消息队列",
  request: "请求",
  async: "异步",
  response: "响应",
  self: "自调用",
  note: "备注",
  loop: "循环",
  alt: "分支",
};

const getParticipantTextElement = (
  elements: readonly OrderedExcalidrawElement[],
  participant: OrderedExcalidrawElement,
) => {
  return elements.find(
    (element): element is ExcalidrawTextElement & OrderedExcalidrawElement =>
      element.type === "text" &&
      (element.containerId === participant.id ||
        element.groupIds[0] === participant.groupIds[0]),
  );
};

describe("synchronizeSequenceDiagramElements", () => {
  it("extends the lifeline to cover a taller activation bar", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    );
    expect(lifeline).toBeDefined();

    const activation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: lifeline!.x,
        y: lifeline!.y + 40,
        height: 420,
        theme: "light",
        laneId: getSequenceLaneId(lifeline!),
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const synced = synchronizeSequenceDiagramElements([
      ...laneElements,
      activation,
    ]);

    expect(synced.changed).toBe(true);

    const syncedLifeline = synced.elements.find((element) =>
      isSequenceLifelineElement(element),
    );
    const syncedActivation = synced.elements.find((element) =>
      isSequenceActivationElement(element),
    );

    expect(syncedLifeline).toBeDefined();
    expect(syncedActivation).toBeDefined();
    expect(syncedLifeline!.height).toBeGreaterThanOrEqual(
      syncedActivation!.y + syncedActivation!.height - syncedLifeline!.y + 28,
    );
    expect(
      Math.abs(
        syncedActivation!.x +
          syncedActivation!.width / 2 -
          (syncedLifeline!.x + syncedLifeline!.width / 2),
      ),
    ).toBeLessThanOrEqual(0.5);
  });

  it("binds a standalone activation bar to the nearest lane", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    );
    expect(lifeline).toBeDefined();

    const unboundActivation = convertToExcalidrawElements(
      createSequenceStencil("activation", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const shiftedActivation = {
      ...unboundActivation,
      x: lifeline!.x + 20,
      y: lifeline!.y + 30,
    } as OrderedExcalidrawElement;

    const synced = synchronizeSequenceDiagramElements([
      ...laneElements,
      shiftedActivation,
    ]);
    const syncedLifeline = synced.elements.find((element) =>
      isSequenceLifelineElement(element),
    );
    const syncedActivation = synced.elements.find((element) =>
      isSequenceActivationElement(element),
    );

    expect(getSequenceLaneId(syncedActivation!)).toBe(
      getSequenceLaneId(syncedLifeline!),
    );
  });

  it("normalizes activation bars to the shared sequence accent fill", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const activation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: lifeline.x,
        y: lifeline.y + 48,
        height: 120,
        theme: "light",
        laneId: getSequenceLaneId(lifeline),
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const synced = synchronizeSequenceDiagramElements([
      ...laneElements,
      {
        ...activation,
        backgroundColor: "#e8eefc",
      } as OrderedExcalidrawElement,
    ]);
    const syncedActivation = synced.elements.find((element) =>
      isSequenceActivationElement(element),
    );

    expect(syncedActivation?.backgroundColor).toBe(SEQUENCE_ACCENT_FILL);
  });

  it("keeps a bound activation attached when the lane moves", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const activation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: lifeline.x,
        y: lifeline.y + 48,
        height: 120,
        theme: "light",
        laneId: getSequenceLaneId(lifeline),
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const firstSync = synchronizeSequenceDiagramElements([
      ...laneElements,
      activation,
    ]);
    const syncedLifeline = firstSync.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const syncedActivation = firstSync.elements.find((element) =>
      isSequenceActivationElement(element),
    )!;

    const movedLane = firstSync.elements.map((element) => {
      if (
        element.id === syncedLifeline.id ||
        element.id.startsWith("sequence-participant-")
      ) {
        return { ...element, x: element.x + 140 } as OrderedExcalidrawElement;
      }
      return element;
    });

    const secondSync = synchronizeSequenceDiagramElements(movedLane);
    const movedLifeline = secondSync.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const movedActivation = secondSync.elements.find((element) =>
      isSequenceActivationElement(element),
    )!;

    expect(getSequenceLaneId(movedActivation)).toBe(
      getSequenceLaneId(movedLifeline),
    );
    expect(movedActivation.x + movedActivation.width / 2).toBe(movedLifeline.x);
    expect(movedActivation.x).not.toBe(syncedActivation.x);
  });

  it("does not resync an already-synchronized activation on a no-op pass", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const activation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: lifeline.x,
        y: lifeline.y + 48,
        height: 120,
        theme: "light",
        laneId: getSequenceLaneId(lifeline),
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const firstSync = synchronizeSequenceDiagramElements([
      ...laneElements,
      activation,
    ]);
    const secondSync = synchronizeSequenceDiagramElements(firstSync.elements);

    expect(firstSync.changed).toBe(true);
    expect(secondSync.changed).toBe(false);
  });

  it("keeps a selected activation bar attached to its current lane when dragged horizontally", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const leftLifeline = leftLane.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const activation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: leftLifeline.x,
        y: leftLifeline.y + 48,
        height: 120,
        theme: "light",
        laneId: getSequenceLaneId(leftLifeline),
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const firstSync = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      activation,
    ]);
    const rightLifeline = firstSync.elements
      .filter((element) => isSequenceLifelineElement(element))
      .sort((a, b) => a.x - b.x)[1];
    const syncedActivation = firstSync.elements.find((element) =>
      isSequenceActivationElement(element),
    )!;

    const movedActivation = {
      ...syncedActivation,
      x: rightLifeline.x - syncedActivation.width / 2,
    } as OrderedExcalidrawElement;

    const secondSync = synchronizeSequenceDiagramElements(
      firstSync.elements.map((element) =>
        element.id === movedActivation.id ? movedActivation : element,
      ),
      { [movedActivation.id]: true },
    );
    const reboundActivation = secondSync.elements.find((element) =>
      isSequenceActivationElement(element),
    )!;
    const reboundLifeline = secondSync.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;

    expect(getSequenceLaneId(reboundActivation)).toBe(
      getSequenceLaneId(reboundLifeline),
    );
    expect(reboundActivation.x + reboundActivation.width / 2).toBe(
      reboundLifeline.x,
    );
  });

  it("keeps duplicated lanes independent even if their source lane ids match", () => {
    const firstLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const secondLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];

    const synced = synchronizeSequenceDiagramElements([
      ...firstLane,
      ...secondLane,
    ]);

    const participants = synced.elements.filter((element) =>
      element.id.startsWith("sequence-participant-"),
    );

    expect(participants.length).toBeGreaterThanOrEqual(2);
    expect(getSequenceLaneId(participants[0])).not.toBe(
      getSequenceLaneId(participants[1]),
    );
  });

  it("snaps message arrows to lanes and follows participant movement", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const message = convertToExcalidrawElements(
      createSequenceStencil("message", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const shiftedMessage = {
      ...message,
      x: 80,
      y: 120,
    } as OrderedExcalidrawElement;

    const firstSync = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      shiftedMessage,
    ]);

    const syncedMessage = firstSync.elements.find((element) =>
      isSequenceMessageElement(element),
    )! as OrderedExcalidrawElement & ExcalidrawLinearElement;
    const lifelines = firstSync.elements.filter((element) =>
      isSequenceLifelineElement(element),
    );
    const sortedLifelines = [...lifelines].sort((a, b) => a.x - b.x);

    expect(syncedMessage.points.length).toBe(2);
    expect(syncedMessage.x).toBe(sortedLifelines[0].x);
    expect(syncedMessage.points[1][0]).toBe(
      sortedLifelines[1].x - sortedLifelines[0].x,
    );

    const movedRightLane = firstSync.elements.map((element) =>
      getSequenceLaneId(element) === getSequenceLaneId(sortedLifelines[1])
        ? ({ ...element, x: element.x + 120 } as OrderedExcalidrawElement)
        : element,
    );

    const secondSync = synchronizeSequenceDiagramElements(movedRightLane);
    const movedMessage = secondSync.elements.find((element) =>
      isSequenceMessageElement(element),
    )! as OrderedExcalidrawElement & ExcalidrawLinearElement;
    const movedLifelines = secondSync.elements
      .filter((element) => isSequenceLifelineElement(element))
      .sort((a, b) => a.x - b.x);

    expect(movedMessage.x).toBe(movedLifelines[0].x);
    expect(movedMessage.points[1][0]).toBe(
      movedLifelines[1].x - movedLifelines[0].x,
    );
  });

  it("rebinds a selected message when it is dragged to a different lane pair", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const middleLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 640,
    })) as OrderedExcalidrawElement[];
    const message = convertToExcalidrawElements(
      createSequenceStencil("message", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const firstSync = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...middleLane,
      ...rightLane,
      { ...message, x: 80, y: 120 } as OrderedExcalidrawElement,
    ]);
    const syncedMessage = firstSync.elements.find((element) =>
      isSequenceMessageElement(element),
    )! as OrderedExcalidrawElement & ExcalidrawLinearElement;
    const lifelines = firstSync.elements
      .filter((element) => isSequenceLifelineElement(element))
      .sort((a, b) => a.x - b.x);

    const movedMessage = {
      ...syncedMessage,
      x: lifelines[1].x,
      points: [
        [0, 0],
        [lifelines[2].x - lifelines[1].x, 0],
      ],
    } as OrderedExcalidrawElement;

    const secondSync = synchronizeSequenceDiagramElements(
      firstSync.elements.map((element) =>
        element.id === movedMessage.id ? movedMessage : element,
      ),
      { [movedMessage.id]: true },
    );
    const reboundMessage = secondSync.elements.find((element) =>
      isSequenceMessageElement(element),
    )!;

    expect(getSequenceMessageLaneIds(reboundMessage)).toEqual({
      fromLaneId: getSequenceLaneId(lifelines[1]),
      toLaneId: getSequenceLaneId(lifelines[2]),
    });
  });

  it("keeps return messages reversed by default", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const response = convertToExcalidrawElements(
      createSequenceStencil("return", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const synced = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      { ...response, x: 80, y: 120 } as OrderedExcalidrawElement,
    ]);
    const syncedResponse = synced.elements.find((element) =>
      isSequenceMessageElement(element),
    )! as OrderedExcalidrawElement & ExcalidrawLinearElement;
    const lifelines = synced.elements
      .filter((element) => isSequenceLifelineElement(element))
      .sort((a, b) => a.x - b.x);

    expect(getSequenceMessageLaneIds(syncedResponse)).toEqual({
      fromLaneId: getSequenceLaneId(lifelines[1]),
      toLaneId: getSequenceLaneId(lifelines[0]),
    });
    expect(syncedResponse.x).toBe(lifelines[1].x);
    expect(syncedResponse.points[1][0]).toBe(lifelines[0].x - lifelines[1].x);
  });

  it("connects messages to activation bar edges when activation ids are present", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const leftLifeline = leftLane.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const rightLifeline = rightLane.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const leftActivation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: leftLifeline.x,
        y: 120,
        height: 88,
        theme: "light",
        laneId: getSequenceLaneId(leftLifeline),
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;
    const rightActivation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: rightLifeline.x,
        y: 120,
        height: 88,
        theme: "light",
        laneId: getSequenceLaneId(rightLifeline),
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;
    const message = convertToExcalidrawElements(
      createSequenceStencil("message", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement & ExcalidrawLinearElement;

    const synced = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      leftActivation,
      rightActivation,
      {
        ...message,
        x: leftActivation.x + leftActivation.width,
        y: 120,
        customData: {
          ...message.customData,
          sequenceDiagram: {
            ...message.customData?.sequenceDiagram,
            variant: "message",
            fromLaneId: getSequenceLaneId(leftLifeline),
            toLaneId: getSequenceLaneId(rightLifeline),
            fromActivationId: leftActivation.id,
            toActivationId: rightActivation.id,
          },
        },
      },
    ]);
    const syncedMessage = synced.elements.find((element) =>
      isSequenceMessageElement(element),
    )! as OrderedExcalidrawElement & ExcalidrawLinearElement;

    expect(syncedMessage.x).toBe(leftActivation.x + leftActivation.width);
    expect(syncedMessage.points[1][0]).toBe(
      rightActivation.x - (leftActivation.x + leftActivation.width),
    );
  });

  it("keeps self messages attached to the source activation edge", () => {
    const lane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const lifeline = lane.find((element) => isSequenceLifelineElement(element))!;
    const sourceActivation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: lifeline.x,
        y: 120,
        height: 120,
        theme: "light",
        laneId: getSequenceLaneId(lifeline),
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;
    const message = convertToExcalidrawElements(
      createSequenceStencil("self", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement & ExcalidrawLinearElement;

    const synced = synchronizeSequenceDiagramElements([
      ...lane,
      sourceActivation,
      newElementWith(message, {
        x: sourceActivation.x + sourceActivation.width,
        y: 120,
        points: [
          [0, 0],
          [88, 0],
          [88, 64],
          [0, 64],
        ],
        customData: {
          ...message.customData,
          sequenceDiagram: {
            ...message.customData?.sequenceDiagram,
            variant: "self",
            fromLaneId: getSequenceLaneId(lifeline),
            toLaneId: getSequenceLaneId(lifeline),
            fromActivationId: sourceActivation.id,
            toActivationId: undefined,
          },
        },
      }) as OrderedExcalidrawElement,
    ]);
    const syncedMessage = synced.elements.find((element) =>
      isSequenceMessageElement(element),
    )! as OrderedExcalidrawElement & ExcalidrawLinearElement;

    expect(syncedMessage.x).toBe(sourceActivation.x + sourceActivation.width);
    expect(syncedMessage.points[3][0]).toBe(0);
    expect(syncedMessage.points[3][1]).toBe(64);
    expect(syncedMessage.customData?.sequenceDiagram?.toActivationId).toBe(
      undefined,
    );
  });

  it("extends only the lifeline on vertical participant resize", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const participant = laneElements.find((element) =>
      element.id.startsWith("sequence-participant-"),
    )!;
    const participantLabel = getParticipantTextElement(laneElements, participant)!;
    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;

    const synced = synchronizeSequenceDiagramElements(
      laneElements.map((element) => {
        if (element.id === participant.id) {
          return {
            ...element,
            width: participant.width + 120,
            height: 132,
          } as OrderedExcalidrawElement;
        }
        if (element.id === participantLabel.id) {
          return {
            ...element,
            fontSize: 34,
            lineHeight: 1.8,
            width: participantLabel.width * 1.8,
            height: participantLabel.height * 1.8,
          } as unknown as OrderedExcalidrawElement;
        }
        if (element.id === lifeline.id) {
          return {
            ...element,
            y: participant.y + 132,
            height: lifeline.height + 84,
            points: [
              [0, 0],
              [0, lifeline.height + 84],
            ] as ExcalidrawLinearElement["points"],
          } as OrderedExcalidrawElement;
        }
        return element;
      }),
      { [participant.id]: true, [lifeline.id]: true },
      {
        resizeHandleType: "s",
        originalElements: new Map(
          laneElements.map((element) => [element.id, element as ExcalidrawElement]),
        ),
      },
    );

    const nextParticipant = synced.elements.find(
      (element) => element.id === participant.id,
    )!;
    const nextLabel = synced.elements.find(
      (element) => element.id === participantLabel.id,
    ) as ExcalidrawTextElement;
    const nextLifeline = synced.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;

    expect(nextParticipant.height).toBe(SEQUENCE_PARTICIPANT_HEIGHT);
    expect(nextParticipant.width).toBe(participant.width);
    expect(nextLabel.fontSize).toBe(SEQUENCE_TEXT_FONT_SIZE);
    expect(nextLifeline.y).toBe(participant.y + SEQUENCE_PARTICIPANT_HEIGHT);
    expect(nextLifeline.height).toBeGreaterThan(lifeline.height);
  });

  it("moves the participant when the lifeline itself is dragged", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const participant = laneElements.find((element) =>
      element.id.startsWith("sequence-participant-"),
    )!;
    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;

    const movedLifeline = {
      ...lifeline,
      x: lifeline.x + 140,
    } as OrderedExcalidrawElement;

    const synced = synchronizeSequenceDiagramElements(
      laneElements.map((element) =>
        element.id === movedLifeline.id ? movedLifeline : element,
      ),
      { [movedLifeline.id]: true },
    );

    const nextParticipant = synced.elements.find(
      (element) => element.id === participant.id,
    )!;
    const nextLifeline = synced.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;

    expect(nextParticipant.x + nextParticipant.width / 2).toBe(nextLifeline.x);
  });

  it("moves grouped actor decorations when the lifeline is dragged", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("actor", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const decoration = laneElements.find(
      (element) =>
        element.groupIds[0] === lifeline.groupIds[0] &&
        element.id !== lifeline.id &&
        !element.id.startsWith("sequence-participant-"),
    )!;

    const movedLifeline = {
      ...lifeline,
      x: lifeline.x + 120,
    } as OrderedExcalidrawElement;

    const synced = synchronizeSequenceDiagramElements(
      laneElements.map((element) =>
        element.id === lifeline.id ? movedLifeline : element,
      ),
      { [movedLifeline.id]: true },
    );

    const nextLifeline = synced.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const nextDecoration = synced.elements.find(
      (element) => element.id === decoration.id,
    )!;

    expect(nextDecoration.x - decoration.x).toBe(nextLifeline.x - lifeline.x);
  });

  it("moves grouped actor decorations when the participant itself is dragged", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("actor", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const participant = laneElements.find((element) =>
      element.id.startsWith("sequence-participant-"),
    )!;
    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const decoration = laneElements.find(
      (element) =>
        element.groupIds[0] === lifeline.groupIds[0] &&
        element.id !== lifeline.id &&
        element.id !== participant.id,
    )!;

    const movedParticipant = {
      ...participant,
      x: participant.x + 90,
    } as OrderedExcalidrawElement;

    const synced = synchronizeSequenceDiagramElements(
      laneElements.map((element) =>
        element.id === participant.id ? movedParticipant : element,
      ),
      { [movedParticipant.id]: true },
    );

    const nextLifeline = synced.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const nextDecoration = synced.elements.find(
      (element) => element.id === decoration.id,
    )!;

    expect(nextLifeline.x - lifeline.x).toBe(90);
    expect(nextDecoration.x - decoration.x).toBe(
      nextLifeline.x +
        nextLifeline.width / 2 -
        (lifeline.x + lifeline.width / 2),
    );
  });

  it("moves message queue top-level labels with the lane when top-edge snapping applies", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("mq", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const participant = laneElements.find((element) =>
      element.id.startsWith("sequence-participant-"),
    )!;
    const participantLabel = getParticipantTextElement(laneElements, participant)!;
    const leftCap = laneElements.find(
      (element) =>
        element.type === "ellipse" && element.groupIds[0] === participant.groupIds[0],
    )!;

    const synced = synchronizeSequenceDiagramElements(
      laneElements,
      { [participant.id]: true },
      {
        alignmentSnapTopYByLaneKey: new Map([[participant.groupIds[0], 10]]),
      },
    );

    const nextParticipant = synced.elements.find((element) => element.id === participant.id)!;
    const nextLabel = synced.elements.find(
      (element) => element.id === participantLabel.id,
    ) as ExcalidrawTextElement;
    const nextLeftCap = synced.elements.find(
      (element) => element.id === leftCap.id,
    )!;

    expect(nextParticipant.y - participant.y).toBe(10);
    expect(nextLabel.y - participantLabel.y).toBe(10);
    expect(nextLeftCap.y - leftCap.y).toBe(10);
  });

  it("migrates message queue labels into standalone top-level text", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("mq", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const participant = laneElements.find((element) =>
      element.id.startsWith("sequence-participant-"),
    )!;
    const participantLabel = getParticipantTextElement(laneElements, participant)!;

    const legacyParticipant = {
      ...participant,
      boundElements: [{ type: "text", id: participantLabel.id }],
      customData: {
        ...participant.customData,
        sequenceDiagram: {
          ...participant.customData?.sequenceDiagram,
          variant: undefined,
        },
      },
    } as OrderedExcalidrawElement;
    const legacyLabel = {
      ...participantLabel,
      containerId: participant.id,
      groupIds: [],
      x: participantLabel.x - 24,
    } as ExcalidrawTextElement;

    const synced = synchronizeSequenceDiagramElements(
      laneElements.map((element) => {
        if (element.id === participant.id) {
          return legacyParticipant;
        }
        if (element.id === participantLabel.id) {
          return legacyLabel as unknown as OrderedExcalidrawElement;
        }
        return element;
      }),
    );

    const nextParticipant = synced.elements.find(
      (element) => element.id === participant.id,
    )!;
    const nextLabel = synced.elements.find(
      (element) => element.id === participantLabel.id,
    ) as ExcalidrawTextElement;

    expect(
      nextParticipant.boundElements?.some((boundElement) => boundElement.type === "text"),
    ).toBe(false);
    expect(nextParticipant.customData?.sequenceDiagram?.variant).toBe("mq");
    expect(nextLabel.containerId ?? null).toBe(null);
    expect(nextLabel.groupIds[0]).toBe(participant.groupIds[0]);
    expect(nextLabel.x).toBeCloseTo(
      participant.x + (participant.width - nextLabel.width) / 2,
      1,
    );
  });

  it("keeps alt fragments at their dragged geometry instead of snapping to lanes", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const fragment = convertToExcalidrawElements(
      createSequenceStencil("alt", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 40,
      y: element.y + 120,
    })) as OrderedExcalidrawElement[];

    const synced = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      ...fragment,
    ]);

    const lifelines = synced.elements
      .filter((element) => isSequenceLifelineElement(element))
      .sort((a, b) => a.x - b.x);
    const fragmentParts = synced.elements.filter((element) =>
      isSequenceFragmentElement(element),
    );
    const outline = fragmentParts.find(
      (element) => element.customData?.sequenceDiagram?.part === "outline",
    )!;
    const divider = fragmentParts.find(
      (element) => element.customData?.sequenceDiagram?.part === "divider",
    ) as OrderedExcalidrawElement & ExcalidrawLinearElement;

    expect(lifelines).toHaveLength(2);
    expect(outline.x).toBe(40);
    expect(outline.width).toBe(280);
    expect(divider.points[1][0]).toBe(outline.width);
  });

  it("keeps fragment header labels on one line with a fixed header height", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const fragment = convertToExcalidrawElements(
      createSequenceStencil("loop", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 40,
      y: element.y + 120,
    })) as OrderedExcalidrawElement[];

    const synced = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      ...fragment,
    ]);
    const outline = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "outline",
    )!;
    const header = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "header",
    )!;
    const headerLabel = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "label",
    ) as ExcalidrawTextElement | undefined;
    const conditionLabel = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "condition",
    ) as ExcalidrawTextElement | undefined;

    expect(header.height).toBe(SEQUENCE_FRAGMENT_HEADER_HEIGHT);
    expect(header.y).toBe(outline.y);
    expect(header.width).toBeGreaterThanOrEqual(74);
    expect(headerLabel?.containerId).toBe(null);
    expect(headerLabel?.text).toBe(defaults.loop);
    expect(conditionLabel?.text).toBe(SEQUENCE_FRAGMENT_CONDITION_TEXT);
  });

  it("migrates legacy bound fragment labels into standalone text elements", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const legacyFragment = convertToExcalidrawElements(
      [
        {
          type: "rectangle",
          x: 0,
          y: 120,
          width: 280,
          height: 180,
          groupIds: ["legacy-fragment"],
          customData: {
            sequenceDiagram: {
              role: "fragment",
              variant: "alt",
              part: "outline",
            },
          },
        },
        {
          type: "rectangle",
          x: 0,
          y: 120,
          width: 62,
          height: 28,
          groupIds: ["legacy-fragment"],
          label: {
            text: defaults.alt,
          },
          customData: {
            sequenceDiagram: {
              role: "fragment",
              variant: "alt",
              part: "header",
            },
          },
        },
        {
          type: "line",
          x: 0,
          y: 192,
          width: 280,
          height: 0,
          points: [
            [0, 0],
            [280, 0],
          ],
          groupIds: ["legacy-fragment"],
          customData: {
            sequenceDiagram: {
              role: "fragment",
              variant: "alt",
              part: "divider",
              offsetY: 72,
            },
          },
        },
      ] as ExcalidrawElementSkeleton[],
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const synced = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      ...legacyFragment,
    ]);
    const header = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "header",
    )!;
    const label = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "label",
    ) as ExcalidrawTextElement | undefined;
    const conditionLabel = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "condition",
    ) as ExcalidrawTextElement | undefined;
    const elseLabel = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "else",
    ) as ExcalidrawTextElement | undefined;

    expect(header.boundElements?.some((element) => element.type === "text")).toBe(
      false,
    );
    expect(label?.containerId).toBe(null);
    expect(label?.text).toBe(defaults.alt);
    expect(conditionLabel?.text).toBe(SEQUENCE_FRAGMENT_CONDITION_TEXT);
    expect(elseLabel?.text).toBe(SEQUENCE_FRAGMENT_ELSE_TEXT);
  });

  it("preserves manually changed alt fragment text styles while resizing", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const fragment = convertToExcalidrawElements(
      createSequenceStencil("alt", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];

    const resizedFragment = fragment.map((element) => {
      const part = element.customData?.sequenceDiagram?.part;
      if (part === "label") {
        return {
          ...element,
          fontFamily: FONT_FAMILY.Helvetica,
          fontSize: 44,
          lineHeight: 1.7,
          width: element.width * 2,
          height: element.height * 2,
        } as OrderedExcalidrawElement;
      }

      if (part === "condition") {
        return {
          ...element,
          fontFamily: FONT_FAMILY.Nunito,
          fontSize: 28,
          lineHeight: 1.6,
          width: element.width * 1.6,
          height: element.height * 1.6,
        } as OrderedExcalidrawElement;
      }

      if (part === "else") {
        return {
          ...element,
          fontFamily: FONT_FAMILY.Cascadia,
          fontSize: 26,
          lineHeight: 1.5,
          width: element.width * 1.6,
          height: element.height * 1.6,
        } as OrderedExcalidrawElement;
      }

      return element;
    });

    const scaledDuringResize = resizedFragment.map((element) => {
      const part = element.customData?.sequenceDiagram?.part;
      if (
        (part === "label" || part === "condition" || part === "else") &&
        element.type === "text"
      ) {
        return {
          ...element,
          fontSize: element.fontSize * 1.8,
          lineHeight: element.lineHeight * 1.15,
          width: element.width * 1.8,
          height: element.height * 1.8,
        } as OrderedExcalidrawElement;
      }

      if (part === "outline") {
        return {
          ...element,
          width: element.width + 160,
        } as OrderedExcalidrawElement;
      }

      return element;
    });

    const outline = resizedFragment.find(
      (element) => element.customData?.sequenceDiagram?.part === "outline",
    )!;

    const synced = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      ...scaledDuringResize,
    ],
    { [outline.id]: true },
    {
      resizeHandleType: "e",
      originalElements: new Map(
        [...leftLane, ...rightLane, ...resizedFragment].map((element) => [
          element.id,
          element as ExcalidrawElement,
        ]),
      ),
    });

    const label = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "label",
    ) as ExcalidrawTextElement | undefined;
    const conditionLabel = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "condition",
    ) as ExcalidrawTextElement | undefined;
    const elseLabel = synced.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "else",
    ) as ExcalidrawTextElement | undefined;

    expect(label?.fontSize).toBe(44);
    expect(label?.lineHeight).toBe(1.7);
    expect(label?.fontFamily).toBe(FONT_FAMILY.Helvetica);
    expect(conditionLabel?.fontFamily).toBe(FONT_FAMILY.Nunito);
    expect(conditionLabel?.fontSize).toBe(28);
    expect(conditionLabel?.lineHeight).toBe(1.6);
    expect(elseLabel?.fontFamily).toBe(FONT_FAMILY.Cascadia);
    expect(elseLabel?.fontSize).toBe(26);
    expect(elseLabel?.lineHeight).toBe(1.5);
  });

  it("updates fragment lane metadata when dragged to another span without snapping frame geometry", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const middleLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 640,
    })) as OrderedExcalidrawElement[];
    const fragment = convertToExcalidrawElements(
      createSequenceStencil("alt", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 40,
      y: element.y + 120,
    })) as OrderedExcalidrawElement[];

    const firstSync = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...middleLane,
      ...rightLane,
      ...fragment,
    ]);
    const lifelines = firstSync.elements
      .filter((element) => isSequenceLifelineElement(element))
      .sort((a, b) => a.x - b.x);
    const fragmentParts = firstSync.elements.filter((element) =>
      isSequenceFragmentElement(element),
    );
    const outline = fragmentParts.find(
      (element) => element.customData?.sequenceDiagram?.part === "outline",
    )!;

    const secondSync = synchronizeSequenceDiagramElements(
      firstSync.elements.map((element) =>
        element.groupIds[0] === outline.groupIds[0]
          ? ({ ...element, x: element.x + 320 } as OrderedExcalidrawElement)
          : element,
      ),
      { [outline.id]: true },
    );
    const reboundOutline = secondSync.elements.find(
      (element) => element.id === outline.id,
    )!;

    expect(reboundOutline.x).toBe(outline.x + 320);
    expect(reboundOutline.width).toBe(outline.width);
    expect(reboundOutline.customData?.sequenceDiagram?.fromLaneId).toBe(
      getSequenceLaneId(lifelines[1]),
    );
    expect(reboundOutline.customData?.sequenceDiagram?.toLaneId).toBe(
      getSequenceLaneId(lifelines[2]),
    );
  });

  it("preserves fragment width when resizing horizontally from one side", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const fragment = convertToExcalidrawElements(
      createSequenceStencil("alt", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 40,
      y: element.y + 120,
    })) as OrderedExcalidrawElement[];

    const firstSync = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      ...fragment,
    ]);
    const outline = firstSync.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "outline",
    )!;

    const secondSync = synchronizeSequenceDiagramElements(
      firstSync.elements.map((element) =>
        element.id === outline.id
          ? ({
              ...element,
              x: element.x + 60,
              width: element.width - 60,
            } as OrderedExcalidrawElement)
          : element,
      ),
      { [outline.id]: true },
      { resizeHandleType: "w" },
    );
    const resizedOutline = secondSync.elements.find(
      (element) => element.id === outline.id,
    )!;
    const resizedHeader = secondSync.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "header",
    )!;
    const resizedDivider = secondSync.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "divider",
    ) as OrderedExcalidrawElement & ExcalidrawLinearElement;

    expect(resizedOutline.x).toBe(outline.x + 60);
    expect(resizedOutline.width).toBe(outline.width - 60);
    expect(resizedHeader.x).toBe(resizedOutline.x);
    expect(resizedDivider.x).toBe(resizedOutline.x);
    expect(resizedDivider.points[1][0]).toBe(resizedOutline.width);
  });

  it("keeps a dragged alt divider offset instead of snapping back", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const fragment = convertToExcalidrawElements(
      createSequenceStencil("alt", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 40,
      y: element.y + 120,
    })) as OrderedExcalidrawElement[];

    const firstSync = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      ...fragment,
    ]);
    const divider = firstSync.elements.find(
      (element) => element.customData?.sequenceDiagram?.part === "divider",
    ) as OrderedExcalidrawElement & ExcalidrawLinearElement;

    const secondSync = synchronizeSequenceDiagramElements(
      firstSync.elements.map((element) =>
        element.id === divider.id
          ? ({ ...element, y: element.y + 36 } as OrderedExcalidrawElement)
          : element,
      ),
      { [divider.id]: true },
    );
    const shiftedDivider = secondSync.elements.find(
      (element) => element.id === divider.id,
    ) as OrderedExcalidrawElement & ExcalidrawLinearElement;

    expect(shiftedDivider.y).toBe(divider.y + 36);
    expect(shiftedDivider.customData?.sequenceDiagram?.offsetY).toBe(108);
  });

  it("binds note boxes to lanes and keeps them attached when the lane moves", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const note = convertToExcalidrawElements(
      createSequenceStencil("note", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const shiftedNote = {
      ...note,
      x: lifeline.x + 40,
      y: lifeline.y + 80,
    } as OrderedExcalidrawElement;

    const firstSync = synchronizeSequenceDiagramElements([
      ...laneElements,
      shiftedNote,
    ]);
    const syncedLifeline = firstSync.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const syncedNote = firstSync.elements.find((element) =>
      isSequenceNoteElement(element),
    )!;

    expect(getSequenceLaneId(syncedNote)).toBe(
      getSequenceLaneId(syncedLifeline),
    );

    const movedLane = firstSync.elements.map((element) =>
      getSequenceLaneId(element) === getSequenceLaneId(lifeline)
        ? ({ ...element, x: element.x + 100 } as OrderedExcalidrawElement)
        : element,
    );

    const secondSync = synchronizeSequenceDiagramElements(movedLane);
    const movedNote = secondSync.elements.find((element) =>
      isSequenceNoteElement(element),
    )!;
    const movedLifeline = secondSync.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;

    expect(movedNote.x).toBeGreaterThan(movedLifeline.x);
    expect(getSequenceLaneId(movedNote)).toBe(getSequenceLaneId(movedLifeline));
  });

  it("rebinds a selected note when it is dragged to another lane", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const note = convertToExcalidrawElements(
      createSequenceStencil("note", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const firstSync = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      { ...note, x: 40, y: 120 } as OrderedExcalidrawElement,
    ]);
    const lifelines = firstSync.elements
      .filter((element) => isSequenceLifelineElement(element))
      .sort((a, b) => a.x - b.x);
    const syncedNote = firstSync.elements.find((element) =>
      isSequenceNoteElement(element),
    )!;

    const movedNote = {
      ...syncedNote,
      x: lifelines[1].x + 32,
    } as OrderedExcalidrawElement;

    const secondSync = synchronizeSequenceDiagramElements(
      firstSync.elements.map((element) =>
        element.id === movedNote.id ? movedNote : element,
      ),
      { [movedNote.id]: true },
    );
    const reboundNote = secondSync.elements.find((element) =>
      isSequenceNoteElement(element),
    )!;

    expect(getSequenceLaneId(reboundNote)).toBe(
      getSequenceLaneId(lifelines[1]),
    );
  });
});
