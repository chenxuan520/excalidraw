import { convertToExcalidrawElements } from "../../packages/excalidraw";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  createSequenceStencil,
  type SequenceStencilDefaults,
} from "./sequenceStencils";
import { getSequenceParticipantAlignmentGuides } from "./sequenceParticipantAlignment";

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
    expect(guides[0].leftX).toBeLessThan(guides[0].referenceLeftX);
    expect(guides[0].y).toBe(2);
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
    expect(guides[0].y).toBe(1.5);
  });
});
