import { syncInvalidIndices } from "../../packages/excalidraw/fractionalIndex";
import { deepCopyElement, newLinearElement, newTextElement } from "../../packages/excalidraw/element/newElement";
import { newElementWith } from "../../packages/excalidraw/element/mutateElement";
import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import {
  MIND_MAP_CHILD_GAP_X,
  MIND_MAP_CHILD_GAP_Y,
  MIND_MAP_CONNECTOR_COLOR,
  MIND_MAP_FONT_FAMILY,
  MIND_MAP_FONT_SIZE,
  MIND_MAP_LINE_HEIGHT,
  MIND_MAP_ROOT_CHILD_GAP_X,
  MIND_MAP_TOPIC_TEXT,
  MIND_MAP_TREE_ROOT_GAP_Y,
  getMindMapDefaultSide,
  getMindMapElementMeta,
  getMindMapStencilDefaults,
  getMindMapTemplateFamily,
  getMindMapTimelineOrientation,
  isMindMapConnectorElement,
  isMindMapNodeElement,
  isMindMapRootElement,
  isMindMapTimelineTemplate,
  type MindMapLane,
  type MindMapSide,
  type MindMapStencilDefaults,
  type MindMapStencilKind,
} from "./mindMapStencils";

type SelectedElementIds = Record<string, true> | undefined;

type MindMapNodeElement = OrderedExcalidrawElement;

type MindMapNode = {
  id: string;
  element: MindMapNodeElement;
  parentId: string | null;
  side: MindMapSide;
  lane?: MindMapLane;
  order: number;
  level: number;
  children: string[];
};

type MindMapConnector = {
  element: OrderedExcalidrawElement & ExcalidrawLinearElement;
  sourceId: string;
  targetId?: string;
  side?: MindMapSide;
  part: "leaf" | "trunk";
};

export type MindMapTree = {
  template: MindMapStencilKind;
  root: MindMapNode;
  nodes: Map<string, MindMapNode>;
  connectorsByTargetId: Map<string, MindMapConnector>;
  trunkConnectorsByKey: Map<string, MindMapConnector>;
  connectorsById: Map<string, MindMapConnector>;
};

type BuiltTrees = {
  trees: MindMapTree[];
  orphanConnectorIds: Set<string>;
};

export type MindMapInsertMode = "child" | "sibling";

const TIMELINE_HORIZONTAL_GAP_X = 132;
const TIMELINE_HORIZONTAL_GAP_Y = 34;
const TIMELINE_VERTICAL_GAP_Y = 86;
const TIMELINE_VERTICAL_GAP_X = 118;
const TIMELINE_TEXT_GAP = 30;

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

