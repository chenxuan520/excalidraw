import {
  FONT_FAMILY,
  ROUNDNESS,
} from "../../packages/excalidraw/constants";
import type { ExcalidrawElementSkeleton } from "../../packages/excalidraw/data/transform";
import { getLineHeight } from "../../packages/excalidraw/fonts";
import { measureText } from "../../packages/excalidraw/element/textElement";
import type { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import type { Theme } from "../../packages/excalidraw/element/types";
import { getFontString } from "../../packages/excalidraw/utils";

export const SEQUENCE_DIAGRAM_SIDEBAR_TAB = "sequence-diagram";

export type SequenceRequestDirection = "ltr" | "rtl";

export const DEFAULT_SEQUENCE_REQUEST_DIRECTION: SequenceRequestDirection =
  "ltr";

export type SequenceStencilDefaults = {
  actor: string;
  participant: string;
  service: string;
  database: string;
  mq: string;
  request: string;
  response: string;
  self: string;
  note: string;
  loop: string;
  alt: string;
};

type SequenceElementRole =
  | "participant"
  | "lifeline"
  | "message"
  | "activation"
  | "note"
  | "fragment";

type SequenceElementMeta = {
  sequenceDiagram?: {
    role: SequenceElementRole;
    laneId?: string;
    fromLaneId?: string;
    toLaneId?: string;
    fromActivationId?: string;
    toActivationId?: string;
    part?: string;
    offsetX?: number;
    offsetY?: number;
    topOffset?: number;
    variant?: string;
  };
};

export type SequenceStencilKind =
  | "blank"
  | "actor"
  | "participant"
  | "service"
  | "database"
  | "mq"
  | "message"
  | "return"
  | "self"
  | "activation"
  | "note"
  | "loop"
  | "alt";

export const getSequenceMessageKindForDirection = ({
  sourceX,
  targetX,
  requestDirection,
}: {
  sourceX: number;
  targetX: number;
  requestDirection: SequenceRequestDirection;
}) => {
  const requestToRight = requestDirection === "ltr";
  const targetToRight = targetX >= sourceX;
  return targetToRight === requestToRight ? "message" : "return";
};

export const getSequenceMessageReverse = (
  kind: Extract<SequenceStencilKind, "message" | "return">,
  requestDirection: SequenceRequestDirection,
) => {
  const requestToRight = requestDirection === "ltr";
  return kind === "message" ? !requestToRight : requestToRight;
};

export const sequenceStencilSections: {
  key: "templates" | "participants" | "messages" | "helpers";
  items: SequenceStencilKind[];
}[] = [
  { key: "templates", items: ["blank"] },
  {
    key: "participants",
    items: ["actor", "service", "participant", "database", "mq"],
  },
  { key: "messages", items: ["message", "return", "self"] },
  { key: "helpers", items: ["activation", "note", "loop", "alt"] },
];

type Palette = {
  stroke: string;
  mutedStroke: string;
  text: string;
  surfaceStroke: string;
  surfaceText: string;
  boxFill: string;
  accentFill: string;
  activationFill: string;
  noteFill: string;
  noteStroke: string;
  fragmentStroke: string;
};

export const SEQUENCE_PARTICIPANT_HEIGHT = 48;
const LIFELINE_HEIGHT = 340;
export const SEQUENCE_TEXT_FONT_SIZE = 16;
const FONT = FONT_FAMILY["Comic Shanns"];
export const SEQUENCE_TEXT_LINE_HEIGHT = getLineHeight(FONT);
export const SEQUENCE_TEXT_FONT_FAMILY = FONT;
const DEFAULT_FONT = getFontString({
  fontSize: SEQUENCE_TEXT_FONT_SIZE,
  fontFamily: FONT,
});
export const SEQUENCE_FRAGMENT_HEADER_HEIGHT = 28;
export const SEQUENCE_SELF_CALL_HEIGHT = 54;
const SEQUENCE_FRAGMENT_HEADER_PADDING_X = 12;

const getPalette = (_theme: Theme): Palette => {
  return {
    stroke: "#2f3441",
    mutedStroke: "#98a2b3",
    text: "#1f2328",
    surfaceStroke: "#2f3441",
    surfaceText: "#1f2328",
    boxFill: "#ffffff",
    accentFill: "#eef3ff",
    activationFill: "#e8eefc",
    noteFill: "#fff8d9",
    noteStroke: "#ad7a00",
    fragmentStroke: "#94a3b8",
  };
};

const createGroupId = (prefix: string) => {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
};

const createSequenceId = (role: string, laneId?: string) => {
  const suffix = Math.random().toString(36).slice(2, 10);
  return laneId
    ? `sequence-${role}-${laneId}-${suffix}`
    : `sequence-${role}-${suffix}`;
};

const parseSequenceLaneIdFromId = (id: string | null | undefined) => {
  if (!id?.startsWith("sequence-")) {
    return undefined;
  }
  const parts = id.split("-");
  if (parts.length < 4) {
    return undefined;
  }
  if (parts[1] !== "lifeline" && parts[1] !== "participant") {
    return undefined;
  }
  return parts.slice(2, -1).join("-") || undefined;
};

const createSequenceMeta = (
  role: SequenceElementRole,
  laneId?: string,
  extra?: Omit<
    NonNullable<SequenceElementMeta["sequenceDiagram"]>,
    "role" | "laneId"
  >,
): SequenceElementMeta => ({
  sequenceDiagram: {
    role,
    laneId,
    ...extra,
  },
});

export const getSequenceElementMeta = (
  element: Pick<ExcalidrawElement, "customData">,
) => {
  return element.customData?.sequenceDiagram;
};

export const isSequenceActivationElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return element?.customData?.sequenceDiagram?.role === "activation";
};

