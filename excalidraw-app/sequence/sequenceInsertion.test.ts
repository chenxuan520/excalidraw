import { convertToExcalidrawElements } from "../../packages/excalidraw";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  getSequenceMessageKindForDirection,
  createSequenceStencil,
  getSequenceElementMeta,
  getSequenceLaneId,
  getSequenceMessageLaneIds,
  isSequenceFragmentElement,
  isSequenceLifelineElement,
  isSequenceMessageElement,
  isSequenceNoteElement,
  type SequenceStencilDefaults,
} from "./sequenceStencils";
import { applySequenceInsertionContext } from "./sequenceInsertion";
import { synchronizeSequenceDiagramElements } from "./sequenceSystem";

const defaults: SequenceStencilDefaults = {
  actor: "角色",
  participant: "参与者",
  service: "服务",
  database: "数据库",
  mq: "消息队列",
  request: "请求",
  response: "响应",
  self: "自调用",
  note: "备注",
  loop: "循环",
  alt: "分支",
};

const createSyncedMessageContext = () => {
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

  const synced = synchronizeSequenceDiagramElements([
    ...leftLane,
    ...rightLane,
    { ...message, x: 80, y: 120 } as OrderedExcalidrawElement,
  ]);

  const syncedMessage = synced.elements.find((element) =>
    isSequenceMessageElement(element),
  )!;

  return {
    sceneElements: synced.elements,
    selectedElementIds: { [syncedMessage.id]: true } as Record<string, true>,
    selectedMessage: syncedMessage,
  };
};

