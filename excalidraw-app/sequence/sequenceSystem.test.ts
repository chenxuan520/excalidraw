import { convertToExcalidrawElements } from "../../packages/excalidraw";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  createSequenceActivationStencil,
  createSequenceStencil,
  getSequenceLaneId,
  isSequenceActivationElement,
  isSequenceLifelineElement,
  type SequenceStencilDefaults,
} from "./sequenceStencils";
import { synchronizeSequenceDiagramElements } from "./sequenceSystem";

const defaults: SequenceStencilDefaults = {
  actor: "角色",
  participant: "参与者",
  service: "服务",
  database: "数据库",
  request: "请求",
  response: "响应",
  self: "自调用",
  note: "备注",
  loop: "循环",
  alt: "分支",
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
});
