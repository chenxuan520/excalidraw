import { FONT_FAMILY, ROUNDNESS } from "../../packages/excalidraw/constants";
import { convertToExcalidrawElements } from "../../packages/excalidraw";
import type { ExcalidrawElementSkeleton } from "../../packages/excalidraw/data/transform";
import type {
  FontFamilyValues,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import { getLineHeight } from "../../packages/excalidraw/fonts";
import {
  getMindMapDefaultSide,
  MIND_MAP_FONT_SIZE,
  MIND_MAP_ROOT_FILL,
  MIND_MAP_ROOT_HEIGHT,
  MIND_MAP_ROOT_TEXT,
  MIND_MAP_ROOT_WIDTH,
  MIND_MAP_TOPIC_TEXT,
  type MindMapSide,
  type MindMapElementData,
  type MindMapStencilKind,
} from "./mindMapStencils";
import { synchronizeMindMapElements } from "./mindMapSystem";

export const DEFAULT_MARKDOWN_MIND_MAP_EXAMPLE = `# Product roadmap
## Foundation
### Editor shell
### Sync model
## Delivery
### CLI bridge
### Browser deployment
## Follow-up
### Auth
### Audit log`;

export const DEFAULT_MARKDOWN_MIND_MAP_MAX_DEPTH = 6;
export const DEFAULT_MARKDOWN_MIND_MAP_TEMPLATE = "mindmap-right" as const;
export const DEFAULT_MARKDOWN_MIND_MAP_FONT_FAMILY = FONT_FAMILY["Comic Shanns"];

export type MarkdownMindMapTemplate = Exclude<
  MindMapStencilKind,
  "timeline-horizontal" | "timeline-vertical"
>;

export const MARKDOWN_MIND_MAP_TEMPLATES: readonly MarkdownMindMapTemplate[] = [
  "mindmap-right",
  "mindmap-left",
  "tree-right",
  "tree-left",
  "tree-balanced",
];

export type MarkdownHeading = {
  depth: number;
  text: string;
  line: number;
};

export type MarkdownHeadingNode = {
  depth: number;
  text: string;
  children: MarkdownHeadingNode[];
};

export type MarkdownHeadingTree = {
  rootLabel: string;
  usesSyntheticRoot: boolean;
  children: MarkdownHeadingNode[];
};

export const MARKDOWN_MIND_MAP_FONT_OPTIONS = [
  FONT_FAMILY.Excalifont,
  FONT_FAMILY["Comic Shanns"],
  FONT_FAMILY.Helvetica,
  FONT_FAMILY.Cascadia,
  FONT_FAMILY.Virgil,
  FONT_FAMILY["Liberation Sans"],
  FONT_FAMILY.Nunito,
  FONT_FAMILY["Lilita One"],
  FONT_FAMILY.Yutong,
] as const satisfies readonly FontFamilyValues[];

export const clampMarkdownMindMapMaxDepth = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_MARKDOWN_MIND_MAP_MAX_DEPTH;
  }

  return Math.max(
    1,
    Math.min(DEFAULT_MARKDOWN_MIND_MAP_MAX_DEPTH, Math.floor(value)),
  );
};