describe("applySequenceInsertionContext", () => {
  it("binds activation insertion to the selected message target lane", () => {
    const context = createSyncedMessageContext();
    const activation = convertToExcalidrawElements(
      createSequenceStencil("activation", "light", defaults),
      { regenerateIds: false },
    );

    const result = applySequenceInsertionContext({
      kind: "activation",
      elements: activation,
      sceneElements: context.sceneElements,
      selectedElementIds: context.selectedElementIds,
    });

    const targetLaneId = getSequenceMessageLaneIds(
      context.selectedMessage,
    ).toLaneId;
    expect(getSequenceLaneId(result[0])).toBe(targetLaneId);
  });

  it("reverses message direction for return insertion from selected message", () => {
    const context = createSyncedMessageContext();
    const returnMessage = convertToExcalidrawElements(
      createSequenceStencil("return", "light", defaults),
      { regenerateIds: false },
    );

    const result = applySequenceInsertionContext({
      kind: "return",
      elements: returnMessage,
      sceneElements: context.sceneElements,
      selectedElementIds: context.selectedElementIds,
    });

    const originalLaneIds = getSequenceMessageLaneIds(context.selectedMessage);
    const nextLaneIds = getSequenceMessageLaneIds(result[0]);

    expect(nextLaneIds.fromLaneId).toBe(originalLaneIds.toLaneId);
    expect(nextLaneIds.toLaneId).toBe(originalLaneIds.fromLaneId);
  });

  it("uses the request direction switch when inserting sync messages across two lanes", () => {
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
    const syncedScene = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
    ]);
    const leftLifeline = syncedScene.elements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const rightLifeline = syncedScene.elements
      .filter((element) => isSequenceLifelineElement(element))
      .sort((a, b) => a.x - b.x)[1]!;
    const message = convertToExcalidrawElements(
      createSequenceStencil("message", "light", defaults, {
        requestDirection: "rtl",
      }),
      { regenerateIds: false },
    );

    const result = applySequenceInsertionContext({
      kind: "message",
      elements: message,
      sceneElements: syncedScene.elements,
      selectedElementIds: {
        [leftLifeline.id]: true,
        [rightLifeline.id]: true,
      },
      requestDirection: "rtl",
    });

    expect(getSequenceMessageLaneIds(result[0])).toEqual({
      fromLaneId: getSequenceLaneId(rightLifeline),
      toLaneId: getSequenceLaneId(leftLifeline),
    });
  });

  it("computes auto message kind from the configured request direction", () => {
    expect(
      getSequenceMessageKindForDirection({
        sourceX: 100,
        targetX: 300,
        requestDirection: "ltr",
      }),
    ).toBe("message");
    expect(
      getSequenceMessageKindForDirection({
        sourceX: 100,
        targetX: 300,
        requestDirection: "rtl",
      }),
    ).toBe("return");
    expect(
      getSequenceMessageKindForDirection({
        sourceX: 300,
        targetX: 100,
        requestDirection: "rtl",
      }),
    ).toBe("message");
  });

  it("does not force a zero-length message when only one lane is selected", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const lifeline = laneElements.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const message = convertToExcalidrawElements(
      createSequenceStencil("message", "light", defaults),
      { regenerateIds: false },
    );

    const result = applySequenceInsertionContext({
      kind: "message",
      elements: message,
      sceneElements: laneElements,
      selectedElementIds: { [lifeline.id]: true },
    });

    expect(getSequenceMessageLaneIds(result[0])).toEqual({
      fromLaneId: undefined,
      toLaneId: undefined,
    });
  });

  it("binds fragment insertion span to the selected message lanes", () => {
    const context = createSyncedMessageContext();
    const fragment = convertToExcalidrawElements(
      createSequenceStencil("alt", "light", defaults),
      { regenerateIds: false },
    );

    const result = applySequenceInsertionContext({
      kind: "alt",
      elements: fragment,
      sceneElements: context.sceneElements,
      selectedElementIds: context.selectedElementIds,
    });

    const originalLaneIds = getSequenceMessageLaneIds(context.selectedMessage);

    result.forEach((element) => {
      const meta = getSequenceElementMeta(element);
      if (meta?.role === "fragment") {
        expect(meta.fromLaneId).toBe(originalLaneIds.fromLaneId);
        expect(meta.toLaneId).toBe(originalLaneIds.toLaneId);
      }
    });
  });

  it("treats selected actor decorations as selecting the whole lane", () => {
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
    const activation = convertToExcalidrawElements(
      createSequenceStencil("activation", "light", defaults),
      { regenerateIds: false },
    );

    const result = applySequenceInsertionContext({
      kind: "activation",
      elements: activation,
      sceneElements: laneElements,
      selectedElementIds: { [decoration.id]: true },
    });

    expect(getSequenceLaneId(result[0])).toBe(getSequenceLaneId(lifeline));
  });

  it("uses the selected note lane as insertion context", () => {
    const laneElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const note = convertToExcalidrawElements(
      createSequenceStencil("note", "light", defaults),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    const syncedScene = synchronizeSequenceDiagramElements([
      ...laneElements,
      { ...note, x: 40, y: 120 } as OrderedExcalidrawElement,
    ]);
    const syncedNote = syncedScene.elements.find((element) =>
      isSequenceNoteElement(element),
    )!;
    const activation = convertToExcalidrawElements(
      createSequenceStencil("activation", "light", defaults),
      { regenerateIds: false },
    );

    const result = applySequenceInsertionContext({
      kind: "activation",
      elements: activation,
      sceneElements: syncedScene.elements,
      selectedElementIds: { [syncedNote.id]: true },
    });

    expect(getSequenceLaneId(result[0])).toBe(getSequenceLaneId(syncedNote));
  });

  it("uses the selected fragment span as insertion context", () => {
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

    const syncedScene = synchronizeSequenceDiagramElements([
      ...leftLane,
      ...rightLane,
      ...fragment,
    ]);
    const selectedFragment = syncedScene.elements.find((element) =>
      isSequenceFragmentElement(element),
    )!;
    const message = convertToExcalidrawElements(
      createSequenceStencil("message", "light", defaults),
      { regenerateIds: false },
    );

    const result = applySequenceInsertionContext({
      kind: "message",
      elements: message,
      sceneElements: syncedScene.elements,
      selectedElementIds: { [selectedFragment.id]: true },
    });

    expect(getSequenceMessageLaneIds(result[0])).toEqual({
      fromLaneId: selectedFragment.customData?.sequenceDiagram?.fromLaneId,
      toLaneId: selectedFragment.customData?.sequenceDiagram?.toLaneId,
    });
  });
});
