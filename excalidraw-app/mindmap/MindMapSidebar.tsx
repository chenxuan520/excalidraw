import { useRef } from "react";
import {
  Sidebar,
  convertToExcalidrawElements,
} from "../../packages/excalidraw";
import { getCommonBounds } from "../../packages/excalidraw/element/bounds";
import { MIME_TYPES } from "../../packages/excalidraw/constants";
import {
  useApp,
  useExcalidrawAppState,
} from "../../packages/excalidraw/components/App";
import { serializeLibraryAsJSON } from "../../packages/excalidraw/data/json";
import { useI18n } from "../../packages/excalidraw/i18n";
import { randomId } from "../../packages/excalidraw/random";
import type { LibraryItems } from "../../packages/excalidraw/types";
import type { ExcalidrawElement } from "../../packages/excalidraw/element/types";
import {
  MIND_MAP_SIDEBAR_TAB,
  createMindMapStencil,
  getMindMapStencilDefaults,
  isMindMapConnectorElement,
  isMindMapNodeElement,
  isMindMapRootElement,
  mindMapStencilSections,
} from "./mindMapStencils";

import "./MindMapSidebar.scss";

type MindMapStencilKind = Parameters<typeof createMindMapStencil>[0];

export const getMindMapInsertAnchor = (
  elements: readonly ExcalidrawElement[],
) => {
  const root = elements.find(isMindMapRootElement);
  if (!root) {
    return undefined;
  }

  return {
    x: root.x + root.width / 2,
    y: root.y + root.height / 2,
  };
};

export const getMindMapDragAnchor = (elements: readonly ExcalidrawElement[]) => {
  const root = elements.find(isMindMapRootElement);
  if (!root) {
    return undefined;
  }

  const [minX, minY] = getCommonBounds(elements);
  return {
    x: root.x + root.width / 2 - minX,
    y: root.y + root.height / 2 - minY,
  };
};

export const getMindMapPasteAnchor = (
  elements: readonly ExcalidrawElement[],
) => {
  const mindMapElements = elements.filter(
    (element) =>
      isMindMapRootElement(element) ||
      isMindMapNodeElement(element) ||
      isMindMapConnectorElement(element),
  );

  if (!mindMapElements.length) {
    return undefined;
  }

  const mindMapElementIds = new Set(mindMapElements.map((element) => element.id));
  const isMindMapClipboardElement = (element: ExcalidrawElement) => {
    if (
      isMindMapRootElement(element) ||
      isMindMapNodeElement(element) ||
      isMindMapConnectorElement(element)
    ) {
      return true;
    }
    const textLike = element as ExcalidrawElement & {
      type?: string;
      containerId?: string | null;
    };
    return (
      textLike.type === "text" &&
      !!textLike.containerId &&
      mindMapElementIds.has(textLike.containerId)
    );
  };

  if (!elements.every(isMindMapClipboardElement)) {
    return undefined;
  }

  return getMindMapInsertAnchor(elements);
};

const MindMapSidebarIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2.5" y="9" width="6" height="6" rx="2.5" />
      <path d="M8.5 12h4" />
      <path d="M12.5 12v-6.5M12.5 12v6.5" />
      <path d="M12.5 5.5H18" />
      <path d="M12.5 18.5H18" />
      <rect x="18" y="3.5" width="4" height="4" rx="1.8" />
      <rect x="18" y="10" width="4" height="4" rx="1.8" />
      <rect x="18" y="16.5" width="4" height="4" rx="1.8" />
    </svg>
  );
};

const PreviewNode = ({
  x,
  y,
  width,
  fill,
}: {
  x: number;
  y: number;
  width: number;
  fill: string;
}) => {
  return <rect x={x} y={y} width={width} height="10" rx="5" fill={fill} />;
};

