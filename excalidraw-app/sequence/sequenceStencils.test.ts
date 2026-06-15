import { convertToExcalidrawElements } from "../../packages/excalidraw";
import { FONT_FAMILY } from "../../packages/excalidraw/constants";
import type { ExcalidrawElementSkeleton } from "../../packages/excalidraw/data/transform";
import { createSequenceStencil, type SequenceStencilDefaults } from "./sequenceStencils";

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

describe("createSequenceStencil", () => {
  it("uses the same participant palette in dark theme as light theme", () => {
    const participant = createSequenceStencil(
      "participant",
      "dark",
      defaults,
    ).find(
      (element): element is ExcalidrawElementSkeleton & {
        type: "rectangle";
        backgroundColor: string;
        strokeColor: string;
        label: { strokeColor: string };
      } => element.type === "rectangle",
    );

    expect(participant).toBeDefined();
    expect(participant!.backgroundColor).toBe("#eef3ff");
    expect(participant!.strokeColor).toBe("#2f3441");
    expect(participant!.label.strokeColor).toBe("#1f2328");
  });

  it("uses surface colors for actors in dark theme", () => {
    const actor = createSequenceStencil("actor", "dark", defaults)[0] as {
      strokeColor: string;
    };

    expect(actor.strokeColor).toBe("#2f3441");
  });

  it("uses the same message colors in dark theme as light theme", () => {
    const message = createSequenceStencil("message", "dark", defaults)[0] as {
      strokeColor: string;
      label: { strokeColor: string };
    };

    expect(message.strokeColor).toBe("#2f3441");
    expect(message.label.strokeColor).toBe("#1f2328");
  });

  it("keeps converted arrow labels on the light-theme text color in dark mode", () => {
    const converted = convertToExcalidrawElements(
      createSequenceStencil("message", "dark", defaults),
      { regenerateIds: false },
    );

    const arrow = converted.find((element) => element.type === "arrow") as {
      strokeColor: string;
    } | undefined;
    const label = converted.find(
      (element) => element.type === "text" && element.containerId,
    ) as { strokeColor: string; fontFamily: number } | undefined;

    expect(arrow?.strokeColor).toBe("#2f3441");
    expect(label?.strokeColor).toBe("#1f2328");
  });

  it("defaults sequence text to Comic Shanns", () => {
    const participant = createSequenceStencil(
      "participant",
      "light",
      defaults,
    ).find(
      (element): element is ExcalidrawElementSkeleton & {
        type: "rectangle";
        label: { fontFamily: number };
      } => element.type === "rectangle",
    );

    expect(participant?.label.fontFamily).toBe(FONT_FAMILY["Comic Shanns"]);
  });
});