const createMindMapId = (prefix: string) =>
  `mindmap-${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const getBox = (
  element: Pick<ExcalidrawElement, "x" | "y" | "width" | "height">,
): Box => ({
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
  right: element.x + element.width,
  bottom: element.y + element.height,
  centerX: element.x + element.width / 2,
  centerY: element.y + element.height / 2,
});

const getLineEndpoints = (
  element: Pick<ExcalidrawLinearElement, "x" | "y" | "points">,
) => {
  const first = element.points[0] || [0, 0];
  const last = element.points[element.points.length - 1] || first;
  return {
    startX: element.x + first[0],
    startY: element.y + first[1],
    endX: element.x + last[0],
    endY: element.y + last[1],
  };
};

const getDistanceToRect = (
  point: { x: number; y: number },
  element: Pick<ExcalidrawElement, "x" | "y" | "width" | "height">,
) => {
  const dx = Math.max(
    element.x - point.x,
    0,
    point.x - (element.x + element.width),
  );
  const dy = Math.max(
    element.y - point.y,
    0,
    point.y - (element.y + element.height),
  );
  return Math.hypot(dx, dy);
};

const findClosestNodeId = (
  point: { x: number; y: number },
  nodes: Map<string, MindMapNodeElement>,
  excludeId?: string,
) => {
  let closestId: string | null = null;
  let closestDistance = Infinity;

  for (const [id, element] of nodes) {
    if (id === excludeId) {
      continue;
    }

    const distance = getDistanceToRect(point, element);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestId = id;
    }
  }

  return closestDistance <= 64 ? closestId : null;
};

const resolveConnectorNodes = (
  connector: OrderedExcalidrawElement & ExcalidrawLinearElement,
  nodes: Map<string, MindMapNodeElement>,
) => {
  const meta = getMindMapElementMeta(connector);
  const sourceId = meta?.sourceId && nodes.has(meta.sourceId) ? meta.sourceId : null;
  const targetId = meta?.targetId && nodes.has(meta.targetId) ? meta.targetId : null;

  if (sourceId && targetId) {
    return { sourceId, targetId };
  }

  const { startX, startY, endX, endY } = getLineEndpoints(connector);
  const resolvedSourceId =
    sourceId ||
    findClosestNodeId(
      { x: startX, y: startY },
      nodes,
      typeof targetId === "string" ? targetId : undefined,
    );
  const resolvedTargetId =
    targetId ||
    findClosestNodeId(
      { x: endX, y: endY },
      nodes,
      typeof resolvedSourceId === "string" ? resolvedSourceId : undefined,
    );

  if (!resolvedSourceId || !resolvedTargetId) {
    return null;
  }

  return {
    sourceId: resolvedSourceId,
    targetId: resolvedTargetId,
  };
};

const getNearestRootId = (
  node: OrderedExcalidrawElement,
  roots: readonly OrderedExcalidrawElement[],
) => {
  let closest: OrderedExcalidrawElement | null = null;
  let distance = Infinity;

  for (const root of roots) {
    const delta = Math.hypot(root.x - node.x, root.y - node.y);
    if (delta < distance) {
      closest = root;
      distance = delta;
    }
  }

  return closest?.id || null;
};

const getTrunkConnectorKey = (sourceId: string, side: MindMapSide) =>
  `${sourceId}:${side}`;

const getTimelineTrunkConnectorKey = (sourceId: string) =>
  `${sourceId}:timeline`;

const normalizeTimelineTree = (tree: MindMapTree) => {
  const orientation = getMindMapTimelineOrientation(tree.template);
  if (!orientation) {
    return;
  }

  const rootBox = getBox(tree.root.element);
  const axisCenter =
    orientation === "horizontal" ? rootBox.centerY : rootBox.centerX;
  const axisValue = (node: MindMapNode) => {
    const box = getBox(node.element);
    return orientation === "horizontal" ? box.centerX : box.centerY;
  };
  const crossValue = (node: MindMapNode) => {
    const box = getBox(node.element);
    return orientation === "horizontal" ? box.centerY : box.centerX;
  };

  const timelineNodes = [...tree.nodes.values()].filter(
    (node) => node.id !== tree.root.id,
  );
  if (!timelineNodes.length) {
    tree.root.children = [];
    return;
  }

  let centerNodes = timelineNodes.filter(
    (node) =>
      node.lane === "center" || Math.abs(crossValue(node) - axisCenter) <= 10,
  );

  if (!centerNodes.length) {
    centerNodes = [
      [...timelineNodes].sort(
        (left, right) =>
          Math.abs(crossValue(left) - axisCenter) -
          Math.abs(crossValue(right) - axisCenter),
      )[0]!,
    ];
  }

  const centerNodeIds = new Set(centerNodes.map((node) => node.id));
  const sortCenterCandidates = (nodes: MindMapNode[]) =>
    nodes.sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }
      return axisValue(left) - axisValue(right);
    });
  const orderedCenterNodes: MindMapNode[] = [];
  const seenCenterNodeIds = new Set<string>();
  let nextCenter = sortCenterCandidates(
    centerNodes.filter((node) => node.parentId === tree.root.id),
  )[0];

  while (nextCenter && !seenCenterNodeIds.has(nextCenter.id)) {
    orderedCenterNodes.push(nextCenter);
    seenCenterNodeIds.add(nextCenter.id);
    nextCenter = sortCenterCandidates(
      centerNodes.filter(
        (node) =>
          node.parentId === nextCenter!.id && !seenCenterNodeIds.has(node.id),
      ),
    )[0];
  }

  centerNodes = [
    ...orderedCenterNodes,
    ...sortCenterCandidates(
      centerNodes.filter((node) => !seenCenterNodeIds.has(node.id)),
    ),
  ];

  centerNodes.forEach((node, index) => {
    node.parentId = index === 0 ? tree.root.id : centerNodes[index - 1]!.id;
    node.lane = "center";
    node.side = "right";
    node.order = index;
    node.level = 1;
  });

  const branchOrderByParent = new Map<string, number>();
  timelineNodes
    .filter((node) => !centerNodeIds.has(node.id))
    .forEach((node) => {
      const parentCenter =
        (node.parentId && centerNodeIds.has(node.parentId)
          ? tree.nodes.get(node.parentId)
          : null) ||
        [...centerNodes].sort(
          (left, right) =>
            Math.abs(axisValue(left) - axisValue(node)) -
            Math.abs(axisValue(right) - axisValue(node)),
        )[0]!;

      node.parentId = parentCenter.id;
      if (orientation === "horizontal") {
        node.lane =
          node.lane === "top" || node.lane === "bottom"
            ? node.lane
            : crossValue(node) < getBox(parentCenter.element).centerY
            ? "top"
            : "bottom";
        node.side = "right";
      } else {
        node.lane =
          node.lane === "left" || node.lane === "right"
            ? node.lane
            : crossValue(node) < getBox(parentCenter.element).centerX
            ? "left"
            : "right";
        node.side = node.lane === "left" ? "left" : "right";
      }
      node.level = 2;
      const nextOrder = branchOrderByParent.get(parentCenter.id) || 0;
      node.order = nextOrder;
      branchOrderByParent.set(parentCenter.id, nextOrder + 1);
    });

  for (const node of tree.nodes.values()) {
    node.children = [];
  }

  for (const node of tree.nodes.values()) {
    if (!node.parentId) {
      continue;
    }
    const parent = tree.nodes.get(node.parentId);
    parent?.children.push(node.id);
  }

  tree.root.children.sort((leftId, rightId) => {
    return axisValue(tree.nodes.get(leftId)!) - axisValue(tree.nodes.get(rightId)!);
  });
  for (const node of timelineNodes) {
    node.children.sort((leftId, rightId) => {
      const left = tree.nodes.get(leftId)!;
      const right = tree.nodes.get(rightId)!;
      return axisValue(left) - axisValue(right);
    });
  }
};

export const buildMindMapTrees = (
  elements: readonly OrderedExcalidrawElement[],
  selectedElementIds?: SelectedElementIds,
): BuiltTrees => {
  const rootElements = elements.filter(
    (element): element is OrderedExcalidrawElement =>
      !element.isDeleted && isMindMapRootElement(element),
  );
  const nodeElements = elements.filter(
    (element): element is OrderedExcalidrawElement =>
      !element.isDeleted && isMindMapNodeElement(element),
  );
  const connectorElements = elements.filter(
    (element): element is OrderedExcalidrawElement & ExcalidrawLinearElement =>
      !element.isDeleted && isMindMapConnectorElement(element),
  );

  if (!rootElements.length) {
    return { trees: [], orphanConnectorIds: new Set() };
  }

  const rawNodes = new Map<string, MindMapNodeElement>();
  for (const root of rootElements) {
    rawNodes.set(root.id, root);
  }
  for (const node of nodeElements) {
    rawNodes.set(node.id, node);
  }

  const resolvedConnectors = new Map<string, MindMapConnector>();
  const resolvedTrunkConnectors = new Map<string, MindMapConnector>();
  const parentByTargetId = new Map<string, string>();
  const orphanConnectorIds = new Set<string>();

  for (const connector of connectorElements) {
    const meta = getMindMapElementMeta(connector);
    if (meta?.part === "trunk") {
      if (!meta.sourceId || !rawNodes.has(meta.sourceId)) {
        orphanConnectorIds.add(connector.id);
        continue;
      }

      const key = meta.side
        ? getTrunkConnectorKey(meta.sourceId, meta.side)
        : getTimelineTrunkConnectorKey(meta.sourceId);
      if (resolvedTrunkConnectors.has(key)) {
        orphanConnectorIds.add(connector.id);
        continue;
      }

      resolvedTrunkConnectors.set(key, {
        element: connector,
        sourceId: meta.sourceId,
        side: meta.side,
        part: "trunk",
      });
      continue;
    }

    const resolved = resolveConnectorNodes(connector, rawNodes);
    if (!resolved) {
      orphanConnectorIds.add(connector.id);
      continue;
    }
    if (parentByTargetId.has(resolved.targetId)) {
      orphanConnectorIds.add(connector.id);
      continue;
    }
    resolvedConnectors.set(resolved.targetId, {
      element: connector,
      sourceId: resolved.sourceId,
      targetId: resolved.targetId,
      side: meta?.side,
      part: "leaf",
    });
    parentByTargetId.set(resolved.targetId, resolved.sourceId);
  }

  const nodes = new Map<string, MindMapNode>();
  for (const root of rootElements) {
    const meta = getMindMapElementMeta(root)!;
    nodes.set(root.id, {
      id: root.id,
      element: root,
      parentId: null,
      side: getMindMapDefaultSide(meta.template),
      order: 0,
      level: 0,
      children: [],
    });
  }

  for (const node of nodeElements) {
    const meta = getMindMapElementMeta(node)!;
    const parentId =
      (meta.parentId && rawNodes.has(meta.parentId) ? meta.parentId : null) ||
      parentByTargetId.get(node.id) ||
      getNearestRootId(node, rootElements);
    const parent = parentId ? rawNodes.get(parentId) : null;
    const selected = !!selectedElementIds?.[node.id];
    const allowSideFlip =
      getMindMapTemplateFamily(meta.template) === "map" ||
      meta.template === "tree-balanced";
    const derivedSide =
      parent && node.x + node.width / 2 < parent.x + parent.width / 2
        ? "left"
        : "right";
    const timelineOrientation = getMindMapTimelineOrientation(meta.template);
    const parentCenterX = parent ? parent.x + parent.width / 2 : 0;
    const parentCenterY = parent ? parent.y + parent.height / 2 : 0;
    const derivedLane = timelineOrientation
      ? timelineOrientation === "horizontal"
        ? node.y + node.height / 2 < parentCenterY - 8
          ? "top"
          : node.y + node.height / 2 > parentCenterY + 8
          ? "bottom"
          : "center"
        : node.x + node.width / 2 < parentCenterX - 8
        ? "left"
        : node.x + node.width / 2 > parentCenterX + 8
        ? "right"
        : "center"
      : undefined;
    const timelineSide =
      timelineOrientation === "vertical"
        ? derivedLane === "left"
          ? "left"
          : "right"
        : "right";
    const canDeriveTimelineLane =
      selected && !!timelineOrientation && meta.lane !== "center";
    const side =
      (canDeriveTimelineLane ? timelineSide : undefined) ||
      (selected && allowSideFlip ? derivedSide : undefined) ||
      meta.side ||
      (parent && node.x < parent.x ? "left" : undefined) ||
      getMindMapDefaultSide(meta.template);

    nodes.set(node.id, {
      id: node.id,
      element: node,
      parentId,
      side,
      lane:
        (canDeriveTimelineLane ? derivedLane : undefined) ||
        meta.lane ||
        derivedLane,
      order: typeof meta.order === "number" ? meta.order : 0,
      level: typeof meta.level === "number" ? meta.level : parentId ? 1 : 0,
      children: [],
    });
  }

  for (const node of nodes.values()) {
    if (!node.parentId) {
      continue;
    }
    const parent = nodes.get(node.parentId);
    if (!parent) {
      node.parentId = null;
      continue;
    }
    parent.children.push(node.id);
  }

  for (const node of nodes.values()) {
    node.children.sort((leftId, rightId) => {
      const left = nodes.get(leftId)!;
      const right = nodes.get(rightId)!;
      const leftSelected = !!selectedElementIds?.[left.id];
      const rightSelected = !!selectedElementIds?.[right.id];
      const timelineOrientation = getMindMapTimelineOrientation(left.element.customData?.mindMap?.template as MindMapStencilKind);

      if (timelineOrientation === "horizontal") {
        if ((leftSelected || rightSelected) && left.element.x !== right.element.x) {
          return left.element.x - right.element.x;
        }
      }
      if (timelineOrientation === "vertical") {
        if ((leftSelected || rightSelected) && left.element.y !== right.element.y) {
          return left.element.y - right.element.y;
        }
      }

      if ((leftSelected || rightSelected) && left.element.y !== right.element.y) {
        return left.element.y - right.element.y;
      }

      if (left.order !== right.order) {
        return left.order - right.order;
      }
      if (left.element.y !== right.element.y) {
        return left.element.y - right.element.y;
      }
      return left.element.x - right.element.x;
    });

    if (
      !getMindMapTimelineOrientation(
        node.element.customData?.mindMap?.template as MindMapStencilKind,
      )
    ) {
      node.children.forEach((childId, index) => {
        const child = nodes.get(childId);
        if (child) {
          child.order = index;
        }
      });
    }
  }

  const trees: MindMapTree[] = [];
  for (const root of rootElements) {
    const template = getMindMapElementMeta(root)!.template;
    const treeNodes = new Map<string, MindMapNode>();
    const queue = [root.id];

    while (queue.length) {
      const nodeId = queue.shift()!;
      const node = nodes.get(nodeId);
      if (!node || treeNodes.has(nodeId)) {
        continue;
      }
      treeNodes.set(nodeId, node);
      queue.push(...node.children);
    }

    const connectorsByTargetId = new Map<string, MindMapConnector>();
    const trunkConnectorsByKey = new Map<string, MindMapConnector>();
    const connectorsById = new Map<string, MindMapConnector>();
    for (const connector of resolvedConnectors.values()) {
      if (
        treeNodes.has(connector.sourceId) &&
        connector.targetId &&
        treeNodes.has(connector.targetId) &&
        !connectorsByTargetId.has(connector.targetId)
      ) {
        connectorsByTargetId.set(connector.targetId, connector);
        connectorsById.set(connector.element.id, connector);
      }
    }
    for (const [key, connector] of resolvedTrunkConnectors) {
      if (treeNodes.has(connector.sourceId)) {
        trunkConnectorsByKey.set(key, connector);
        connectorsById.set(connector.element.id, connector);
      }
    }

    trees.push({
      template,
      root: treeNodes.get(root.id)!,
      nodes: treeNodes,
      connectorsByTargetId,
      trunkConnectorsByKey,
      connectorsById,
    });
  }

  for (const tree of trees) {
    if (isMindMapTimelineTemplate(tree.template)) {
      normalizeTimelineTree(tree);
    }
  }

  return { trees, orphanConnectorIds };
};

export const resolveSelectedMindMapNodeElement = (
  elements: readonly OrderedExcalidrawElement[],
  selectedElementIds: SelectedElementIds,
) => {
  if (!selectedElementIds) {
    return null;
  }

  const selectedIds = Object.keys(selectedElementIds);
  if (selectedIds.length !== 1) {
    return null;
  }

  const selectedElement = elements.find((element) => element.id === selectedIds[0]);
  if (!selectedElement) {
    return null;
  }
  if (isMindMapRootElement(selectedElement) || isMindMapNodeElement(selectedElement)) {
    return selectedElement;
  }

  const selectedTextLike = selectedElement as OrderedExcalidrawElement & {
    type?: string;
    containerId?: string | null;
  };
  if (selectedTextLike.type === "text" && selectedTextLike.containerId) {
    const container = elements.find(
      (element) => element.id === selectedTextLike.containerId,
    );
    if (container && isMindMapRootElement(container)) {
      return container;
    }
  }

  return null;
};

const getChildrenForSide = (
  tree: MindMapTree,
  node: MindMapNode,
  side?: MindMapSide,
) => {
  const children = node.children
    .map((childId) => tree.nodes.get(childId))
    .filter((child): child is MindMapNode => Boolean(child));

  return typeof side === "string"
    ? children.filter((child) => child.side === side)
    : children;
};

const getSubtreeHeight = (
  tree: MindMapTree,
  nodeId: string,
  cache: Map<string, number>,
): number => {
  const cached = cache.get(nodeId);
  if (typeof cached === "number") {
    return cached;
  }

  const node = tree.nodes.get(nodeId)!;
  const children = getChildrenForSide(tree, node);
  const value = !children.length
    ? node.element.height
    : Math.max(
        node.element.height,
        children.reduce((total, child, index) => {
          return (
            total +
            getSubtreeHeight(tree, child.id, cache) +
            (index ? MIND_MAP_CHILD_GAP_Y : 0)
          );
        }, 0),
      );

  cache.set(nodeId, value);
  return value;
};

const createHorizontalConnectorPoints = (
  parentBox: Box,
  childBox: Box,
  side: MindMapSide,
) => {
  const startX = side === "right" ? parentBox.right + 12 : parentBox.x - 12;
  const endX = side === "right" ? childBox.x - 16 : childBox.right + 16;
  const bendX = side === "right" ? startX + 28 : startX - 28;
  return [
    [startX, parentBox.centerY],
    [bendX, parentBox.centerY],
    [bendX, childBox.centerY],
    [endX, childBox.centerY],
  ] as const;
};

const createDirectConnectorPoints = (
  parentBox: Box,
  childBox: Box,
  side: MindMapSide,
) => {
  const startX = side === "right" ? parentBox.right + 12 : parentBox.x - 12;
  const endX = side === "right" ? childBox.x - 16 : childBox.right + 16;
  return [
    [startX, parentBox.centerY],
    [endX, childBox.centerY],
  ] as const;
};

const createTrunkConnectorPoints = (
  parentBox: Box,
  childBoxes: readonly Box[],
  side: MindMapSide,
) => {
  const childCentersY = childBoxes.map((box) => box.centerY).sort((a, b) => a - b);
  const trunkX = side === "right" ? parentBox.right + 20 : parentBox.x - 20;
  return [
    [side === "right" ? parentBox.right + 12 : parentBox.x - 12, parentBox.centerY],
    [trunkX, parentBox.centerY],
    [trunkX, childCentersY[0]],
    [trunkX, childCentersY[childCentersY.length - 1]],
  ].map(([x, y]) => [x, y] as [number, number]);
};

const createLeafConnectorPoints = (
  childBox: Box,
  side: MindMapSide,
  trunkX: number,
) => {
  return [
    [trunkX, childBox.centerY],
    [side === "right" ? childBox.x - 16 : childBox.right + 16, childBox.centerY],
  ] as const;
};

const createRootTreeConnectorPoints = (
  parentBox: Box,
  childBox: Box,
  side: MindMapSide,
) => {
  const startX = parentBox.centerX;
  const endX = side === "right" ? childBox.x - 16 : childBox.right + 16;
  return [
    [startX, parentBox.bottom],
    [startX, childBox.centerY],
    [endX, childBox.centerY],
  ].map(([x, y]) => [x, y] as [number, number]);
};

const createRootTreeTrunkPoints = (
  parentBox: Box,
  childBoxes: readonly Box[],
) => {
  const childCentersY = childBoxes.map((box) => box.centerY).sort((a, b) => a - b);
  return [
    [parentBox.centerX, parentBox.bottom],
    [parentBox.centerX, childCentersY[0]],
    [parentBox.centerX, childCentersY[childCentersY.length - 1]],
  ].map(([x, y]) => [x, y] as [number, number]);
};

const getTimelineHorizontalNodeY = (
  parentBox: Box,
  childHeight: number,
  lane: MindMapLane | undefined,
) => {
  if (lane === "top") {
    return parentBox.centerY - TIMELINE_HORIZONTAL_GAP_Y - childHeight;
  }
  if (lane === "bottom") {
    return parentBox.centerY + TIMELINE_HORIZONTAL_GAP_Y;
  }
  return parentBox.centerY - childHeight / 2;
};

const getTimelineVerticalNodeX = (
  parentBox: Box,
  childWidth: number,
  lane: MindMapLane | undefined,
) => {
  if (lane === "left") {
    return parentBox.centerX - TIMELINE_VERTICAL_GAP_X - childWidth;
  }
  if (lane === "right") {
    return parentBox.centerX + TIMELINE_VERTICAL_GAP_X;
  }
  return parentBox.centerX - childWidth / 2;
};

const createTimelineHorizontalTrunkPoints = (
  parentBox: Box,
  childBoxes: readonly Box[],
  childLanes: readonly (MindMapLane | undefined)[],
) => {
  const starts = childBoxes.map((box, index) =>
    childLanes[index] === "center" ? box.x - TIMELINE_TEXT_GAP * 2 : box.x - TIMELINE_TEXT_GAP,
  );
  return [
    [parentBox.right + TIMELINE_TEXT_GAP, parentBox.centerY],
    [Math.max(...starts), parentBox.centerY],
  ].map(([x, y]) => [x, y] as [number, number]);
};

const createTimelineVerticalTrunkPoints = (
  parentBox: Box,
  childBoxes: readonly Box[],
  childLanes: readonly (MindMapLane | undefined)[],
) => {
  const ends = childBoxes.map((box, index) =>
    childLanes[index] === "center" ? box.centerY : box.centerY,
  );
  return [
    [parentBox.centerX, parentBox.bottom + 12],
    [parentBox.centerX, Math.max(...ends)],
  ].map(([x, y]) => [x, y] as [number, number]);
};

const createTimelineHorizontalLeafPoints = (
  childBox: Box,
  lane: MindMapLane | undefined,
  axisY: number,
) => {
  const entryX = childBox.x - TIMELINE_TEXT_GAP;
  if (lane === "center") {
    return [
      [entryX - TIMELINE_TEXT_GAP, axisY],
      [entryX, axisY],
    ] as const;
  }
  return [
    [entryX, axisY],
    [entryX, childBox.centerY],
  ] as const;
};

const createTimelineVerticalLeafPoints = (
  childBox: Box,
  lane: MindMapLane | undefined,
  axisX: number,
) => {
  if (lane === "center") {
    const entryX =
      childBox.centerX < axisX
        ? childBox.right + TIMELINE_TEXT_GAP
        : childBox.x - TIMELINE_TEXT_GAP;
    return [
      [axisX, childBox.centerY],
      [entryX, childBox.centerY],
    ] as const;
  }
  return [
    [axisX, childBox.centerY],
    [
      lane === "left"
        ? childBox.right + TIMELINE_TEXT_GAP
        : childBox.x - TIMELINE_TEXT_GAP,
      childBox.centerY,
    ],
  ] as const;
};

const createTimelineHorizontalBranchPoints = (
  parentBox: Box,
  childBox: Box,
) => {
  const branchX = parentBox.centerX;
  const parentEdgeY =
    childBox.centerY < parentBox.centerY
      ? parentBox.y - TIMELINE_TEXT_GAP
      : parentBox.bottom + TIMELINE_TEXT_GAP;
  return [
    [branchX, parentEdgeY],
    [branchX, childBox.centerY],
    [childBox.x - TIMELINE_TEXT_GAP, childBox.centerY],
  ] as const;
};

const createTimelineVerticalBranchPoints = (
  parentBox: Box,
  childBox: Box,
  lane: MindMapLane | undefined,
) => {
  const branchY = parentBox.centerY;
  const parentEdgeX =
    lane === "left"
      ? parentBox.x - TIMELINE_TEXT_GAP
      : parentBox.right + TIMELINE_TEXT_GAP;
  const childEntryX =
    lane === "left"
      ? childBox.right + TIMELINE_TEXT_GAP
      : childBox.x - TIMELINE_TEXT_GAP;
  return [
    [parentEdgeX, branchY],
    [childEntryX, branchY],
  ] as const;
};

const arePointsEqual = (
  left: readonly (readonly [number, number])[],
  right: readonly (readonly [number, number])[],
) => {
  return (
    left.length === right.length &&
    left.every(
      (point, index) =>
        point[0] === right[index]?.[0] && point[1] === right[index]?.[1],
    )
  );
};

const areConnectorElementsEquivalent = (
  left: OrderedExcalidrawElement & ExcalidrawLinearElement,
  right: OrderedExcalidrawElement & ExcalidrawLinearElement,
) => {
  const leftMeta = getMindMapElementMeta(left);
  const rightMeta = getMindMapElementMeta(right);
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height &&
    left.roundness === right.roundness &&
    arePointsEqual(left.points, right.points) &&
    leftMeta?.role === rightMeta?.role &&
    leftMeta?.template === rightMeta?.template &&
    leftMeta?.part === rightMeta?.part &&
    leftMeta?.sourceId === rightMeta?.sourceId &&
    leftMeta?.targetId === rightMeta?.targetId &&
    leftMeta?.side === rightMeta?.side
  );
};

const createConnectorElement = ({
  connector,
  sourceId,
  targetId,
  template,
  points,
  part,
  side,
}: {
  connector?: OrderedExcalidrawElement & ExcalidrawLinearElement;
  sourceId: string;
  targetId?: string;
  template: MindMapStencilKind;
  points: readonly (readonly [number, number])[];
  part: "leaf" | "trunk";
  side?: MindMapSide;
}): OrderedExcalidrawElement & ExcalidrawLinearElement => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const nextPoints = points.map(([x, y]) => [x - minX, y - minY] as [number, number]);

  if (!connector) {
    return newLinearElement({
      id: createMindMapId("connector"),
      type: "line",
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1),
      points: nextPoints,
      strokeColor: MIND_MAP_CONNECTOR_COLOR,
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      roundness: null,
      startArrowhead: null,
      endArrowhead: null,
      customData: {
        mindMap: {
          role: "connector",
          template,
          part,
          sourceId,
          targetId,
          side,
        },
      },
    } as any) as OrderedExcalidrawElement & ExcalidrawLinearElement;
  }

  const meta = getMindMapElementMeta(connector);
  if (
    connector.x === minX &&
    connector.y === minY &&
    connector.width === Math.max(maxX - minX, 1) &&
    connector.height === Math.max(maxY - minY, 1) &&
    arePointsEqual(connector.points, nextPoints) &&
    connector.roundness == null &&
    meta?.role === "connector" &&
    meta.template === template &&
    meta.part === part &&
    meta.sourceId === sourceId &&
    meta.targetId === targetId &&
    meta.side === side
  ) {
    return connector as OrderedExcalidrawElement & ExcalidrawLinearElement;
  }

  return newElementWith(connector, {
    x: minX,
    y: minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
    points: nextPoints,
    roundness: null,
    customData: {
      ...connector.customData,
      mindMap: {
        ...getMindMapElementMeta(connector),
        role: "connector",
        template,
        part,
        sourceId,
        targetId,
        side,
      },
    },
  }) as OrderedExcalidrawElement & ExcalidrawLinearElement;
};

const createNodeUpdate = (
  node: MindMapNode,
  nextX: number,
  nextY: number,
  template: MindMapStencilKind,
): OrderedExcalidrawElement => {
  const meta = getMindMapElementMeta(node.element);
  if (
    node.element.x === nextX &&
    node.element.y === nextY &&
    meta?.role === (node.parentId ? "node" : "root") &&
    meta.template === template &&
    meta.nodeId === node.id &&
    (meta.parentId || undefined) === (node.parentId || undefined) &&
    (meta.side || undefined) === (node.parentId ? node.side : undefined) &&
    (meta.lane || undefined) === node.lane &&
    (typeof meta.order === "number" ? meta.order : undefined) ===
      (node.parentId ? node.order : undefined) &&
    meta.level === node.level
  ) {
    return node.element;
  }

  return newElementWith(node.element, {
    x: nextX,
    y: nextY,
    customData: {
      ...node.element.customData,
      mindMap: {
        ...meta,
        role: node.parentId ? "node" : "root",
        template,
        nodeId: node.id,
        parentId: node.parentId || undefined,
        side: node.parentId ? node.side : undefined,
        lane: node.lane,
        order: node.parentId ? node.order : undefined,
        level: node.level,
      },
    },
  }) as OrderedExcalidrawElement;
};

const layoutMindMapTree = (tree: MindMapTree) => {
  const positions = new Map<string, { x: number; y: number }>();
  const subtreeHeightCache = new Map<string, number>();
  const rootBox = getBox(tree.root.element);
  positions.set(tree.root.id, {
    x: tree.root.element.x,
    y: tree.root.element.y,
  });

  const layoutCenteredChildren = (parent: MindMapNode, side: MindMapSide) => {
    const children = getChildrenForSide(tree, parent, side);
    if (!children.length) {
      return;
    }

    const parentPosition = positions.get(parent.id) || {
      x: parent.element.x,
      y: parent.element.y,
    };
    const parentBox = getBox({
      ...parent.element,
      ...parentPosition,
    });
    const totalHeight = children.reduce((total, child, index) => {
      return (
        total +
        getSubtreeHeight(tree, child.id, subtreeHeightCache) +
        (index ? MIND_MAP_CHILD_GAP_Y : 0)
      );
    }, 0);
    let cursorY = parentBox.centerY - totalHeight / 2;

    for (const child of children) {
      const subtreeHeight = getSubtreeHeight(tree, child.id, subtreeHeightCache);
      const nextY = cursorY + subtreeHeight / 2 - child.element.height / 2;
      const gapX = parent.parentId
        ? MIND_MAP_CHILD_GAP_X
        : MIND_MAP_ROOT_CHILD_GAP_X;
      const nextX =
        side === "right"
          ? parentBox.right + gapX
          : parentBox.x - gapX - child.element.width;
      positions.set(child.id, { x: nextX, y: nextY });
      layoutCenteredChildren(child, child.side);
      cursorY += subtreeHeight + MIND_MAP_CHILD_GAP_Y;
    }
  };

  if (getMindMapTemplateFamily(tree.template) === "map") {
    for (const side of ["left", "right"] as const) {
      if (getChildrenForSide(tree, tree.root, side).length) {
        layoutCenteredChildren(tree.root, side);
      }
    }
    return positions;
  }

  if (getMindMapTemplateFamily(tree.template) === "timeline") {
    const orientation = getMindMapTimelineOrientation(tree.template);
    const axisX = rootBox.centerX;
    if (!orientation) {
      return positions;
    }

    const centerChain: MindMapNode[] = [];
    let parent = tree.root;
    while (true) {
      const nextCenter = getChildrenForSide(tree, parent)
        .filter((child) => child.lane === "center")
        .sort((left, right) => left.order - right.order)[0];
      if (!nextCenter || centerChain.some((node) => node.id === nextCenter.id)) {
        break;
      }
      centerChain.push(nextCenter);
      parent = nextCenter;
    }

    let cursor =
      orientation === "horizontal"
        ? rootBox.right + TIMELINE_HORIZONTAL_GAP_X
        : rootBox.bottom + TIMELINE_VERTICAL_GAP_Y;
    for (const child of centerChain) {
      if (orientation === "horizontal") {
        positions.set(child.id, {
          x: cursor,
          y: getTimelineHorizontalNodeY(rootBox, child.element.height, "center"),
        });
        cursor += child.element.width + TIMELINE_HORIZONTAL_GAP_X;
      } else {
        positions.set(child.id, {
          x: axisX - child.element.width / 2,
          y: cursor,
        });
        cursor += child.element.height + TIMELINE_VERTICAL_GAP_Y;
      }
    }

    const layoutTimelineBranches = (parent: MindMapNode) => {
      const branchChildren = getChildrenForSide(tree, parent).filter(
        (child) => child.lane !== "center",
      );
      if (!branchChildren.length) {
        return;
      }

      const parentPosition = positions.get(parent.id) || {
        x: parent.element.x,
        y: parent.element.y,
      };
      const parentBox = getBox({
        ...parent.element,
        ...parentPosition,
        });

      for (const child of branchChildren) {
        if (orientation === "horizontal") {
          const nextX = parentBox.right + TIMELINE_TEXT_GAP * 2;
          const nextY = getTimelineHorizontalNodeY(
            parentBox,
            child.element.height,
            child.lane,
          );
          positions.set(child.id, { x: nextX, y: nextY });
        } else {
          const nextY = parentBox.centerY - child.element.height / 2;
          const nextX =
            child.lane === "left"
              ? parentBox.x - TIMELINE_TEXT_GAP * 3 - child.element.width
              : parentBox.right + TIMELINE_TEXT_GAP * 3;
          positions.set(child.id, { x: nextX, y: nextY });
        }
        layoutTimelineBranches(child);
      }
    };

    layoutTimelineBranches(tree.root);
    for (const centerNode of centerChain) {
      layoutTimelineBranches(centerNode);
    }
    return positions;
  }

  if (getMindMapTemplateFamily(tree.template) === "tree") {
    for (const side of ["left", "right"] as const) {
      const rootChildren = getChildrenForSide(tree, tree.root, side);
      if (!rootChildren.length) {
        continue;
      }

      let cursorY = rootBox.bottom + MIND_MAP_TREE_ROOT_GAP_Y;
      for (const child of rootChildren) {
        const subtreeHeight = getSubtreeHeight(tree, child.id, subtreeHeightCache);
        const nextY = cursorY + subtreeHeight / 2 - child.element.height / 2;
        const nextX =
          side === "right"
            ? rootBox.centerX + MIND_MAP_ROOT_CHILD_GAP_X
            : rootBox.centerX - MIND_MAP_ROOT_CHILD_GAP_X - child.element.width;
        positions.set(child.id, { x: nextX, y: nextY });
        layoutCenteredChildren(child, child.side);
        cursorY += subtreeHeight + MIND_MAP_CHILD_GAP_Y;
      }
    }
  }

  return positions;
};

export const synchronizeMindMapElements = (
  elements: readonly OrderedExcalidrawElement[],
  _selectedElementIds?: SelectedElementIds,
) => {
  const deletedMindMapNodeIds = new Set<string>(
    elements
      .filter(
        (element) =>
          element.isDeleted &&
          (isMindMapRootElement(element) || isMindMapNodeElement(element)),
      )
      .map((element) => getMindMapElementMeta(element)?.nodeId || element.id),
  );
  const cascadedDeletedNodeIds = new Set(deletedMindMapNodeIds);

  if (cascadedDeletedNodeIds.size) {
    let discovered = true;
    while (discovered) {
      discovered = false;
      for (const element of elements) {
        if (
          element.isDeleted ||
          (!isMindMapRootElement(element) && !isMindMapNodeElement(element))
        ) {
          continue;
        }
        const meta = getMindMapElementMeta(element);
        const nodeId = meta?.nodeId || element.id;
        if (
          meta?.parentId &&
          cascadedDeletedNodeIds.has(meta.parentId) &&
          !cascadedDeletedNodeIds.has(nodeId)
        ) {
          cascadedDeletedNodeIds.add(nodeId);
          discovered = true;
        }
      }
    }
  }

  let changed = false;
  const baseElements = elements.map((element) => {
    if (element.isDeleted) {
      return element;
    }
    const meta = getMindMapElementMeta(element);
    const nodeId = meta?.nodeId || element.id;
    if (
      (isMindMapRootElement(element) || isMindMapNodeElement(element)) &&
      cascadedDeletedNodeIds.has(nodeId)
    ) {
      changed = true;
      return newElementWith(element, {
        isDeleted: true,
      }) as OrderedExcalidrawElement;
    }
    if (
      isMindMapConnectorElement(element) &&
      (cascadedDeletedNodeIds.has(meta?.sourceId || "") ||
        cascadedDeletedNodeIds.has(meta?.targetId || ""))
    ) {
      changed = true;
      return newElementWith(element, {
        isDeleted: true,
      }) as OrderedExcalidrawElement;
    }
    return element;
  }) as OrderedExcalidrawElement[];

  const { trees, orphanConnectorIds } = buildMindMapTrees(
    baseElements,
    _selectedElementIds,
  );
  if (!trees.length && !orphanConnectorIds.size) {
    return changed ? { changed, elements: baseElements } : { changed: false, elements };
  }

  const updates = new Map<string, OrderedExcalidrawElement>();
  const inserted: OrderedExcalidrawElement[] = [];
  const connectorsToDelete = new Set<string>();
  const generatedTrunkKeys = new Set<string>();

  for (const tree of trees) {
    const positions = layoutMindMapTree(tree);
    const unusedConnectorIds = new Set(tree.connectorsById.keys());
    const getPositionedBox = (node: MindMapNode) => {
      const position = positions.get(node.id);
      return getBox(
        position
          ? {
              ...node.element,
              ...position,
            }
          : node.element,
      );
    };

    if (isMindMapTimelineTemplate(tree.template)) {
      const orientation = getMindMapTimelineOrientation(tree.template);
      const timelineRootBox = getPositionedBox(tree.root);
      const timelineAxisX = timelineRootBox.centerX;
      const timelineCenterNodes = [...tree.nodes.values()]
        .filter((node) => node.id !== tree.root.id && node.lane === "center")
        .sort((left, right) => left.order - right.order);
      const timelineCenterBoxes = timelineCenterNodes.map((node) =>
        getPositionedBox(node),
      );

      for (const node of tree.nodes.values()) {
        if (node.id === tree.root.id) {
          continue;
        }
        const position = positions.get(node.id);
        if (!position) {
          continue;
        }

        const nextNode = createNodeUpdate(
          node,
          position.x,
          position.y,
          tree.template,
        );
        if (nextNode !== node.element) {
          updates.set(node.id, nextNode);
          changed = true;
        }
      }

      for (const parent of tree.nodes.values()) {
        const children = getChildrenForSide(tree, parent);
        if (!children.length || !orientation) {
          continue;
        }

        const centerChildren = children.filter((child) => child.lane === "center");
        const branchChildren = children.filter((child) => child.lane !== "center");

        const parentBox = getPositionedBox(parent);
        const childBoxes = centerChildren.map((child) => getPositionedBox(child));
        const childLanes = centerChildren.map((child) => child.lane);
        const trunkKey = getTimelineTrunkConnectorKey(parent.id);
        const existingTrunk = tree.trunkConnectorsByKey.get(trunkKey)?.element;
        if (existingTrunk) {
          unusedConnectorIds.delete(existingTrunk.id);
        }

        const shouldCreateTrunk =
          centerChildren.length &&
          (orientation === "horizontal" || parent.id === tree.root.id);

        if (shouldCreateTrunk) {
          const trunkPoints =
            orientation === "horizontal"
              ? createTimelineHorizontalTrunkPoints(
                  parentBox,
                  childBoxes,
                  childLanes,
                )
              : createTimelineVerticalTrunkPoints(
                  { ...timelineRootBox, centerX: timelineAxisX },
                  timelineCenterBoxes,
                  timelineCenterNodes.map((node) => node.lane),
                );
          const nextTrunk = createConnectorElement({
            connector: existingTrunk,
            sourceId: parent.id,
            template: tree.template,
            points: trunkPoints,
            part: "trunk",
          });

          if (!existingTrunk) {
            inserted.push(nextTrunk);
            changed = true;
          } else if (nextTrunk !== existingTrunk) {
            updates.set(existingTrunk.id, nextTrunk);
            changed = true;
          }
        } else if (existingTrunk) {
          connectorsToDelete.add(existingTrunk.id);
        }

        for (const child of children) {
          const childBox = getPositionedBox(child);
          const connector = tree.connectorsByTargetId.get(child.id)?.element;
          if (orientation === "vertical" && child.lane === "center") {
            if (connector) {
              connectorsToDelete.add(connector.id);
              unusedConnectorIds.delete(connector.id);
            }
            continue;
          }
          const points =
            child.lane === "center"
              ? orientation === "horizontal"
                ? createTimelineHorizontalLeafPoints(
                    childBox,
                    child.lane,
                    parentBox.centerY,
                  )
                : createTimelineVerticalLeafPoints(
                    childBox,
                    child.lane,
                    timelineAxisX,
                  )
              : orientation === "horizontal"
                ? createTimelineHorizontalBranchPoints(parentBox, childBox)
                : createTimelineVerticalBranchPoints(
                    parentBox,
                    childBox,
                    child.lane,
                  );
          const nextConnector = createConnectorElement({
            connector,
            sourceId: parent.id,
            targetId: child.id,
            template: tree.template,
            points,
            part: "leaf",
            side: child.side,
          });
          const resolvedConnector =
            connector && areConnectorElementsEquivalent(connector, nextConnector)
              ? connector
              : nextConnector;

          if (!connector) {
            inserted.push(resolvedConnector);
            changed = true;
          } else if (resolvedConnector !== connector) {
            updates.set(connector.id, resolvedConnector);
            changed = true;
          }
          if (connector) {
            unusedConnectorIds.delete(connector.id);
          }
        }
      }

      for (const connectorId of unusedConnectorIds) {
        connectorsToDelete.add(connectorId);
      }
      continue;
    }

    for (const node of tree.nodes.values()) {
      if (node.id === tree.root.id) {
        continue;
      }
      const position = positions.get(node.id);
      if (!position) {
        continue;
      }

      const nextNode = createNodeUpdate(
        node,
        position.x,
        position.y,
        tree.template,
      );
      if (nextNode !== node.element) {
        updates.set(node.id, nextNode);
        changed = true;
      }

      const parent = tree.nodes.get(node.parentId || "");
      if (!parent) {
        continue;
      }

      const parentBox = getPositionedBox(parent);
      const childBox = getPositionedBox(node);
      const connector = tree.connectorsByTargetId.get(node.id)?.element;
      const siblingsOnSide = getChildrenForSide(tree, parent, node.side).map(
        (sibling) => getPositionedBox(sibling),
      );
      const useTrunk = siblingsOnSide.length > 1;
      const trunkKey = getTrunkConnectorKey(parent.id, node.side);
      const existingTrunk = tree.trunkConnectorsByKey.get(trunkKey)?.element;
      const trunkX =
        getMindMapTemplateFamily(tree.template) === "tree" &&
        parent.id === tree.root.id
          ? parentBox.centerX
          : node.side === "right"
          ? parentBox.right + 20
          : parentBox.x - 20;

      if (existingTrunk) {
        unusedConnectorIds.delete(existingTrunk.id);
      }

      if (useTrunk && !generatedTrunkKeys.has(trunkKey)) {
        generatedTrunkKeys.add(trunkKey);
        const trunkPoints =
          getMindMapTemplateFamily(tree.template) === "tree" &&
          parent.id === tree.root.id
            ? createRootTreeTrunkPoints(parentBox, siblingsOnSide)
            : createTrunkConnectorPoints(parentBox, siblingsOnSide, node.side);
        const nextTrunk = createConnectorElement({
          connector: existingTrunk,
          sourceId: parent.id,
          template: tree.template,
          points: trunkPoints,
          part: "trunk",
          side: node.side,
        });

        if (!existingTrunk) {
          inserted.push(nextTrunk);
          changed = true;
        } else if (nextTrunk !== existingTrunk) {
          updates.set(existingTrunk.id, nextTrunk);
          changed = true;
        }
      } else if (!useTrunk) {
        if (existingTrunk) {
          connectorsToDelete.add(existingTrunk.id);
        }
      }

      const points = useTrunk
        ? createLeafConnectorPoints(childBox, node.side, trunkX)
        : getMindMapTemplateFamily(tree.template) === "tree" &&
          parent.id === tree.root.id
        ? createRootTreeConnectorPoints(parentBox, childBox, node.side)
        : createDirectConnectorPoints(parentBox, childBox, node.side);
      const nextConnector = createConnectorElement({
        connector,
        sourceId: parent.id,
        targetId: node.id,
        template: tree.template,
        points,
        part: "leaf",
        side: node.side,
      });
      const resolvedConnector =
        connector && areConnectorElementsEquivalent(connector, nextConnector)
          ? connector
          : nextConnector;

      if (!connector) {
        inserted.push(resolvedConnector);
        changed = true;
      } else if (resolvedConnector !== connector) {
        updates.set(connector.id, resolvedConnector);
        changed = true;
      }
      if (connector) {
        unusedConnectorIds.delete(connector.id);
      }
    }

    for (const connectorId of unusedConnectorIds) {
      connectorsToDelete.add(connectorId);
    }
  }

  const nextElements = baseElements.map((element) => {
    if (orphanConnectorIds.has(element.id) || connectorsToDelete.has(element.id)) {
      changed = true;
      return newElementWith(element, {
        isDeleted: true,
      }) as OrderedExcalidrawElement;
    }
    return updates.get(element.id) || element;
  }) as OrderedExcalidrawElement[];

  if (!inserted.length) {
    return changed
      ? { changed: true, elements: nextElements }
      : { changed: false, elements };
  }

  return {
    changed: true,
    elements: syncInvalidIndices([...nextElements, ...inserted]),
  };
};

export const getNextMindMapChildSide = (
  tree: MindMapTree,
  parent: MindMapNode,
): MindMapSide => {
  if (getMindMapTemplateFamily(tree.template) === "map") {
    return parent.id === tree.root.id
      ? getMindMapDefaultSide(tree.template)
      : parent.side;
  }

  if (tree.template === "tree-balanced" && parent.id === tree.root.id) {
    const leftCount = getChildrenForSide(tree, parent, "left").length;
    const rightCount = getChildrenForSide(tree, parent, "right").length;
    return rightCount <= leftCount ? "right" : "left";
  }

  return parent.id === tree.root.id
    ? getMindMapDefaultSide(tree.template)
    : parent.side;
};

const getNextTimelineLane = ({
  tree,
  parent,
  node,
  mode,
}: {
  tree: MindMapTree;
  parent: MindMapNode;
  node?: MindMapNode;
  mode: MindMapInsertMode;
}): MindMapLane => {
  const orientation = getMindMapTimelineOrientation(tree.template);
  const childNodes = getChildrenForSide(tree, parent);
  if (orientation === "horizontal") {
    if (mode === "child") {
      if (parent.id === tree.root.id || parent.lane === "center") {
        return "center";
      }
      return parent.lane || "top";
    }

    if (mode === "sibling" && node?.lane === "center") {
      return node.order % 2 === 0 ? "top" : "bottom";
    }

    if (mode === "sibling" && node?.lane) {
      return node.lane;
    }

    if (parent.id !== tree.root.id && parent.lane) {
      return parent.lane;
    }
    return "center";
  }

  if (mode === "child") {
    if (parent.id === tree.root.id || parent.lane === "center") {
      return "center";
    }
    return parent.lane || "right";
  }

  if (mode === "sibling" && node?.lane === "center") {
    return node.order % 2 === 0 ? "right" : "left";
  }

  if (mode === "sibling" && node?.lane) {
    return node.lane;
  }
  if (parent.id !== tree.root.id && parent.lane) {
    return parent.lane;
  }
  return "center";
};

const createTimelineNodeElements = ({
  tree,
  parent,
  node,
  mode,
  defaults,
}: {
  tree: MindMapTree;
  parent: MindMapNode;
  node?: MindMapNode;
  mode: MindMapInsertMode;
  defaults: MindMapStencilDefaults;
}) => {
  const nodeId = createMindMapId("node");
  const lane = getNextTimelineLane({ tree, parent, node, mode });
  const level =
    lane === "center"
      ? 1
      : mode === "sibling" && node?.lane !== "center" && node
      ? node.level
      : parent.level + 1;
  const label = level === 1 ? defaults.event : defaults.subtopic;
  const orientation = getMindMapTimelineOrientation(tree.template);
  const centerOrders = [...tree.nodes.values()]
    .filter((entry) => entry.id !== tree.root.id && entry.lane === "center")
    .map((entry) => entry.order);
  const order =
    lane === "center"
      ? mode === "sibling" && node
        ? node.order + 0.5
        : parent.lane === "center"
        ? parent.order + 0.5
        : Math.max(-1, ...centerOrders) + 1
      : mode === "sibling" && node?.lane !== "center" && node
      ? node.order + 0.5
      : parent.children.filter((childId) => {
          const child = tree.nodes.get(childId);
          return child?.lane !== "center";
        }).length;
  const provisionalX =
    orientation === "horizontal"
      ? lane === "center"
        ? parent.element.x + parent.element.width + TIMELINE_HORIZONTAL_GAP_X
        : parent.element.x + parent.element.width + TIMELINE_TEXT_GAP * 2
      : lane === "left"
      ? parent.element.x - TIMELINE_VERTICAL_GAP_X - 80
      : lane === "right"
      ? parent.element.x + parent.element.width + TIMELINE_VERTICAL_GAP_X
      : parent.element.x;
  const provisionalY =
    orientation === "horizontal"
      ? lane === "top"
        ? parent.element.y - 48
        : lane === "bottom"
        ? parent.element.y + 56
        : parent.element.y
      : lane === "center"
      ? parent.element.y + parent.element.height + TIMELINE_VERTICAL_GAP_Y
      : parent.element.y;

  const textElement = newTextElement({
    id: nodeId,
    x: provisionalX,
    y: provisionalY,
    text: label,
    fontFamily: MIND_MAP_FONT_FAMILY,
    fontSize: MIND_MAP_FONT_SIZE,
    lineHeight: MIND_MAP_LINE_HEIGHT,
    textAlign: "left",
    verticalAlign: "top",
    autoResize: true,
    strokeColor: MIND_MAP_TOPIC_TEXT,
    customData: {
      mindMap: {
        role: "node",
        template: tree.template,
        nodeId,
        parentId: parent.id,
        side: lane === "left" ? "left" : "right",
        lane,
        order,
        level,
      },
    },
  } as any) as OrderedExcalidrawElement;

  const connectorElement = newLinearElement({
    id: createMindMapId("connector"),
    type: "line",
    x: parent.element.x,
    y: parent.element.y,
    width: 1,
    height: 1,
    points: [
      [0, 0] as [number, number],
      [1, 0] as [number, number],
    ],
    strokeColor: MIND_MAP_CONNECTOR_COLOR,
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    roundness: null,
    startArrowhead: null,
    endArrowhead: null,
    customData: {
      mindMap: {
        role: "connector",
        template: tree.template,
        part: "leaf",
        sourceId: parent.id,
        targetId: nodeId,
        side: lane === "left" ? "left" : "right",
      },
    },
  } as any) as OrderedExcalidrawElement;

  return syncInvalidIndices([textElement, connectorElement]);
};

export const createMindMapChildElements = ({
  tree,
  parentId,
  defaults = getMindMapStencilDefaults(),
}: {
  tree: MindMapTree;
  parentId: string;
  defaults?: MindMapStencilDefaults;
}) => {
  const parent = tree.nodes.get(parentId);
  if (!parent) {
    return [] as OrderedExcalidrawElement[];
  }

  if (isMindMapTimelineTemplate(tree.template)) {
    return createTimelineNodeElements({
      tree,
      parent,
      mode: "child",
      defaults,
    });
  }

  const side = getNextMindMapChildSide(tree, parent);
  const siblings = getChildrenForSide(tree, parent, side);
  const order = siblings.length;
  const level = parent.level + 1;
  const nodeId = createMindMapId("node");
  const label = level === 1 ? defaults.topic : defaults.subtopic;
  const provisionalX =
    side === "right"
      ? parent.element.x + parent.element.width + MIND_MAP_ROOT_CHILD_GAP_X
      : parent.element.x - MIND_MAP_ROOT_CHILD_GAP_X;
  const provisionalY =
    parent.element.y + parent.element.height + MIND_MAP_CHILD_GAP_Y;

  const textElement = newTextElement({
    id: nodeId,
    x: provisionalX,
    y: provisionalY,
    text: label,
    fontFamily: MIND_MAP_FONT_FAMILY,
    fontSize: MIND_MAP_FONT_SIZE,
    lineHeight: MIND_MAP_LINE_HEIGHT,
    textAlign: "left",
    verticalAlign: "top",
    autoResize: true,
    strokeColor: MIND_MAP_TOPIC_TEXT,
    customData: {
      mindMap: {
        role: "node",
        template: tree.template,
        nodeId,
        parentId,
        side,
        order,
        level,
      },
    },
  } as any) as OrderedExcalidrawElement;

  const connectorElement = newLinearElement({
    id: createMindMapId("connector"),
    type: "line",
    x: parent.element.x,
    y: parent.element.y,
    width: 1,
    height: 1,
    points: [
      [0, 0] as [number, number],
      [1, 0] as [number, number],
    ],
    strokeColor: MIND_MAP_CONNECTOR_COLOR,
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    roundness: null,
    startArrowhead: null,
    endArrowhead: null,
    customData: {
      mindMap: {
        role: "connector",
        template: tree.template,
        sourceId: parentId,
        targetId: nodeId,
      },
    },
  } as any) as OrderedExcalidrawElement;

  return syncInvalidIndices([textElement, connectorElement]);
};

export const createMindMapSiblingElements = ({
  tree,
  nodeId,
  defaults = getMindMapStencilDefaults(),
}: {
  tree: MindMapTree;
  nodeId: string;
  defaults?: MindMapStencilDefaults;
}) => {
  const node = tree.nodes.get(nodeId);
  if (!node) {
    return [] as OrderedExcalidrawElement[];
  }
  if (!node.parentId) {
    return createMindMapChildElements({
      tree,
      parentId: nodeId,
      defaults,
    });
  }

  const parent = tree.nodes.get(node.parentId);
  if (!parent) {
    return [] as OrderedExcalidrawElement[];
  }

  if (isMindMapTimelineTemplate(tree.template)) {
    const timelineParent = node?.lane === "center" ? node : parent;
    return createTimelineNodeElements({
      tree,
      parent: timelineParent,
      node,
      mode: "sibling",
      defaults,
    });
  }

  const nodeIdToInsert = createMindMapId("node");
  const label = node.level === 1 ? defaults.topic : defaults.subtopic;
  const provisionalX =
    node.side === "right"
      ? parent.element.x + parent.element.width + MIND_MAP_ROOT_CHILD_GAP_X
      : parent.element.x - MIND_MAP_ROOT_CHILD_GAP_X;
  const provisionalY = node.element.y + node.element.height + MIND_MAP_CHILD_GAP_Y;

  const textElement = newTextElement({
    id: nodeIdToInsert,
    x: provisionalX,
    y: provisionalY,
    text: label,
    fontFamily: MIND_MAP_FONT_FAMILY,
    fontSize: MIND_MAP_FONT_SIZE,
    lineHeight: MIND_MAP_LINE_HEIGHT,
    textAlign: "left",
    verticalAlign: "top",
    autoResize: true,
    strokeColor: MIND_MAP_TOPIC_TEXT,
    customData: {
      mindMap: {
        role: "node",
        template: tree.template,
        nodeId: nodeIdToInsert,
        parentId: node.parentId,
        side: node.side,
        order: node.order + 0.5,
        level: node.level,
      },
    },
  } as any) as OrderedExcalidrawElement;

  const connectorElement = newLinearElement({
    id: createMindMapId("connector"),
    type: "line",
    x: parent.element.x,
    y: parent.element.y,
    width: 1,
    height: 1,
    points: [
      [0, 0] as [number, number],
      [1, 0] as [number, number],
    ],
    strokeColor: MIND_MAP_CONNECTOR_COLOR,
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    roundness: null,
    startArrowhead: null,
    endArrowhead: null,
    customData: {
      mindMap: {
        role: "connector",
        template: tree.template,
        sourceId: node.parentId,
        targetId: nodeIdToInsert,
      },
    },
  } as any) as OrderedExcalidrawElement;

  return syncInvalidIndices([textElement, connectorElement]);
};

export const insertMindMapNode = ({
  elements,
  selectedElementIds,
  mode,
  defaults = getMindMapStencilDefaults(),
}: {
  elements: readonly OrderedExcalidrawElement[];
  selectedElementIds: SelectedElementIds;
  mode: MindMapInsertMode;
  defaults?: MindMapStencilDefaults;
}) => {
  const normalized = synchronizeMindMapElements(elements, selectedElementIds);
  const sourceElements = normalized.elements;
  const selectedNode = resolveSelectedMindMapNodeElement(
    sourceElements,
    selectedElementIds,
  );
  if (!selectedNode) {
    return null;
  }

  const tree = buildMindMapTrees(sourceElements, selectedElementIds).trees.find((entry) =>
    entry.nodes.has(selectedNode.id),
  );
  if (!tree) {
    return null;
  }

  const insertedElements =
    mode === "child"
      ? createMindMapChildElements({
          tree,
          parentId: selectedNode.id,
          defaults,
        })
      : createMindMapSiblingElements({
          tree,
          nodeId: selectedNode.id,
          defaults,
        });

  if (!insertedElements.length) {
    return null;
  }

  const insertedNode = insertedElements.find((element) => isMindMapNodeElement(element));
  if (!insertedNode) {
    return null;
  }

  const nextElements = syncInvalidIndices([
    ...sourceElements,
    ...insertedElements,
  ]);
  const synced = synchronizeMindMapElements(nextElements, selectedElementIds);
  const editingElement = synced.elements.find(
    (element) => element.id === insertedNode.id,
  ) as OrderedExcalidrawElement | undefined;

  return {
    elements: synced.elements,
    selectedElementIds: { [insertedNode.id]: true } as Record<string, true>,
    insertedNodeId: insertedNode.id,
    editingElement: editingElement || null,
  };
};

export const getMindMapInsertPreview = ({
  elements,
  selectedElementIds,
  mode,
  defaults = getMindMapStencilDefaults(),
}: {
  elements: readonly OrderedExcalidrawElement[];
  selectedElementIds: SelectedElementIds;
  mode: MindMapInsertMode;
  defaults?: MindMapStencilDefaults;
}) => {
  const clonedElements = elements.map((element) =>
    deepCopyElement(element),
  ) as OrderedExcalidrawElement[];
  const result = insertMindMapNode({
    elements: clonedElements,
    selectedElementIds,
    mode,
    defaults,
  });
  if (!result) {
    return null;
  }

  const insertedNode = result.elements.find(
    (element) => element.id === result.insertedNodeId,
  );
  if (!insertedNode || !isMindMapNodeElement(insertedNode)) {
    return null;
  }

  return {
    x: insertedNode.x + insertedNode.width / 2,
    y: insertedNode.y + insertedNode.height / 2,
    node: insertedNode,
  };
};
