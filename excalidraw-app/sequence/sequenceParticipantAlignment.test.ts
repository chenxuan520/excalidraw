import { convertToExcalidrawElements } from "../../packages/excalidraw";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  createSequenceStencil,
  type SequenceStencilDefaults,
} from "./sequenceStencils";
import {
  getSequenceParticipantAlignmentGuides,
  getSequenceParticipantAlignmentSnapTargets,
} from "./sequenceParticipantAlignment";

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

describe("getSequenceParticipantAlignmentGuides", () => {
  it("returns a top-alignment guide for nearby participant headers", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("service", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
      y: element.y + 4,
    })) as OrderedExcalidrawElement[];

    const selectedIds = Object.fromEntries(
      rightLane.map((element) => [element.id, true]),
    ) as Record<string, true>;
    const guides = getSequenceParticipantAlignmentGuides({
      elements: [...leftLane, ...rightLane],
      selectedElementIds: selectedIds,
      zoomValue: 1,
    });

    expect(guides).toHaveLength(1);
    expect(guides[0]).toMatchObject({ edge: "top", position: 0 });
  });

  it("supports selecting a decorative actor member to resolve the lane", () => {
    const actorLane = convertToExcalidrawElements(
      createSequenceStencil("actor", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const dbLane = convertToExcalidrawElements(
      createSequenceStencil("database", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
      y: element.y + 3,
    })) as OrderedExcalidrawElement[];

    const actorArm = actorLane.find((element) => element.type === "line");
    expect(actorArm).toBeDefined();

    const guides = getSequenceParticipantAlignmentGuides({
      elements: [...actorLane, ...dbLane],
      selectedElementIds: { [actorArm!.id]: true },
      zoomValue: 1,
    });

    expect(guides).toHaveLength(1);
    expect(guides[0]).toMatchObject({ edge: "top", position: 3 });
  });

  it("returns left and right guides for nearby participant sides", () => {
    const topLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const bottomLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 4,
      y: element.y + 240,
    })) as OrderedExcalidrawElement[];

    const guides = getSequenceParticipantAlignmentGuides({
      elements: [...topLane, ...bottomLane],
      selectedElementIds: Object.fromEntries(
        bottomLane.map((element) => [element.id, true]),
      ) as Record<string, true>,
      zoomValue: 1,
    });

    expect(guides.map((guide) => guide.edge).sort()).toEqual(["left", "right"]);
  });

  it("returns snap targets only when a lane is close enough to align", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const nearLane = convertToExcalidrawElements(
      createSequenceStencil("service", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
      y: element.y + 4,
    })) as OrderedExcalidrawElement[];
    const farLane = convertToExcalidrawElements(
      createSequenceStencil("service", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 640,
      y: element.y + 18,
    })) as OrderedExcalidrawElement[];

    const nearTargets = getSequenceParticipantAlignmentSnapTargets({
      elements: [...leftLane, ...nearLane],
      selectedElementIds: Object.fromEntries(
        nearLane.map((element) => [element.id, true]),
      ) as Record<string, true>,
      zoomValue: 1,
    });
    const farTargets = getSequenceParticipantAlignmentSnapTargets({
      elements: [...leftLane, ...farLane],
      selectedElementIds: Object.fromEntries(
        farLane.map((element) => [element.id, true]),
      ) as Record<string, true>,
      zoomValue: 1,
    });

    expect([...nearTargets.values()]).toEqual([0]);
    expect(farTargets.size).toBe(0);
  });

  it("does not return alignment guides for lanes that are too far apart", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const farLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 900,
      y: element.y + 4,
    })) as OrderedExcalidrawElement[];

    const guides = getSequenceParticipantAlignmentGuides({
      elements: [...leftLane, ...farLane],
      selectedElementIds: Object.fromEntries(
        farLane.map((element) => [element.id, true]),
      ) as Record<string, true>,
      zoomValue: 1,
    });
    const snapTargets = getSequenceParticipantAlignmentSnapTargets({
      elements: [...leftLane, ...farLane],
      selectedElementIds: Object.fromEntries(
        farLane.map((element) => [element.id, true]),
      ) as Record<string, true>,
      zoomValue: 1,
    });

    expect(guides).toHaveLength(0);
    expect(snapTargets.size).toBe(0);
  });
});
