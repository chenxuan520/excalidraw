import { FONT_FAMILY, ROUNDNESS } from "../../packages/excalidraw/constants";
import type { ExcalidrawElementSkeleton } from "../../packages/excalidraw/data/transform";
import { measureText } from "../../packages/excalidraw/element/textElement";
import type {
  ExcalidrawElement,
  Theme,
} from "../../packages/excalidraw/element/types";
import { getLineHeight } from "../../packages/excalidraw/fonts";
import { t } from "../../packages/excalidraw/i18n";
import { getFontString } from "../../packages/excalidraw/utils";

export const MIND_MAP_SIDEBAR_TAB = "mind-map";

export type MindMapStencilKind =
  | "mindmap-right"
  | "mindmap-left"
  | "tree-right"
  | "tree-left"
  | "tree-balanced"
  | "timeline-horizontal"
  | "timeline-vertical";

export type MindMapSide = "left" | "right";
export type MindMapLane = "top" | "center" | "bottom" | "left" | "right";

export type MindMapStencilDefaults = {
  mainTopic: string;
  topic: string;
  subtopic: string;
  event: string;
};

export type MindMapElementRole = "root" | "node" | "connector";

export type MindMapElementData = {
  role: MindMapElementRole;
  template: MindMapStencilKind;
  part?: "leaf" | "trunk";
  nodeId?: string;
  parentId?: string;
  sourceId?: string;
  targetId?: string;
  side?: MindMapSide;
   lane?: MindMapLane;
  order?: number;
  level?: number;
};

type MindMapElementMeta = {
  mindMap?: MindMapElementData;
};

type HorizontalDirection = MindMapSide;

type PlacedNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  element: ExcalidrawElementSkeleton;
};

type Palette = {
  rootFill: string;
  rootText: string;
  connector: string;
  topicText: string;
};

export const MIND_MAP_FONT_FAMILY = FONT_FAMILY["Comic Shanns"];
export const MIND_MAP_FONT_SIZE = 18;
export const MIND_MAP_LINE_HEIGHT = getLineHeight(MIND_MAP_FONT_FAMILY);
export const MIND_MAP_ROOT_WIDTH = 128;
export const MIND_MAP_ROOT_HEIGHT = 44;
export const MIND_MAP_ROOT_FILL = "#5b7ee5";
export const MIND_MAP_ROOT_TEXT = "#ffffff";
export const MIND_MAP_CONNECTOR_COLOR = "#5b7ee5";
export const MIND_MAP_TOPIC_TEXT = "#55637a";
export const MIND_MAP_ROOT_CHILD_GAP_X = 56;
export const MIND_MAP_CHILD_GAP_X = 56;
export const MIND_MAP_CHILD_GAP_Y = 18;
export const MIND_MAP_TREE_ROOT_GAP_Y = 20;
export const MIND_MAP_PLUS_OFFSET = 20;

const ROOT_X_LEFT = 0;
const ROOT_X_RIGHT = 332;
const ROOT_Y_CENTER = 88;
const ROOT_Y_TOP = 0;
const TEXT_FONT = getFontString({
  fontFamily: MIND_MAP_FONT_FAMILY,
  fontSize: MIND_MAP_FONT_SIZE,
});

export const getMindMapStencilDefaults = (
  translate: typeof t = t,
): MindMapStencilDefaults => ({
  mainTopic: translate("mindMap.defaults.mainTopic"),
  topic: translate("mindMap.defaults.topic"),
  subtopic: translate("mindMap.defaults.subtopic"),
  event: translate("mindMap.defaults.event"),
});

export const mindMapStencilSections: {
  key: "maps" | "trees" | "timelines";
  items: MindMapStencilKind[];
}[] = [
  { key: "maps", items: ["mindmap-right", "mindmap-left"] },
  {
    key: "trees",
    items: ["tree-right", "tree-left", "tree-balanced"],
  },
  {
    key: "timelines",
    items: ["timeline-horizontal", "timeline-vertical"],
  },
];

