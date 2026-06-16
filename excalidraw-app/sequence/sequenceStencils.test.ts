import { convertToExcalidrawElements } from "../../packages/excalidraw";
import { FONT_FAMILY } from "../../packages/excalidraw/constants";
import type { ExcalidrawElementSkeleton } from "../../packages/excalidraw/data/transform";
import {
  SEQUENCE_ACCENT_FILL,
  SEQUENCE_FRAGMENT_CONDITION_TEXT,
  SEQUENCE_FRAGMENT_ELSE_TEXT,
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

  it("creates async messages as solid open arrows", () => {
    const asyncMessage = createSequenceStencil("async", "light", defaults)[0] as {
      strokeStyle: string;
      endArrowhead: string;
      customData?: {
        sequenceDiagram?: {
          variant?: string;
        };
      };
    };

    expect(asyncMessage.strokeStyle).toBe("solid");
    expect(asyncMessage.endArrowhead).toBe("arrow");
    expect(asyncMessage.customData?.sequenceDiagram?.variant).toBe("async");
  });

  it("uses one shared accent fill for activations", () => {
    const activation = createSequenceStencil("activation", "light", defaults)[0] as {
      backgroundColor: string;
    };

    expect(activation.backgroundColor).toBe(SEQUENCE_ACCENT_FILL);
  });

  it("creates loop and alt placeholder labels", () => {
    const loop = createSequenceStencil("loop", "light", defaults);
    const alt = createSequenceStencil("alt", "light", defaults);

    expect(
      loop.some(
        (element) =>
          element.type === "text" &&
          element.customData?.sequenceDiagram?.part === "condition" &&
          element.text === SEQUENCE_FRAGMENT_CONDITION_TEXT,
      ),
    ).toBe(true);
    expect(
      alt.some(
        (element) =>
          element.type === "text" &&
          element.customData?.sequenceDiagram?.part === "condition" &&
          element.text === SEQUENCE_FRAGMENT_CONDITION_TEXT,
      ),
    ).toBe(true);
    expect(
      alt.some(
        (element) =>
          element.type === "text" &&
          element.customData?.sequenceDiagram?.part === "else" &&
          element.text === SEQUENCE_FRAGMENT_ELSE_TEXT,
      ),
    ).toBe(true);
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

  it("keeps sequence return arrows open while using a solid line", () => {
    const returnArrow = createSequenceStencil("return", "light", defaults)[0] as {
      strokeStyle: string;
      endArrowhead: string;
      customData?: {
        sequenceDiagram?: {
          variant?: string;
        };
      };
    };

    expect(returnArrow.strokeStyle).toBe("dotted");
    expect(returnArrow.endArrowhead).toBe("arrow");
    expect(returnArrow.customData?.sequenceDiagram?.variant).toBe("return");
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

  it("keeps circular participants visually compact", () => {
    const boundaryElements = convertToExcalidrawElements(
      createSequenceStencil("boundary", "light", defaults),
      { regenerateIds: false },
    );

    const circle = boundaryElements.find(
      (element) => element.id.startsWith("sequence-participant-"),
    )!;
    const label = boundaryElements.find(
      (element) => element.type === "text" && !element.containerId,
    )!;
    const lifeline = boundaryElements.find(
      (element) => element.id.startsWith("sequence-lifeline-"),
    )!;

    expect(label.y - (circle.y + circle.height)).toBeLessThanOrEqual(18);
    expect(lifeline.y - (label.y + label.height)).toBeLessThanOrEqual(12);
  });
});