export const isSequenceMessageElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return element?.customData?.sequenceDiagram?.role === "message";
};

export const isSequenceNoteElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return element?.customData?.sequenceDiagram?.role === "note";
};

export const isSequenceFragmentElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return element?.customData?.sequenceDiagram?.role === "fragment";
};

export const getSequenceFragmentMeta = (
  element: Pick<ExcalidrawElement, "customData">,
) => {
  const meta = element.customData?.sequenceDiagram;
  if (meta?.role !== "fragment") {
    return undefined;
  }
  return meta;
};

export const isSequenceLifelineElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return (
    element?.customData?.sequenceDiagram?.role === "lifeline" ||
    element?.id?.startsWith("sequence-lifeline-") === true
  );
};

export const isSequenceParticipantElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return (
    element?.customData?.sequenceDiagram?.role === "participant" ||
    element?.id?.startsWith("sequence-participant-") === true
  );
};

export const getSequenceLaneId = (
  element: Pick<ExcalidrawElement, "customData" | "id">,
) => {
  return (
    (element.customData?.sequenceDiagram?.laneId as string | undefined) ||
    parseSequenceLaneIdFromId(element.id)
  );
};

export const getSequenceMessageLaneIds = (
  element: Pick<ExcalidrawElement, "customData">,
) => {
  return {
    fromLaneId: element.customData?.sequenceDiagram?.fromLaneId as
      | string
      | undefined,
    toLaneId: element.customData?.sequenceDiagram?.toLaneId as
      | string
      | undefined,
  };
};

export const getSequenceMessageActivationIds = (
  element: Pick<ExcalidrawElement, "customData">,
) => {
  return {
    fromActivationId: element.customData?.sequenceDiagram?.fromActivationId as
      | string
      | undefined,
    toActivationId: element.customData?.sequenceDiagram?.toActivationId as
      | string
      | undefined,
  };
};

const makeTextStyle = (palette: Palette) => ({
  fontFamily: FONT,
  fontSize: SEQUENCE_TEXT_FONT_SIZE,
  lineHeight: SEQUENCE_TEXT_LINE_HEIGHT,
  strokeColor: palette.text,
});

const makeCenteredLabel = (label: string, palette: Palette) => ({
  text: label,
  ...makeTextStyle({ ...palette, text: palette.surfaceText }),
  textAlign: "center" as const,
  verticalAlign: "middle" as const,
});

const createCenteredText = ({
  id,
  x,
  y,
  width,
  height,
  label,
  palette,
  groupId,
  customData,
  textColor,
}: {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  palette: Palette;
  groupId: string;
  customData?: SequenceElementMeta;
  textColor?: string;
}) => {
  const metrics = measureText(label, DEFAULT_FONT, SEQUENCE_TEXT_LINE_HEIGHT);

  return {
    type: "text",
    ...(id ? { id } : null),
    x: x + Math.max((width - metrics.width) / 2, 0),
    y: y + Math.max((height - metrics.height) / 2, 0),
    text: label,
    ...makeTextStyle({ ...palette, text: textColor ?? palette.text }),
    groupIds: [groupId],
    ...(customData ? { customData } : null),
  } as ExcalidrawElementSkeleton;
};

