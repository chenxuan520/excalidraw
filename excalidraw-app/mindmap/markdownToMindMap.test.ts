import { describe, expect, it } from "vitest";
import { FONT_FAMILY } from "../../packages/excalidraw/constants";
import { getLineHeight } from "../../packages/excalidraw/fonts";
import type { OrderedExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  buildMarkdownHeadingTree,
  clampMarkdownMindMapMaxDepth,
  convertMarkdownToMindMapElements,
  parseMarkdownBulletItems,
  parseMarkdownHeadings,
} from "./markdownToMindMap";
import {
  getMindMapElementMeta,
  isMindMapConnectorElement,
  isMindMapNodeElement,
  isMindMapRootElement,
} from "./mindMapStencils";

type MindMapTextNode = OrderedExcalidrawElement & {
  type: "text";
  text: string;
};

const isMindMapTextNode = (
  element: OrderedExcalidrawElement,
): element is MindMapTextNode => {
  return isMindMapNodeElement(element) && element.type === "text";
};

describe("markdownToMindMap", () => {
  it("parses ATX headings while ignoring front matter and fenced code blocks", () => {
    const headings = parseMarkdownHeadings(`---
title: Demo
---

# Root

\`\`\`
## not a heading
\`\`\`

## Child ##
### Leaf
`);

    expect(headings).toEqual([
      { depth: 1, text: "Root", line: 5 },
      { depth: 2, text: "Child", line: 11 },
      { depth: 3, text: "Leaf", line: 12 },
    ]);
  });

  it("uses a synthetic root when the document has multiple top-level headings", () => {
    const tree = buildMarkdownHeadingTree({
      headings: parseMarkdownHeadings(`# Alpha\n# Beta`),
      fallbackRootLabel: "Markdown",
    });

    expect(tree.usesSyntheticRoot).toBe(true);
    expect(tree.rootLabel).toBe("Markdown");
    expect(tree.children.map((node) => node.text)).toEqual(["Alpha", "Beta"]);
  });

  it("builds synchronized mind map elements from heading hierarchy", () => {
    const elements = convertMarkdownToMindMapElements({
      markdown: `# Root
## Product
### CLI bridge
## Deployment`,
      fallbackRootLabel: "Markdown",
    });

    const root = elements.find(isMindMapRootElement);
    const nodes = elements.filter(isMindMapNodeElement);
    const connectors = elements.filter(isMindMapConnectorElement);
    const product = nodes.find(
      (element) => element.type === "text" && element.text === "Product",
    );
    const cliBridge = nodes.find(
      (element) => element.type === "text" && element.text === "CLI bridge",
    );
    const deployment = nodes.find(
      (element) => element.type === "text" && element.text === "Deployment",
    );

    expect(root).toBeTruthy();
    expect(product).toBeTruthy();
    expect(cliBridge).toBeTruthy();
    expect(deployment).toBeTruthy();

    expect(getMindMapElementMeta(product!)?.parentId).toBe(root!.id);
    expect(getMindMapElementMeta(product!)?.order).toBe(0);
    expect(getMindMapElementMeta(deployment!)?.parentId).toBe(root!.id);
    expect(getMindMapElementMeta(deployment!)?.order).toBe(1);
    expect(getMindMapElementMeta(cliBridge!)?.parentId).toBe(product!.id);
    expect(getMindMapElementMeta(cliBridge!)?.level).toBe(2);
    expect(connectors.length).toBeGreaterThanOrEqual(4);
  });

  it("supports nested child headings through all markdown heading levels", () => {
    const elements = convertMarkdownToMindMapElements({
      markdown: `# L1
## L2
### L3
#### L4
##### L5
###### L6`,
      fallbackRootLabel: "Markdown",
    });

    const textNodes = elements.filter(isMindMapTextNode);

    const labels = textNodes.map((node) => node.text);
    expect(labels).toEqual(["L2", "L3", "L4", "L5", "L6"]);

    const l2 = textNodes.find((node) => node.text === "L2")!;
    const l3 = textNodes.find((node) => node.text === "L3")!;
    const l4 = textNodes.find((node) => node.text === "L4")!;
    const l5 = textNodes.find((node) => node.text === "L5")!;
    const l6 = textNodes.find((node) => node.text === "L6")!;

    expect(getMindMapElementMeta(l2)?.level).toBe(1);
    expect(getMindMapElementMeta(l3)?.parentId).toBe(l2.id);
    expect(getMindMapElementMeta(l3)?.level).toBe(2);
    expect(getMindMapElementMeta(l4)?.parentId).toBe(l3.id);
    expect(getMindMapElementMeta(l4)?.level).toBe(3);
    expect(getMindMapElementMeta(l5)?.parentId).toBe(l4.id);
    expect(getMindMapElementMeta(l5)?.level).toBe(4);
    expect(getMindMapElementMeta(l6)?.parentId).toBe(l5.id);
    expect(getMindMapElementMeta(l6)?.level).toBe(5);
  });

  it("parses nested markdown bullet items when headings are absent", () => {
    const items = parseMarkdownBulletItems(`- Root
  - Alpha
    - Beta
      - Gamma`);

    expect(items).toEqual([
      { depth: 1, text: "Root", line: 1 },
      { depth: 2, text: "Alpha", line: 2 },
      { depth: 3, text: "Beta", line: 3 },
      { depth: 4, text: "Gamma", line: 4 },
    ]);
  });

  it("falls back to nested markdown bullet items for mind map conversion", () => {
    const elements = convertMarkdownToMindMapElements({
      markdown: `- Root
  - Alpha
    - Beta
      - Gamma`,
      fallbackRootLabel: "Markdown",
    });

    const root = elements.find(isMindMapRootElement)! as OrderedExcalidrawElement & {
      label?: { text?: string };
    };
    const textNodes = elements.filter(isMindMapTextNode);
    const alpha = textNodes.find((node) => node.text === "Alpha")!;
    const beta = textNodes.find((node) => node.text === "Beta")!;
    const gamma = textNodes.find((node) => node.text === "Gamma")!;
    const rootText = elements.find(
      (element) =>
        element.type === "text" &&
        "containerId" in element &&
        element.containerId === root.id &&
        element.text === "Root",
    );

    expect(rootText).toBeTruthy();
    expect(getMindMapElementMeta(alpha)?.parentId).toBe(root.id);
    expect(getMindMapElementMeta(beta)?.parentId).toBe(alpha.id);
    expect(getMindMapElementMeta(gamma)?.parentId).toBe(beta.id);
  });

  it("respects the configured maximum depth", () => {
    const elements = convertMarkdownToMindMapElements({
      markdown: `# Root
## Alpha
### Beta
#### Gamma
##### Delta`,
      maxDepth: 3,
    });

    expect(elements.filter(isMindMapTextNode).map((node) => node.text)).toEqual([
      "Alpha",
      "Beta",
    ]);
    expect(clampMarkdownMindMapMaxDepth(99)).toBe(6);
    expect(clampMarkdownMindMapMaxDepth(0)).toBe(1);
  });

  it("applies the configured default template and font family", () => {
    const elements = convertMarkdownToMindMapElements({
      markdown: `# Root
## Alpha
### Beta`,
      template: "tree-left",
      fontFamily: FONT_FAMILY.Helvetica,
    });

    const root = elements.find(isMindMapRootElement)!;
    const alpha = elements.filter(isMindMapTextNode).find((node) => node.text === "Alpha")!;
    const beta = elements.filter(isMindMapTextNode).find((node) => node.text === "Beta")!;
    const rootText = elements.find(
      (element) =>
        element.type === "text" &&
        "containerId" in element &&
        element.containerId === root.id,
    ) as (OrderedExcalidrawElement & { type: "text"; text: string; fontFamily: number; lineHeight: number }) | undefined;

    expect(getMindMapElementMeta(root)?.template).toBe("tree-left");
    expect(getMindMapElementMeta(alpha)?.template).toBe("tree-left");
    expect(alpha.fontFamily).toBe(FONT_FAMILY.Helvetica);
    expect(alpha.lineHeight).toBe(getLineHeight(FONT_FAMILY.Helvetica));
    expect(beta.fontFamily).toBe(FONT_FAMILY.Helvetica);
    expect(rootText?.fontFamily).toBe(FONT_FAMILY.Helvetica);
    expect(getMindMapElementMeta(alpha)?.side).toBe("left");
  });

  it("prefers markdown headings over bullet items when both exist", () => {
    const elements = convertMarkdownToMindMapElements({
      markdown: `# Root
## Alpha

- Bullet root
  - Bullet child`,
    });

    expect(elements.filter(isMindMapTextNode).map((node) => node.text)).toEqual([
      "Alpha",
    ]);
  });

  it("throws when markdown does not contain headings", () => {
    expect(() =>
      convertMarkdownToMindMapElements({
        markdown: "plain paragraph only",
        noHeadingsMessage: "Need headings",
      }),
    ).toThrow("Need headings");
  });
});