const PreviewConnector = ({ d }: { d: string }) => {
  return (
    <path
      d={d}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
};

const MindMapStencilPreview = ({ kind }: { kind: MindMapStencilKind }) => {
  const primary = "#6b7280";
  const secondary = "#e5e7eb";

  switch (kind) {
    case "mindmap-right":
      return (
        <svg viewBox="0 0 140 84" fill="none" color="#4b5563">
          <PreviewNode x={10} y={36} width={30} fill={primary} />
          <PreviewNode x={82} y={12} width={24} fill={secondary} />
          <PreviewNode x={82} y={37} width={28} fill={secondary} />
          <PreviewNode x={82} y={62} width={22} fill={secondary} />
          <PreviewConnector d="M40 41H62M62 41V17H82" />
          <PreviewConnector d="M40 41H76" />
          <PreviewConnector d="M40 41H62V67H82" />
        </svg>
      );
    case "mindmap-left":
      return (
        <svg viewBox="0 0 140 84" fill="none" color="#4b5563">
          <PreviewNode x={100} y={36} width={30} fill={primary} />
          <PreviewNode x={34} y={12} width={24} fill={secondary} />
          <PreviewNode x={30} y={37} width={28} fill={secondary} />
          <PreviewNode x={36} y={62} width={22} fill={secondary} />
          <PreviewConnector d="M100 41H78M78 41V17H58" />
          <PreviewConnector d="M100 41H64" />
          <PreviewConnector d="M100 41H78V67H58" />
        </svg>
      );
    case "tree-right":
      return (
        <svg viewBox="0 0 140 84" fill="none" color="#4b5563">
          <PreviewNode x={18} y={8} width={28} fill={primary} />
          <PreviewNode x={88} y={24} width={26} fill={secondary} />
          <PreviewNode x={88} y={42} width={22} fill={secondary} />
          <PreviewNode x={88} y={60} width={24} fill={secondary} />
          <PreviewConnector d="M32 18V68" />
          <PreviewConnector d="M32 29H88" />
          <PreviewConnector d="M32 47H88" />
          <PreviewConnector d="M32 65H88" />
        </svg>
      );
    case "tree-left":
      return (
        <svg viewBox="0 0 140 84" fill="none" color="#4b5563">
          <PreviewNode x={94} y={8} width={28} fill={primary} />
          <PreviewNode x={26} y={24} width={26} fill={secondary} />
          <PreviewNode x={30} y={42} width={22} fill={secondary} />
          <PreviewNode x={28} y={60} width={24} fill={secondary} />
          <PreviewConnector d="M108 18V68" />
          <PreviewConnector d="M108 29H52" />
          <PreviewConnector d="M108 47H52" />
          <PreviewConnector d="M108 65H52" />
        </svg>
      );
    case "tree-balanced":
      return (
        <svg viewBox="0 0 140 84" fill="none" color="#4b5563">
          <PreviewNode x={56} y={8} width={28} fill={primary} />
          <PreviewNode x={22} y={28} width={22} fill={secondary} />
          <PreviewNode x={96} y={28} width={22} fill={secondary} />
          <PreviewNode x={92} y={56} width={24} fill={secondary} />
          <PreviewConnector d="M70 18V66" />
          <PreviewConnector d="M70 33H44" />
          <PreviewConnector d="M70 33H96" />
          <PreviewConnector d="M70 61H92" />
        </svg>
      );
    case "timeline-horizontal":
      return (
        <svg viewBox="0 0 140 84" fill="none" color="#4b5563">
          <PreviewNode x={10} y={37} width={34} fill={primary} />
          <PreviewNode x={62} y={37} width={18} fill={secondary} />
          <PreviewNode x={98} y={16} width={18} fill={secondary} />
          <PreviewNode x={112} y={37} width={18} fill={secondary} />
          <PreviewNode x={122} y={58} width={16} fill={secondary} />
          <PreviewConnector d="M44 42H130" />
          <PreviewConnector d="M89 42V26H98" />
          <PreviewConnector d="M120 42V63H122" />
        </svg>
      );
    case "timeline-vertical":
      return (
        <svg viewBox="0 0 140 84" fill="none" color="#4b5563">
          <PreviewNode x={56} y={8} width={28} fill={primary} />
          <PreviewNode x={56} y={32} width={18} fill={secondary} />
          <PreviewNode x={92} y={32} width={18} fill={secondary} />
          <PreviewNode x={56} y={58} width={18} fill={secondary} />
          <PreviewNode x={24} y={58} width={16} fill={secondary} />
          <PreviewConnector d="M70 18V68" />
          <PreviewConnector d="M74 37H92" />
          <PreviewConnector d="M56 63H40" />
        </svg>
      );
    default:
      return null;
  }
};

const MindMapStencilCard = ({
  kind,
  onInsert,
  onDragStart,
}: {
  kind: MindMapStencilKind;
  onInsert: (kind: MindMapStencilKind) => void;
  onDragStart: (kind: MindMapStencilKind, event: React.DragEvent) => void;
}) => {
  const { t } = useI18n();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const label = t(`mindMap.items.${kind}.label`);
  const description = t(`mindMap.items.${kind}.description`);

  return (
    <button
      type="button"
      className="mind-map-sidebar__card excalidraw-button"
      draggable
      title={description}
      aria-label={`${label}: ${description}`}
      onClick={() => onInsert(kind)}
      onDragStart={(event) => {
        const dragImage = previewRef.current?.querySelector("svg");
        if (dragImage) {
          const { width, height } = dragImage.getBoundingClientRect();
          event.dataTransfer.setDragImage(dragImage, width / 2, height / 2);
        }
        onDragStart(kind, event);
      }}
    >
      <div className="mind-map-sidebar__preview" ref={previewRef}>
        <MindMapStencilPreview kind={kind} />
      </div>
      <div className="mind-map-sidebar__label">{label}</div>
    </button>
  );
};

export const MindMapSidebarTab = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const { t } = useI18n();

  const defaults = getMindMapStencilDefaults(t);

  const getInsertPosition = () => {
    return app.lastViewportPosition.x || app.lastViewportPosition.y
      ? "cursor"
      : "center";
  };

  const insertStencil = (kind: MindMapStencilKind) => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil(kind, appState.theme, defaults),
      { regenerateIds: false },
    );
    app.addElementsFromPasteOrLibrary({
      elements,
      files: null,
      position: getInsertPosition(),
      anchor: getMindMapInsertAnchor(elements),
    });
  };

  const createDragPayload = (kind: MindMapStencilKind): LibraryItems => {
    const elements = convertToExcalidrawElements(
      createMindMapStencil(kind, appState.theme, defaults),
      { regenerateIds: false },
    );
    return [
      {
        id: randomId(),
        created: Date.now(),
        status: "unpublished",
        elements,
      },
    ];
  };

  const onDragStart = (kind: MindMapStencilKind, event: React.DragEvent) => {
    const payload = createDragPayload(kind);
    const anchor = getMindMapDragAnchor(payload[0]?.elements || []);
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      MIME_TYPES.excalidrawlib,
      serializeLibraryAsJSON(payload),
    );
    if (anchor) {
      event.dataTransfer.setData(
        MIME_TYPES.excalidrawlibDragAnchor,
        JSON.stringify(anchor),
      );
    }
  };

  return (
    <Sidebar.Tab tab={MIND_MAP_SIDEBAR_TAB}>
      <div className="mind-map-sidebar">
        <div className="mind-map-sidebar__intro">
          <div className="mind-map-sidebar__intro-icon">
            <MindMapSidebarIcon />
          </div>
          <div>
            <div className="mind-map-sidebar__title">{t("mindMap.title")}</div>
            <div className="mind-map-sidebar__hint">
              {t("mindMap.description")}
            </div>
          </div>
        </div>

        {mindMapStencilSections.map((section) => (
          <section key={section.key} className="mind-map-sidebar__section">
            <h3 className="mind-map-sidebar__section-title">
              {t(`mindMap.sections.${section.key}`)}
            </h3>
            <div className="mind-map-sidebar__grid">
              {section.items.map((kind) => (
                <MindMapStencilCard
                  key={kind}
                  kind={kind}
                  onInsert={insertStencil}
                  onDragStart={onDragStart}
                />
              ))}
            </div>
          </section>
        ))}

        <p className="mind-map-sidebar__footer">{t("mindMap.footer")}</p>
      </div>
    </Sidebar.Tab>
  );
};

export const MindMapSidebarTabTrigger = () => {
  const { t } = useI18n();
  return (
    <Sidebar.TabTrigger
      tab={MIND_MAP_SIDEBAR_TAB}
      title={t("mindMap.tab")}
      aria-label={t("mindMap.tab")}
    >
      <MindMapSidebarIcon className="mind-map-sidebar__tab-icon" />
    </Sidebar.TabTrigger>
  );
};

export const MindMapMenuIcon = (
  <MindMapSidebarIcon className="mind-map-sidebar__menu-icon" />
);