const getPalette = (_theme: Theme): Palette => ({
  rootFill: MIND_MAP_ROOT_FILL,
  rootText: MIND_MAP_ROOT_TEXT,
  connector: MIND_MAP_CONNECTOR_COLOR,
  topicText: MIND_MAP_TOPIC_TEXT,
});

const createMindMapId = (prefix: string) =>
  `mindmap-${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const createMindMapMeta = (
  role: MindMapElementRole,
  template: MindMapStencilKind,
  extra?: Omit<MindMapElementData, "role" | "template">,
): MindMapElementMeta => ({
  mindMap: {
    role,
    template,
    ...extra,
  },
});

export const getMindMapElementMeta = (
  element: Pick<ExcalidrawElement, "customData">,
) => {
  return element.customData?.mindMap as MindMapElementData | undefined;
};

export const isMindMapRootElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return getMindMapElementMeta(element || { customData: undefined })?.role === "root";
};

export const isMindMapNodeElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return getMindMapElementMeta(element || { customData: undefined })?.role === "node";
};

export const isMindMapConnectorElement = (
  element: ExcalidrawElement | null | undefined,
): element is ExcalidrawElement => {
  return (
    getMindMapElementMeta(element || { customData: undefined })?.role ===
    "connector"
  );
};

export const getMindMapTemplateFamily = (template: MindMapStencilKind) => {
  if (template.startsWith("mindmap")) {
    return "map" as const;
  }
  if (template.startsWith("tree")) {
    return "tree" as const;
  }
  return "timeline" as const;
};

export const isMindMapTimelineTemplate = (template: MindMapStencilKind) => {
  return getMindMapTemplateFamily(template) === "timeline";
};

export const getMindMapTimelineOrientation = (
  template: MindMapStencilKind,
) => {
  if (template === "timeline-horizontal") {
    return "horizontal" as const;
  }
  if (template === "timeline-vertical") {
    return "vertical" as const;
  }
  return null;
};

export const getMindMapDefaultSide = (
  template: MindMapStencilKind,
): MindMapSide => {
  return template === "mindmap-left" || template === "tree-left"
    ? "left"
    : "right";
};

const measureMindMapText = (text: string) => {
  return measureText(text, TEXT_FONT, MIND_MAP_LINE_HEIGHT);
};

const createRootNode = (
  template: MindMapStencilKind,
  x: number,
  y: number,
  label: string,
  palette: Palette,
) => {
  const id = createMindMapId("node");

  return {
    id,
    x,
    y,
    width: MIND_MAP_ROOT_WIDTH,
    height: MIND_MAP_ROOT_HEIGHT,
    element: {
      type: "rectangle",
      id,
      x,
      y,
      width: MIND_MAP_ROOT_WIDTH,
      height: MIND_MAP_ROOT_HEIGHT,
      strokeColor: palette.rootFill,
      backgroundColor: palette.rootFill,
      fillStyle: "solid",
      strokeStyle: "solid",
      strokeWidth: 2,
      roughness: 0,
      roundness: { type: ROUNDNESS.PROPORTIONAL_RADIUS },
      customData: createMindMapMeta("root", template, {
        nodeId: id,
        level: 0,
      }),
      label: {
        text: label,
        fontFamily: MIND_MAP_FONT_FAMILY,
        fontSize: MIND_MAP_FONT_SIZE,
        strokeColor: palette.rootText,
        textAlign: "center",
        verticalAlign: "middle",
      },
    } as ExcalidrawElementSkeleton,
  };
};

const createPlacedNode = ({
  template,
  label,
  x,
  y,
  palette,
  parentId,
  side,
  lane,
  order,
  level,
}: {
  template: MindMapStencilKind;
  label: string;
  x: number;
  y: number;
  palette: Palette;
  parentId: string;
  side: MindMapSide;
  lane?: MindMapLane;
  order: number;
  level: number;
}): PlacedNode => {
  const id = createMindMapId("node");
  const metrics = measureMindMapText(label);

  return {
    id,
    x,
    y,
    width: metrics.width,
    height: metrics.height,
    element: {
      type: "text",
      id,
      x,
      y,
      text: label,
      fontFamily: MIND_MAP_FONT_FAMILY,
      fontSize: MIND_MAP_FONT_SIZE,
      lineHeight: MIND_MAP_LINE_HEIGHT,
      strokeColor: palette.topicText,
      customData: createMindMapMeta("node", template, {
        nodeId: id,
        parentId,
        side,
        lane,
        order,
        level,
      }),
    } as ExcalidrawElementSkeleton,
  };
};

const createConnector = ({
  template,
  palette,
  sourceId,
  targetId,
  points,
}: {
  template: MindMapStencilKind;
  palette: Palette;
  sourceId: string;
  targetId: string;
  points: readonly [number, number][];
}) => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    type: "line",
    id: createMindMapId("connector"),
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
    points: points.map(([x, y]) => [x - minX, y - minY]),
    strokeColor: palette.connector,
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    roundness: null,
    customData: createMindMapMeta("connector", template, {
      sourceId,
      targetId,
    }),
  } as ExcalidrawElementSkeleton;
};

const getNodeCenterY = (node: PlacedNode | ReturnType<typeof createRootNode>) =>
  node.y + node.height / 2;

const getNodeEntryX = (
  direction: HorizontalDirection,
  node: PlacedNode,
  gap = 16,
) => {
  return direction === "right" ? node.x - gap : node.x + node.width + gap;
};

const getNodeExitX = (
  direction: HorizontalDirection,
  node: PlacedNode | ReturnType<typeof createRootNode>,
  gap = 12,
) => {
  return direction === "right" ? node.x + node.width + gap : node.x - gap;
};

const placeNodeFromAnchor = ({
  template,
  direction,
  anchorX,
  distance,
  y,
  label,
  palette,
  parentId,
  order,
  level,
}: {
  template: MindMapStencilKind;
  direction: HorizontalDirection;
  anchorX: number;
  distance: number;
  y: number;
  label: string;
  palette: Palette;
  parentId: string;
  order: number;
  level: number;
}) => {
  const metrics = measureMindMapText(label);
  return createPlacedNode({
    template,
    label,
    x:
      direction === "right"
        ? anchorX + distance
        : anchorX - distance - metrics.width,
    y,
    palette,
    parentId,
    side: direction,
    order,
    level,
  });
};

const createHorizontalConnector = ({
  template,
  direction,
  palette,
  sourceId,
  targetId,
  startX,
  startY,
  endX,
  endY,
  bendOffset = 44,
}: {
  template: MindMapStencilKind;
  direction: HorizontalDirection;
  palette: Palette;
  sourceId: string;
  targetId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  bendOffset?: number;
}) => {
  const bendX =
    direction === "right" ? startX + bendOffset : startX - bendOffset;
  return createConnector({
    template,
    palette,
    sourceId,
    targetId,
    points: [
      [startX, startY],
      [bendX, startY],
      [bendX, endY],
      [endX, endY],
    ],
  });
};

const createVerticalConnector = ({
  template,
  direction,
  palette,
  sourceId,
  targetId,
  startX,
  startY,
  endX,
  endY,
}: {
  template: MindMapStencilKind;
  direction: HorizontalDirection;
  palette: Palette;
  sourceId: string;
  targetId: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}) => {
  return createConnector({
    template,
    palette,
    sourceId,
    targetId,
    points: [
      [startX, startY],
      [startX, endY],
      [endX, endY],
    ],
  });
};

const createMindMapTemplate = (
  template: Extract<MindMapStencilKind, "mindmap-right" | "mindmap-left">,
  direction: HorizontalDirection,
  palette: Palette,
  defaults: MindMapStencilDefaults,
) => {
  const rootX = direction === "right" ? ROOT_X_LEFT : ROOT_X_RIGHT;
  const root = createRootNode(
    template,
    rootX,
    ROOT_Y_CENTER,
    defaults.mainTopic,
    palette,
  );
  const rootAnchorX = direction === "right" ? rootX + root.width : rootX;
  const rootCenterY = getNodeCenterY(root);

  const top = placeNodeFromAnchor({
    template,
    direction,
    anchorX: rootAnchorX,
    distance: 92,
    y: 12,
    label: defaults.topic,
    palette,
    parentId: root.id,
    order: 0,
    level: 1,
  });
  const middle = placeNodeFromAnchor({
    template,
    direction,
    anchorX: rootAnchorX,
    distance: 86,
    y: 102,
    label: defaults.topic,
    palette,
    parentId: root.id,
    order: 1,
    level: 1,
  });
  const bottom = placeNodeFromAnchor({
    template,
    direction,
    anchorX: rootAnchorX,
    distance: 92,
    y: 190,
    label: defaults.topic,
    palette,
    parentId: root.id,
    order: 2,
    level: 1,
  });

  const topSub = placeNodeFromAnchor({
    template,
    direction,
    anchorX: getNodeExitX(direction, top, 0),
    distance: 82,
    y: 0,
    label: defaults.subtopic,
    palette,
    parentId: top.id,
    order: 0,
    level: 2,
  });
  const middleSub = placeNodeFromAnchor({
    template,
    direction,
    anchorX: getNodeExitX(direction, middle, 0),
    distance: 78,
    y: 86,
    label: defaults.subtopic,
    palette,
    parentId: middle.id,
    order: 0,
    level: 2,
  });

  return [
    root.element,
    top.element,
    middle.element,
    bottom.element,
    topSub.element,
    middleSub.element,
    createHorizontalConnector({
      template,
      direction,
      palette,
      sourceId: root.id,
      targetId: top.id,
      startX: rootAnchorX,
      startY: rootCenterY,
      endX: getNodeEntryX(direction, top),
      endY: getNodeCenterY(top),
    }),
    createHorizontalConnector({
      template,
      direction,
      palette,
      sourceId: root.id,
      targetId: middle.id,
      startX: rootAnchorX,
      startY: rootCenterY,
      endX: getNodeEntryX(direction, middle),
      endY: getNodeCenterY(middle),
    }),
    createHorizontalConnector({
      template,
      direction,
      palette,
      sourceId: root.id,
      targetId: bottom.id,
      startX: rootAnchorX,
      startY: rootCenterY,
      endX: getNodeEntryX(direction, bottom),
      endY: getNodeCenterY(bottom),
    }),
    createHorizontalConnector({
      template,
      direction,
      palette,
      sourceId: top.id,
      targetId: topSub.id,
      startX: getNodeExitX(direction, top),
      startY: getNodeCenterY(top),
      endX: getNodeEntryX(direction, topSub, 14),
      endY: getNodeCenterY(topSub),
      bendOffset: 34,
    }),
    createHorizontalConnector({
      template,
      direction,
      palette,
      sourceId: middle.id,
      targetId: middleSub.id,
      startX: getNodeExitX(direction, middle),
      startY: getNodeCenterY(middle),
      endX: getNodeEntryX(direction, middleSub, 14),
      endY: getNodeCenterY(middleSub),
      bendOffset: 30,
    }),
  ] as ExcalidrawElementSkeleton[];
};

const createTreeTemplate = (
  template: Extract<
    MindMapStencilKind,
    "tree-right" | "tree-left" | "tree-balanced"
  >,
  palette: Palette,
  defaults: MindMapStencilDefaults,
) => {
  const rootX =
    template === "tree-right"
      ? ROOT_X_LEFT
      : template === "tree-left"
      ? ROOT_X_RIGHT
      : 170;
  const root = createRootNode(template, rootX, ROOT_Y_TOP, defaults.mainTopic, palette);
  const trunkX = rootX + root.width / 2;
  const trunkY = root.y + root.height;

  const nodes: PlacedNode[] =
    template === "tree-balanced"
      ? [
          placeNodeFromAnchor({
            template,
            direction: "left",
            anchorX: trunkX,
            distance: 104,
            y: 72,
            label: defaults.topic,
            palette,
            parentId: root.id,
            order: 0,
            level: 1,
          }),
          placeNodeFromAnchor({
            template,
            direction: "right",
            anchorX: trunkX,
            distance: 104,
            y: 72,
            label: defaults.topic,
            palette,
            parentId: root.id,
            order: 1,
            level: 1,
          }),
          placeNodeFromAnchor({
            template,
            direction: "right",
            anchorX: trunkX,
            distance: 118,
            y: 154,
            label: defaults.subtopic,
            palette,
            parentId: root.id,
            order: 2,
            level: 1,
          }),
        ]
      : [
          placeNodeFromAnchor({
            template,
            direction: getMindMapDefaultSide(template),
            anchorX: trunkX,
            distance: 116,
            y: 56,
            label: defaults.topic,
            palette,
            parentId: root.id,
            order: 0,
            level: 1,
          }),
          placeNodeFromAnchor({
            template,
            direction: getMindMapDefaultSide(template),
            anchorX: trunkX,
            distance: 104,
            y: 108,
            label: defaults.topic,
            palette,
            parentId: root.id,
            order: 1,
            level: 1,
          }),
          placeNodeFromAnchor({
            template,
            direction: getMindMapDefaultSide(template),
            anchorX: trunkX,
            distance: 116,
            y: 160,
            label: defaults.subtopic,
            palette,
            parentId: root.id,
            order: 2,
            level: 1,
          }),
        ];

  return [
    root.element,
    ...nodes.map((node) => node.element),
    ...nodes.map((node) =>
      createVerticalConnector({
        template,
        direction:
          (getMindMapElementMeta(node.element)?.side as MindMapSide) ||
          getMindMapDefaultSide(template),
        palette,
        sourceId: root.id,
        targetId: node.id,
        startX: trunkX,
        startY: trunkY,
        endX:
          getMindMapElementMeta(node.element)?.side === "left"
            ? node.x + node.width + 16
            : node.x - 16,
        endY: getNodeCenterY(node),
      }),
    ),
  ] as ExcalidrawElementSkeleton[];
};

const createHorizontalTimelineTemplate = (
  palette: Palette,
  defaults: MindMapStencilDefaults,
) => {
  const template = "timeline-horizontal" as const;
  const root = createRootNode(template, ROOT_X_LEFT, 84, defaults.mainTopic, palette);
  const centerA = createPlacedNode({
    template,
    label: defaults.event,
    x: 214,
    y: 96,
    palette,
    parentId: root.id,
    side: "right",
    lane: "center",
    order: 0,
    level: 1,
  });
  const centerB = createPlacedNode({
    template,
    label: defaults.event,
    x: 384,
    y: 96,
    palette,
    parentId: centerA.id,
    side: "right",
    lane: "center",
    order: 1,
    level: 1,
  });
  const top = createPlacedNode({
    template,
    label: defaults.event,
    x: 298,
    y: 28,
    palette,
    parentId: centerA.id,
    side: "right",
    lane: "top",
    order: 0,
    level: 2,
  });
  const bottom = createPlacedNode({
    template,
    label: defaults.subtopic,
    x: 468,
    y: 164,
    palette,
    parentId: centerB.id,
    side: "right",
    lane: "bottom",
    order: 0,
    level: 2,
  });

  const rootRightX = root.x + root.width;
  const rootCenterY = getNodeCenterY(root);
  const textGap = 30;

  return [
    root.element,
    centerA.element,
    centerB.element,
    top.element,
    bottom.element,
    createConnector({
      template,
      palette,
      sourceId: root.id,
      targetId: centerA.id,
      points: [
        [rootRightX, rootCenterY],
        [centerA.x - textGap, rootCenterY],
      ],
    }),
    createConnector({
      template,
      palette,
      sourceId: centerA.id,
      targetId: centerB.id,
      points: [
        [centerA.x + centerA.width + textGap, getNodeCenterY(centerA)],
        [centerB.x - textGap, getNodeCenterY(centerB)],
      ],
    }),
    createConnector({
      template,
      palette,
      sourceId: centerA.id,
      targetId: top.id,
      points: [
        [centerA.x + centerA.width + textGap, getNodeCenterY(centerA)],
        [centerA.x + centerA.width + textGap, getNodeCenterY(top)],
        [top.x - textGap, getNodeCenterY(top)],
      ],
    }),
    createConnector({
      template,
      palette,
      sourceId: centerB.id,
      targetId: bottom.id,
      points: [
        [centerB.x + centerB.width + textGap, getNodeCenterY(centerB)],
        [centerB.x + centerB.width + textGap, getNodeCenterY(bottom)],
        [bottom.x - textGap, getNodeCenterY(bottom)],
      ],
    }),
  ] as ExcalidrawElementSkeleton[];
};

const createVerticalTimelineTemplate = (
  palette: Palette,
  defaults: MindMapStencilDefaults,
) => {
  const template = "timeline-vertical" as const;
  const root = createRootNode(template, 148, ROOT_Y_TOP, defaults.mainTopic, palette);
  const trunkX = root.x + root.width / 2;
  const rightX = trunkX + 118;
  const centerX = trunkX - measureMindMapText(defaults.event).width / 2;
  const centerA = createPlacedNode({
    template,
    label: defaults.event,
    x: centerX,
    y: 106,
    palette,
    parentId: root.id,
    side: "right",
    lane: "center",
    order: 0,
    level: 1,
  });
  const centerB = createPlacedNode({
    template,
    label: defaults.event,
    x: centerX,
    y: 236,
    palette,
    parentId: centerA.id,
    side: "right",
    lane: "center",
    order: 1,
    level: 1,
  });
  const centerC = createPlacedNode({
    template,
    label: defaults.event,
    x: centerX,
    y: 366,
    palette,
    parentId: centerB.id,
    side: "right",
    lane: "center",
    order: 2,
    level: 1,
  });
  const centerD = createPlacedNode({
    template,
    label: defaults.event,
    x: centerX,
    y: 496,
    palette,
    parentId: centerC.id,
    side: "right",
    lane: "center",
    order: 3,
    level: 1,
  });

  const centerNodes = [centerA, centerB, centerC, centerD];
  const trunkBottomY = getNodeCenterY(centerD);

  return [
    root.element,
    ...centerNodes.map((node) => node.element),
    createConnector({
      template,
      palette,
      sourceId: root.id,
      targetId: centerD.id,
      points: [
        [trunkX, root.y + root.height],
        [trunkX, trunkBottomY],
      ],
    }),
  ] as ExcalidrawElementSkeleton[];
};

export const createMindMapStencil = (
  kind: MindMapStencilKind,
  theme: Theme,
  defaults: MindMapStencilDefaults,
) => {
  const palette = getPalette(theme);

  switch (kind) {
    case "mindmap-right":
      return createMindMapTemplate(kind, "right", palette, defaults);
    case "mindmap-left":
      return createMindMapTemplate(kind, "left", palette, defaults);
    case "tree-right":
    case "tree-left":
    case "tree-balanced":
      return createTreeTemplate(kind, palette, defaults);
    case "timeline-horizontal":
      return createHorizontalTimelineTemplate(palette, defaults);
    case "timeline-vertical":
      return createVerticalTimelineTemplate(palette, defaults);
    default:
      return [] as ExcalidrawElementSkeleton[];
  }
};