const createMindMapId = (prefix: string) =>
  `mindmap-${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const createMindMapMeta = (
  role: MindMapElementData["role"],
  template: MindMapStencilKind,
  extra?: Omit<MindMapElementData, "role" | "template">,
) => ({
  mindMap: {
    role,
    template,
    ...extra,
  },
});

const stripClosingHashes = (text: string) =>
  text.replace(/[ \t]+#+[ \t]*$/, "").trim();

const forEachMarkdownContentLine = (
  markdown: string,
  callback: (line: string, lineNumber: number) => void,
) => {
  const lines = markdown.split(/\r?\n/);

  let inFrontMatter = lines[0]?.trim() === "---";
  let inFence = false;
  let fenceChar = "";
  let fenceLength = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] || "";
    const trimmed = line.trim();

    if (inFrontMatter) {
      if (index !== 0 && (trimmed === "---" || trimmed === "...")) {
        inFrontMatter = false;
      }
      continue;
    }

    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      const currentFenceChar = marker[0]!;

      if (!inFence) {
        inFence = true;
        fenceChar = currentFenceChar;
        fenceLength = marker.length;
        continue;
      }

      if (currentFenceChar === fenceChar && marker.length >= fenceLength) {
        inFence = false;
        fenceChar = "";
        fenceLength = 0;
        continue;
      }
    }

    if (inFence) {
      continue;
    }

    callback(line, index + 1);
  }
};

const parseMarkdownHeadingsInternal = (markdown: string) => {
  const headings: MarkdownHeading[] = [];

  forEachMarkdownContentLine(markdown, (line, lineNumber) => {
    const match = line.match(/^\s{0,3}(#{1,6})[ \t]+(.+)$/);
    if (!match) {
      return;
    }

    const text = stripClosingHashes(match[2]!);
    if (!text) {
      return;
    }

    headings.push({
      depth: match[1]!.length,
      text,
      line: lineNumber,
    });
  });

  return headings;
};

const parseMarkdownBulletItemsInternal = (markdown: string) => {
  const items: MarkdownHeading[] = [];
  const stack: { indent: number; depth: number }[] = [];

  forEachMarkdownContentLine(markdown, (line, lineNumber) => {
    const match = line.match(/^(\s*)([-*+])[ \t]+(.+)$/);
    if (!match) {
      return;
    }

    const indent = match[1]!.replace(/\t/g, "  ").length;
    const text = match[3]!.trim();
    if (!text) {
      return;
    }

    while (stack.length && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }

    const depth = (stack[stack.length - 1]?.depth || 0) + 1;
    items.push({ depth, text, line: lineNumber });
    stack.push({ indent, depth });
  });

  return items;
};

export const parseMarkdownHeadings = (
  markdown: string,
  noHeadingsMessage = "No markdown headings found.",
) => {
  const headings = parseMarkdownHeadingsInternal(markdown);

  if (!headings.length) {
    throw new Error(noHeadingsMessage);
  }

  return headings;
};

export const parseMarkdownBulletItems = (
  markdown: string,
  noItemsMessage = "No markdown list items found.",
) => {
  const items = parseMarkdownBulletItemsInternal(markdown);

  if (!items.length) {
    throw new Error(noItemsMessage);
  }

  return items;
};

const parseMarkdownOutlineItems = ({
  markdown,
  maxDepth,
  noOutlineMessage,
}: {
  markdown: string;
  maxDepth: number;
  noOutlineMessage: string;
}) => {
  const clampedMaxDepth = clampMarkdownMindMapMaxDepth(maxDepth);
  const headings = parseMarkdownHeadingsInternal(markdown);

  if (headings.length) {
    const filteredHeadings = headings.filter(
      (heading) => heading.depth <= clampedMaxDepth,
    );
    if (!filteredHeadings.length) {
      throw new Error(noOutlineMessage);
    }
    return filteredHeadings;
  }

  const items = parseMarkdownBulletItemsInternal(markdown).filter(
    (item) => item.depth <= clampedMaxDepth,
  );
  if (!items.length) {
    throw new Error(noOutlineMessage);
  }

  return items;
};

export const buildMarkdownHeadingTree = ({
  headings,
  fallbackRootLabel,
}: {
  headings: readonly MarkdownHeading[];
  fallbackRootLabel: string;
}): MarkdownHeadingTree => {
  const minDepth = Math.min(...headings.map((heading) => heading.depth));
  const topLevelCount = headings.filter(
    (heading) => heading.depth === minDepth,
  ).length;
  const canUseFirstHeadingAsRoot =
    topLevelCount === 1 && headings[0]?.depth === minDepth;

  const rootLabel = canUseFirstHeadingAsRoot
    ? headings[0]!.text
    : fallbackRootLabel;
  const rootDepth = canUseFirstHeadingAsRoot
    ? headings[0]!.depth
    : minDepth - 1;
  const queue = canUseFirstHeadingAsRoot ? headings.slice(1) : headings;
  const children: MarkdownHeadingNode[] = [];
  const stack: { depth: number; children: MarkdownHeadingNode[] }[] = [
    { depth: rootDepth, children },
  ];

  queue.forEach((heading) => {
    while (
      stack.length > 1 &&
      stack[stack.length - 1]!.depth >= heading.depth
    ) {
      stack.pop();
    }

    const node: MarkdownHeadingNode = {
      depth: heading.depth,
      text: heading.text,
      children: [],
    };

    stack[stack.length - 1]!.children.push(node);
    stack.push({ depth: heading.depth, children: node.children });
  });

  return {
    rootLabel,
    usesSyntheticRoot: !canUseFirstHeadingAsRoot,
    children,
  };
};

const createRootSkeleton = ({
  template,
  label,
  fontFamily,
}: {
  template: MindMapStencilKind;
  label: string;
  fontFamily: FontFamilyValues;
}) => {
  const id = createMindMapId("node");

  return {
    id,
    element: {
      type: "rectangle",
      id,
      x: 0,
      y: 0,
      width: MIND_MAP_ROOT_WIDTH,
      height: MIND_MAP_ROOT_HEIGHT,
      strokeColor: MIND_MAP_ROOT_FILL,
      backgroundColor: MIND_MAP_ROOT_FILL,
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
        fontFamily,
        fontSize: MIND_MAP_FONT_SIZE,
        strokeColor: MIND_MAP_ROOT_TEXT,
        textAlign: "center",
        verticalAlign: "middle",
      },
    } as ExcalidrawElementSkeleton,
  };
};

const createNodeSkeleton = ({
  template,
  text,
  parentId,
  order,
  level,
  x,
  y,
  fontFamily,
  side,
}: {
  template: MindMapStencilKind;
  text: string;
  parentId: string;
  order: number;
  level: number;
  x: number;
  y: number;
  fontFamily: FontFamilyValues;
  side: MindMapSide;
}) => {
  const id = createMindMapId("node");

  return {
    id,
    element: {
      type: "text",
      id,
      x,
      y,
      text,
      fontFamily,
      fontSize: MIND_MAP_FONT_SIZE,
      lineHeight: getLineHeight(fontFamily),
      strokeColor: MIND_MAP_TOPIC_TEXT,
      customData: createMindMapMeta("node", template, {
        nodeId: id,
        parentId,
        side,
        order,
        level,
      }),
    } as ExcalidrawElementSkeleton,
  };
};

const buildSkeletonsFromTree = ({
  rootId,
  nodes,
  template,
  fontFamily,
}: {
  rootId: string;
  nodes: readonly MarkdownHeadingNode[];
  template: MindMapStencilKind;
  fontFamily: FontFamilyValues;
}) => {
  const skeletons: ExcalidrawElementSkeleton[] = [];
  let currentRow = 0;

  const visit = (
    currentNodes: readonly MarkdownHeadingNode[],
    parentId: string,
    level: number,
    parentSide: MindMapSide,
  ) => {
    currentNodes.forEach((node, index) => {
      const side =
        template === "tree-balanced" && level === 1
          ? index % 2 === 0
            ? "left"
            : "right"
          : parentSide;
      const baseX = level * 180;
      const skeleton = createNodeSkeleton({
        template,
        text: node.text,
        parentId,
        order: index,
        level,
        x: side === "left" ? -baseX : baseX,
        y: currentRow * 56,
        fontFamily,
        side,
      });
      currentRow += 1;
      skeletons.push(skeleton.element);
      visit(node.children, skeleton.id, level + 1, side);
    });
  };

  visit(nodes, rootId, 1, getMindMapDefaultSide(template));
  return skeletons;
};

export const convertMarkdownToMindMapElements = ({
  markdown,
  fallbackRootLabel = "Markdown",
  noHeadingsMessage,
  template = DEFAULT_MARKDOWN_MIND_MAP_TEMPLATE,
  maxDepth = DEFAULT_MARKDOWN_MIND_MAP_MAX_DEPTH,
  fontFamily = DEFAULT_MARKDOWN_MIND_MAP_FONT_FAMILY,
}: {
  markdown: string;
  fallbackRootLabel?: string;
  noHeadingsMessage?: string;
  template?: MarkdownMindMapTemplate;
  maxDepth?: number;
  fontFamily?: FontFamilyValues;
}) => {
  const headings = parseMarkdownOutlineItems({
    markdown,
    maxDepth,
    noOutlineMessage: noHeadingsMessage || "No markdown headings found.",
  });
  const tree = buildMarkdownHeadingTree({ headings, fallbackRootLabel });
  const root = createRootSkeleton({
    template,
    label: tree.rootLabel,
    fontFamily,
  });
  const skeletons = [
    root.element,
    ...buildSkeletonsFromTree({
      rootId: root.id,
      nodes: tree.children,
      template,
      fontFamily,
    }),
  ];

  const converted = convertToExcalidrawElements(skeletons, {
    regenerateIds: false,
  }) as OrderedExcalidrawElement[];

  return synchronizeMindMapElements(converted).elements;
};
