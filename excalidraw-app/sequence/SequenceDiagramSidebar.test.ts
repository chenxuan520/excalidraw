import { convertToExcalidrawElements } from "../../packages/excalidraw";
import {
  getSequenceDragAnchor,
  getSequencePasteAnchor,
} from "./SequenceDiagramSidebar";
import {
  createSequenceStencil,
  type SequenceStencilDefaults,
} from "./sequenceStencils";

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

describe("getSequenceDragAnchor", () => {
  it("uses the top center for participant-like stencils", () => {
    const serviceElements = convertToExcalidrawElements(
      createSequenceStencil("service", "light", defaults),
      { regenerateIds: false },
    );

    expect(getSequenceDragAnchor("service", serviceElements)).toEqual({
      x: 74,
      y: 0,
    });
  });

  it("normalizes top anchor for circular participant stencils", () => {
    const boundaryElements = convertToExcalidrawElements(
      createSequenceStencil("boundary", "light", defaults),
      { regenerateIds: false },
    );

    expect(getSequenceDragAnchor("boundary", boundaryElements)).toEqual({
      x: 16,
      y: 0,
    });
  });

  it("does not customize drag anchor for message stencils", () => {
    const messageElements = convertToExcalidrawElements(
      createSequenceStencil("message", "light", defaults),
      { regenerateIds: false },
    );

    expect(getSequenceDragAnchor("message", messageElements)).toBeUndefined();
  });

  it("uses the top center for pasted single-lane participants", () => {
    const participantElements = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    );

    expect(getSequencePasteAnchor(participantElements)).toEqual({
      x: 70,
      y: 0,
    });
  });

  it("uses the top center for pasted multi-lane participants", () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    );
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    }));

    expect(getSequencePasteAnchor([...leftLane, ...rightLane])).toEqual({
      x: 230,
      y: 0,
    });
  });

  it("does not customize paste anchor for mixed sequence and non-sequence selections", () => {
    const lane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    );
    const rectangle = convertToExcalidrawElements([
      {
        type: "rectangle",
        x: 260,
        y: 80,
        width: 120,
        height: 60,
      },
    ]);

    expect(getSequencePasteAnchor([...lane, ...rectangle])).toBeUndefined();
  });
});