const createLifeline = (
  laneId: string,
  groupId: string,
  x: number,
  y: number,
  palette: Palette,
) => {
  return {
    type: "line",
    id: createSequenceId("lifeline", laneId),
    x,
    y,
    width: 1,
    height: LIFELINE_HEIGHT,
    points: [
      [0, 0],
      [0, LIFELINE_HEIGHT],
    ],
    strokeColor: palette.mutedStroke,
    strokeWidth: 2,
    strokeStyle: "dotted",
    roughness: 0,
    groupIds: [groupId],
    customData: createSequenceMeta("lifeline", laneId, { topOffset: y }),
  } as ExcalidrawElementSkeleton;
};

const createParticipant = (
  id: string,
  x: number,
  label: string,
  palette: Palette,
  opts?: { rounded?: boolean; width?: number; fill?: string },
) => {
  const groupId = createGroupId(id);
  const laneId = `${id}-lane`;
  const width = opts?.width ?? 140;
  const fill = opts?.fill ?? palette.accentFill;

  return [
    {
      type: "rectangle",
      id: createSequenceId("participant", laneId),
      x,
      y: 0,
      width,
      height: SEQUENCE_PARTICIPANT_HEIGHT,
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: fill,
      roughness: 0,
      roundness: opts?.rounded
        ? { type: ROUNDNESS.ADAPTIVE_RADIUS }
        : undefined,
      groupIds: [groupId],
      customData: createSequenceMeta("participant", laneId),
      label: {
        ...makeCenteredLabel(label, palette),
      },
    },
    createLifeline(
      laneId,
      groupId,
      x + width / 2,
      SEQUENCE_PARTICIPANT_HEIGHT,
      palette,
    ),
  ] as ExcalidrawElementSkeleton[];
};

