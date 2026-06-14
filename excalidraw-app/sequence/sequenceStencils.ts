import {
  FONT_FAMILY,
  ROUNDNESS,
  THEME,
} from "../../packages/excalidraw/constants";
import type { ExcalidrawElementSkeleton } from "../../packages/excalidraw/data/transform";
import type { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import type { Theme } from "../../packages/excalidraw/element/types";

export const SEQUENCE_DIAGRAM_SIDEBAR_TAB = "sequence-diagram";

export type SequenceStencilDefaults = {
  actor: string;
  participant: string;
  service: string;
  database: string;
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
  | "message"
  | "return"
  | "self"
  | "activation"
  | "note"
  | "loop"
  | "alt";

export const sequenceStencilSections: {
  key: "templates" | "participants" | "messages" | "helpers";
  items: SequenceStencilKind[];
}[] = [
  { key: "templates", items: ["blank"] },
  {
    key: "participants",
    items: ["actor", "participant", "service", "database"],
  },
  { key: "messages", items: ["message", "return", "self"] },
  { key: "helpers", items: ["activation", "note", "loop", "alt"] },
];

type Palette = {
  stroke: string;
  mutedStroke: string;
  text: string;
  boxFill: string;
  accentFill: string;
  activationFill: string;
  noteFill: string;
  noteStroke: string;
  fragmentStroke: string;
};

const PARTICIPANT_HEIGHT = 48;
const LIFELINE_HEIGHT = 340;
const DEFAULT_FONT_SIZE = 16;
const FONT = FONT_FAMILY.Yutong;

const getPalette = (theme: Theme): Palette => {
  if (theme === THEME.DARK) {
    return {
      stroke: "#e5e7eb",
      mutedStroke: "#98a2b3",
      text: "#f8fafc",
      boxFill: "#2b2f3a",
      accentFill: "#31384b",
      activationFill: "#46506b",
      noteFill: "#5c4a12",
      noteStroke: "#facc15",
      fragmentStroke: "#cbd5e1",
    };
  }

  return {
    stroke: "#2f3441",
    mutedStroke: "#98a2b3",
    text: "#1f2328",
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

const makeTextStyle = (palette: Palette) => ({
  fontFamily: FONT,
  fontSize: DEFAULT_FONT_SIZE,
  strokeColor: palette.text,
});

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
  const fill = opts?.fill ?? palette.boxFill;

  return [
    {
      type: "rectangle",
      id: createSequenceId("participant", laneId),
      x,
      y: 0,
      width,
      height: PARTICIPANT_HEIGHT,
      strokeColor: palette.stroke,
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
        text: label,
        ...makeTextStyle(palette),
      },
    },
    createLifeline(laneId, groupId, x + width / 2, PARTICIPANT_HEIGHT, palette),
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
      strokeColor: palette.stroke,
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
      strokeColor: palette.stroke,
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
      strokeColor: palette.stroke,
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
      strokeColor: palette.stroke,
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
      strokeColor: palette.stroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "text",
      x: x + 18,
      y: 82,
      text: label,
      ...makeTextStyle(palette),
      groupIds: [groupId],
    },
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
  return [
    {
      type: "ellipse",
      id: createSequenceId("participant", laneId),
      x,
      y: 0,
      width,
      height: 28,
      strokeColor: palette.stroke,
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: palette.accentFill,
      roughness: 0,
      groupIds: [groupId],
      customData: createSequenceMeta("participant", laneId),
    },
    {
      type: "line",
      x,
      y: 14,
      width: 1,
      height: 44,
      points: [
        [0, 0],
        [0, 44],
      ],
      strokeColor: palette.stroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "line",
      x: x + width,
      y: 14,
      width: 1,
      height: 44,
      points: [
        [0, 0],
        [0, 44],
      ],
      strokeColor: palette.stroke,
      strokeWidth: 2,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "ellipse",
      x,
      y: 44,
      width,
      height: 28,
      strokeColor: palette.stroke,
      strokeWidth: 2,
      fillStyle: "solid",
      backgroundColor: palette.accentFill,
      roughness: 0,
      groupIds: [groupId],
    },
    {
      type: "text",
      x: x + 18,
      y: 24,
      text: label,
      ...makeTextStyle(palette),
      groupIds: [groupId],
    },
    createLifeline(laneId, groupId, x + width / 2, 74, palette),
  ] as ExcalidrawElementSkeleton[];
};

const createMessageArrow = (
  label: string,
  palette: Palette,
  opts?: { dotted?: boolean; self?: boolean },
) => {
  const base = {
    type: "arrow",
    x: 0,
    y: 0,
    strokeColor: palette.stroke,
    strokeWidth: 2,
    roughness: 0,
    strokeStyle: opts?.dotted ? "dotted" : "solid",
    endArrowhead: "arrow",
    label: {
      text: label,
      ...makeTextStyle(palette),
    },
    customData: createSequenceMeta("message"),
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
      [0, 0],
      [180, 0],
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
      strokeColor: palette.stroke,
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
      strokeColor: palette.stroke,
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

const createFragment = (
  kind: Extract<SequenceStencilKind, "loop" | "alt">,
  label: string,
  palette: Palette,
) => {
  const elements: ExcalidrawElementSkeleton[] = [
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: 280,
      height: 180,
      strokeColor: palette.fragmentStroke,
      strokeWidth: 2,
      strokeStyle: "dashed",
      backgroundColor: "transparent",
      fillStyle: "solid",
      roughness: 0,
      customData: createSequenceMeta("fragment"),
    },
    {
      type: "rectangle",
      x: 0,
      y: 0,
      width: kind === "alt" ? 62 : 74,
      height: 28,
      strokeColor: palette.fragmentStroke,
      strokeWidth: 2,
      backgroundColor: palette.accentFill,
      fillStyle: "solid",
      roughness: 0,
      label: {
        text: label,
        ...makeTextStyle(palette),
      },
      customData: createSequenceMeta("fragment", undefined, { variant: kind }),
    },
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
      strokeStyle: "dashed",
      roughness: 0,
      customData: createSequenceMeta("fragment", undefined, { variant: kind }),
    });
  }

  return elements;
};

export const createSequenceStencil = (
  kind: SequenceStencilKind,
  theme: Theme,
  defaults: SequenceStencilDefaults,
): ExcalidrawElementSkeleton[] => {
  const palette = getPalette(theme);

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
    case "message":
      return [createMessageArrow(defaults.request, palette)];
    case "return":
      return [createMessageArrow(defaults.response, palette, { dotted: true })];
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