const createActor = (
  id: string,
  x: number,
  label: string,
  palette: Palette,
) => {
  const groupId = createGroupId(id);
  const laneId = `${id}-lane`;
  return [
    {
      type: "ellipse",
      id: createSequenceId("participant", laneId),
      x: x + 34,
      y: 0,
      width: 28,
      height: 28,
      strokeColor: palette.surfaceStroke,
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
      customData: createSequenceMeta("participant", laneId),
    },
    {
      type: "line",
      x: x + 48,
      y: 28,
      width: 1,
      height: 26,
      points: [
        [0, 0],
        [0, 26],
      ],
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "line",
      x: x + 32,
      y: 40,
      width: 32,
      height: 1,
      points: [
        [0, 0],
        [32, 0],
      ],
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "line",
      x: x + 34,
      y: 54,
      width: 14,
      height: 18,
      points: [
        [14, 0],
        [0, 18],
      ],
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "line",
      x: x + 48,
      y: 54,
      width: 14,
      height: 18,
      points: [
        [0, 0],
        [14, 18],
      ],
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    createCenteredText({
      x,
      y: 78,
      width: 96,
      height: 28,
      label,
      palette,
      textColor: palette.surfaceText,
      groupId,
    }),
    createLifeline(laneId, groupId, x + 48, 108, palette),
  ] as ExcalidrawElementSkeleton[];
};

const createDatabase = (
  id: string,
  x: number,
  label: string,
  palette: Palette,
) => {
  const groupId = createGroupId(id);
  const laneId = `${id}-lane`;
  const width = 116;
  const bodyY = 14;
  const bodyHeight = 44;
  return [
    {
      type: "rectangle",
      id: createSequenceId("participant", laneId),
      x,
      y: bodyY,
      width,
      height: bodyHeight,
      strokeColor: "transparent",
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: palette.accentFill,
      roughness: 0,
      groupIds: [groupId],
      customData: createSequenceMeta("participant", laneId),
      label: {
        ...makeCenteredLabel(label, palette),
      },
    },
    {
      type: "ellipse",
      x,
      y: 0,
      width,
      height: 28,
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: palette.accentFill,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "line",
      x,
      y: bodyY,
      width: 1,
      height: bodyHeight,
      points: [
        [0, 0],
        [0, bodyHeight],
      ],
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "line",
      x: x + width,
      y: bodyY,
      width: 1,
      height: bodyHeight,
      points: [
        [0, 0],
        [0, bodyHeight],
      ],
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "ellipse",
      x,
      y: bodyY + bodyHeight - 14,
      width,
      height: 28,
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: palette.accentFill,
      roughness: 0,
      groupIds: [groupId],
    },
    createLifeline(laneId, groupId, x + width / 2, 74, palette),
  ] as ExcalidrawElementSkeleton[];
};

const createMq = (
  id: string,
  x: number,
  label: string,
  palette: Palette,
) => {
  const groupId = createGroupId(id);
  const laneId = `${id}-lane`;
  const width = 156;
  const capWidth = 28;
  const bodyX = x + capWidth / 2;
  const bodyWidth = width - capWidth;

  return [
    {
      type: "rectangle",
      id: createSequenceId("participant", laneId),
      x: bodyX,
      y: 0,
      width: bodyWidth,
      height: SEQUENCE_PARTICIPANT_HEIGHT,
      strokeColor: "transparent",
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: palette.accentFill,
      roughness: 0,
      groupIds: [groupId],
      customData: createSequenceMeta("participant", laneId),
      label: {
        ...makeCenteredLabel(label, palette),
      },
    },
    {
      type: "ellipse",
      x,
      y: 0,
      width: capWidth,
      height: SEQUENCE_PARTICIPANT_HEIGHT,
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: palette.accentFill,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "ellipse",
      x: x + width - capWidth,
      y: 0,
      width: capWidth,
      height: SEQUENCE_PARTICIPANT_HEIGHT,
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: palette.accentFill,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "line",
      x: bodyX,
      y: 0,
      width: bodyWidth,
      height: 0,
      points: [
        [0, 0],
        [bodyWidth, 0],
      ],
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "line",
      x: bodyX,
      y: SEQUENCE_PARTICIPANT_HEIGHT,
      width: bodyWidth,
      height: 0,
      points: [
        [0, 0],
        [bodyWidth, 0],
      ],
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    createLifeline(
      laneId,
      groupId,
      x + width / 2,
      SEQUENCE_PARTICIPANT_HEIGHT,
      palette,
    ),
  ] as ExcalidrawElementSkeleton[];
};

const createMessageArrow = (
  label: string,
  palette: Palette,
  opts?: { dotted?: boolean; self?: boolean; reverse?: boolean },
) => {
  const base = {
    type: "arrow",
    id: createSequenceId("message"),
    x: 0,
    y: 0,
    strokeColor: palette.stroke,
    strokeWidth: 2,
    roughness: 0,
    strokeStyle: opts?.dotted ? "dotted" : "solid",
    endArrowhead: opts?.dotted ? "arrow" : "triangle",
    label: {
      text: label,
      ...makeTextStyle(palette),
    },
    customData: createSequenceMeta("message", undefined, {
      variant: opts?.self ? "self" : opts?.dotted ? "return" : "message",
    }),
  } as const;

  if (opts?.self) {
    return {
      ...base,
      width: 90,
      height: 60,
      points: [
        [0, 0],
        [90, 0],
        [90, 50],
        [0, 50],
      ],
    } as ExcalidrawElementSkeleton;
  }

  return {
    ...base,
    width: 180,
    height: 1,
    points: [
      opts?.reverse ? [180, 0] : [0, 0],
      opts?.reverse ? [0, 0] : [180, 0],
    ],
  } as ExcalidrawElementSkeleton;
};

const createActivation = (palette: Palette) => {
  return [
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: 18,
      height: 140,
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      backgroundColor: palette.activationFill,
      fillStyle: "solid",
      roughness: 0,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
      customData: createSequenceMeta("activation"),
    },
  ] as ExcalidrawElementSkeleton[];
};

export const createSequenceActivationStencil = ({
  centerX,
  y,
  height,
  theme,
  laneId,
}: {
  centerX: number;
  y: number;
  height?: number;
  theme: Theme;
  laneId?: string;
}): ExcalidrawElementSkeleton[] => {
  const palette = getPalette(theme);
  const activationHeight = height ?? 88;
  return [
    {
      type: "rectangle",
      id: createSequenceId("activation", laneId),
      x: centerX - 9,
      y,
      width: 18,
      height: activationHeight,
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      backgroundColor: palette.activationFill,
      fillStyle: "solid",
      roughness: 0,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
      customData: createSequenceMeta("activation", laneId),
    },
  ];
};

const createNote = (palette: Palette, label: string) => {
  return [
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: 180,
      height: 96,
      strokeColor: palette.noteStroke,
      strokeWidth: 2,
      backgroundColor: palette.noteFill,
      fillStyle: "solid",
      roughness: 0,
      roundness: { type: ROUNDNESS.ADAPTIVE_RADIUS },
      customData: createSequenceMeta("note"),
      label: {
        text: label,
        ...makeTextStyle({ ...palette, text: palette.noteStroke }),
        textAlign: "left",
        verticalAlign: "top",
      },
    },
  ] as ExcalidrawElementSkeleton[];
};

const getFragmentHeaderMinWidth = (
  kind: Extract<SequenceStencilKind, "loop" | "alt">,
) => {
  return kind === "alt" ? 62 : 74;
};

export const getSequenceFragmentHeaderWidth = (
  kind: Extract<SequenceStencilKind, "loop" | "alt">,
  labelWidth?: number,
) => {
  return Math.max(
    getFragmentHeaderMinWidth(kind),
    typeof labelWidth === "number"
      ? Math.ceil(labelWidth + SEQUENCE_FRAGMENT_HEADER_PADDING_X * 2)
      : 0,
  );
};

export const measureSequenceText = (text: string) => {
  return measureText(text, DEFAULT_FONT, SEQUENCE_TEXT_LINE_HEIGHT);
};

const createFragment = (
  kind: Extract<SequenceStencilKind, "loop" | "alt">,
  label: string,
  palette: Palette,
) => {
  const fragmentGroupId = createGroupId(`fragment-${kind}`);
  const headerWidth = getSequenceFragmentHeaderWidth(
    kind,
    measureSequenceText(label).width,
  );

  const elements: ExcalidrawElementSkeleton[] = [
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: 280,
      height: 180,
      strokeColor: palette.fragmentStroke,
      strokeWidth: 2,
      strokeStyle: "solid",
      backgroundColor: "transparent",
      fillStyle: "solid",
      roughness: 0,
      customData: createSequenceMeta("fragment", undefined, {
        variant: kind,
        part: "outline",
      }),
      groupIds: [fragmentGroupId],
    },
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: headerWidth,
      height: SEQUENCE_FRAGMENT_HEADER_HEIGHT,
      strokeColor: palette.surfaceStroke,
      strokeWidth: 2,
      backgroundColor: palette.accentFill,
      fillStyle: "solid",
      roughness: 0,
      customData: createSequenceMeta("fragment", undefined, {
        variant: kind,
        part: "header",
      }),
      groupIds: [fragmentGroupId],
    },
    createCenteredText({
      id: createSequenceId("fragment"),
      x: 0,
      y: 0,
      width: headerWidth,
      height: SEQUENCE_FRAGMENT_HEADER_HEIGHT,
      label,
      palette,
      groupId: fragmentGroupId,
      textColor: palette.surfaceText,
      customData: createSequenceMeta("fragment", undefined, {
        variant: kind,
        part: "label",
      }),
    }),
  ];

  if (kind === "alt") {
    elements.push({
      type: "line",
      x: 0,
      y: 72,
      width: 280,
      height: 0,
      points: [
        [0, 0],
        [280, 0],
      ],
      strokeColor: palette.fragmentStroke,
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      groupIds: [fragmentGroupId],
      customData: createSequenceMeta("fragment", undefined, {
        variant: kind,
        part: "divider",
        offsetY: 72,
      }),
    });
  }

  return elements;
};

export const createSequenceStencil = (
  kind: SequenceStencilKind,
  theme: Theme,
  defaults: SequenceStencilDefaults,
  options?: {
    requestDirection?: SequenceRequestDirection;
  },
): ExcalidrawElementSkeleton[] => {
  const palette = getPalette(theme);
  const requestDirection =
    options?.requestDirection ?? DEFAULT_SEQUENCE_REQUEST_DIRECTION;

  switch (kind) {
    case "blank":
      return [
        ...createActor("blank-actor", 0, defaults.actor, palette),
        ...createParticipant("blank-service", 220, defaults.service, palette, {
          fill: palette.accentFill,
          rounded: true,
          width: 148,
        }),
        ...createDatabase("blank-database", 470, defaults.database, palette),
      ];
    case "actor":
      return createActor("actor", 0, defaults.actor, palette);
    case "participant":
      return createParticipant("participant", 0, defaults.participant, palette);
    case "service":
      return createParticipant("service", 0, defaults.service, palette, {
        fill: palette.accentFill,
        rounded: true,
        width: 148,
      });
    case "database":
      return createDatabase("database", 0, defaults.database, palette);
    case "mq":
      return createMq("mq", 0, defaults.mq, palette);
    case "message":
      return [
        createMessageArrow(defaults.request, palette, {
          reverse: getSequenceMessageReverse("message", requestDirection),
        }),
      ];
    case "return":
      return [
        createMessageArrow(defaults.response, palette, {
          dotted: true,
          reverse: getSequenceMessageReverse("return", requestDirection),
        }),
      ];
    case "self":
      return [createMessageArrow(defaults.self, palette, { self: true })];
    case "activation":
      return createActivation(palette);
    case "note":
      return createNote(palette, defaults.note);
    case "loop":
      return createFragment("loop", defaults.loop, palette);
    case "alt":
      return createFragment("alt", defaults.alt, palette);
    default:
      return [];
  }
};
