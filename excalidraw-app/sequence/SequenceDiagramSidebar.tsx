import { useRef } from "react";
import {
  DefaultSidebar,
  Sidebar,
  convertToExcalidrawElements,
} from "../../packages/excalidraw";
import {
  LIBRARY_SIDEBAR_TAB,
  MIME_TYPES,
} from "../../packages/excalidraw/constants";
import {
  useApp,
  useExcalidrawAppState,
} from "../../packages/excalidraw/components/App";
import { serializeLibraryAsJSON } from "../../packages/excalidraw/data/json";
import { LibraryIcon } from "../../packages/excalidraw/components/icons";
import { t } from "../../packages/excalidraw/i18n";
import { randomId } from "../../packages/excalidraw/random";
import type { LibraryItems } from "../../packages/excalidraw/types";
import {
  SEQUENCE_DIAGRAM_SIDEBAR_TAB,
  type SequenceStencilDefaults,
  createSequenceStencil,
  sequenceStencilSections,
} from "./sequenceStencils";

import "./SequenceDiagramSidebar.scss";

type SequenceStencilKind = Parameters<typeof createSequenceStencil>[0];

const SequenceDiagramIcon = ({ className }: { className?: string }) => {
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
      <rect x="2.5" y="3" width="5" height="3.5" rx="1" />
      <rect x="9.5" y="3" width="5" height="3.5" rx="1" />
      <rect x="16.5" y="3" width="5" height="3.5" rx="1" />
      <path d="M5 8.5v12" strokeDasharray="2.2 2.2" />
      <path d="M12 8.5v12" strokeDasharray="2.2 2.2" />
      <path d="M19 8.5v12" strokeDasharray="2.2 2.2" />
      <path d="M6.5 11.5h9" />
      <path d="M13.5 9.5l2 2-2 2" />
      <path d="M17.5 16.5h-8" strokeDasharray="2.2 2.2" />
      <path d="M11.5 14.5l-2 2 2 2" />
    </svg>
  );
};

const SequenceStencilPreview = ({ kind }: { kind: SequenceStencilKind }) => {
  const stroke = "currentColor";
  const fill = "var(--default-bg-color)";
  const muted = "currentColor";

  switch (kind) {
    case "blank":
      return (
        <svg viewBox="0 0 120 70" fill="none" stroke={stroke} strokeWidth="2">
          <circle cx="18" cy="12" r="6" />
          <path d="M18 18v14M10 26h16M18 32l-7 8M18 32l7 8" />
          <path d="M18 44v20" strokeDasharray="4 4" />
          <rect x="46" y="6" width="28" height="12" rx="3" fill={fill} />
          <path d="M60 18v46" strokeDasharray="4 4" />
          <ellipse cx="100" cy="12" rx="11" ry="6" fill={fill} />
          <path d="M89 12v12M111 12v12M89 24c0 3 22 3 22 0" />
          <path d="M100 30v34" strokeDasharray="4 4" />
        </svg>
      );
    case "actor":
      return (
        <svg viewBox="0 0 80 70" fill="none" stroke={stroke} strokeWidth="2">
          <circle cx="40" cy="12" r="8" />
          <path d="M40 20v18M28 32h24M40 38l-12 14M40 38l12 14" />
          <path d="M40 52v14" strokeDasharray="4 4" />
        </svg>
      );
    case "participant":
      return (
        <svg viewBox="0 0 90 70" fill="none" stroke={stroke} strokeWidth="2">
          <rect x="14" y="8" width="62" height="18" fill={fill} />
          <path d="M45 26v40" strokeDasharray="4 4" />
        </svg>
      );
    case "service":
      return (
        <svg viewBox="0 0 90 70" fill="none" stroke={stroke} strokeWidth="2">
          <rect x="12" y="8" width="66" height="18" rx="5" fill={fill} />
          <path d="M45 26v40" strokeDasharray="4 4" />
        </svg>
      );
    case "database":
      return (
        <svg viewBox="0 0 90 70" fill="none" stroke={stroke} strokeWidth="2">
          <ellipse cx="45" cy="13" rx="20" ry="7" fill={fill} />
          <path d="M25 13v18M65 13v18" />
          <path d="M25 31c0 4 40 4 40 0" />
          <path d="M45 31v35" strokeDasharray="4 4" />
        </svg>
      );
    case "message":
      return (
        <svg viewBox="0 0 90 40" fill="none" stroke={stroke} strokeWidth="2">
          <path d="M10 20h60" />
          <path d="M62 14l8 6-8 6" />
        </svg>
      );
    case "return":
      return (
        <svg viewBox="0 0 90 40" fill="none" stroke={stroke} strokeWidth="2">
          <path d="M78 20H18" strokeDasharray="4 4" />
          <path d="M26 14l-8 6 8 6" />
        </svg>
      );
    case "self":
      return (
        <svg viewBox="0 0 90 54" fill="none" stroke={stroke} strokeWidth="2">
          <path d="M20 12h34v18H20" />
          <path d="M28 24l-8 6 8 6" />
        </svg>
      );
    case "activation":
      return (
        <svg viewBox="0 0 40 70" fill="none" stroke={stroke} strokeWidth="2">
          <path d="M20 2v66" strokeDasharray="4 4" />
          <rect x="14" y="14" width="12" height="38" rx="3" fill={fill} />
        </svg>
      );
    case "note":
      return (
        <svg viewBox="0 0 90 60" fill="none" stroke={stroke} strokeWidth="2">
          <rect
            x="12"
            y="10"
            width="66"
            height="40"
            rx="4"
            fill="var(--color-warning)"
            opacity="0.18"
          />
          <path d="M24 24h30M24 32h24" stroke={muted} />
        </svg>
      );
    case "loop":
      return (
        <svg viewBox="0 0 100 60" fill="none" stroke={stroke} strokeWidth="2">
          <rect x="10" y="8" width="80" height="44" strokeDasharray="5 4" />
          <rect x="10" y="8" width="24" height="12" fill={fill} />
        </svg>
      );
    case "alt":
      return (
        <svg viewBox="0 0 100 60" fill="none" stroke={stroke} strokeWidth="2">
          <rect x="10" y="8" width="80" height="44" strokeDasharray="5 4" />
          <rect x="10" y="8" width="20" height="12" fill={fill} />
          <path d="M10 30h80" strokeDasharray="5 4" />
        </svg>
      );
    default:
      return null;
  }
};

const SequenceStencilCard = ({
  kind,
  onInsert,
  onDragStart,
}: {
  kind: SequenceStencilKind;
  onInsert: (kind: SequenceStencilKind) => void;
  onDragStart: (kind: SequenceStencilKind, event: React.DragEvent) => void;
}) => {
  const previewRef = useRef<HTMLDivElement | null>(null);

  return (
    <button
      type="button"
      className="sequence-diagram-sidebar__card excalidraw-button"
      draggable
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
      <div className="sequence-diagram-sidebar__preview" ref={previewRef}>
        <SequenceStencilPreview kind={kind} />
      </div>
      <div className="sequence-diagram-sidebar__meta">
        <div className="sequence-diagram-sidebar__label">
          {t(`sequenceDiagram.items.${kind}.label`)}
        </div>
        <div className="sequence-diagram-sidebar__description">
          {t(`sequenceDiagram.items.${kind}.description`)}
        </div>
      </div>
    </button>
  );
};

export const SequenceDiagramSidebar = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();

  const isSequenceSidebarOpen =
    appState.openSidebar?.name === "default" &&
    appState.openSidebar?.tab === SEQUENCE_DIAGRAM_SIDEBAR_TAB;

  const defaults: SequenceStencilDefaults = {
    actor: t("sequenceDiagram.defaults.actor"),
    participant: t("sequenceDiagram.defaults.participant"),
    service: t("sequenceDiagram.defaults.service"),
    database: t("sequenceDiagram.defaults.database"),
    request: t("sequenceDiagram.defaults.request"),
    response: t("sequenceDiagram.defaults.response"),
    self: t("sequenceDiagram.defaults.self"),
    note: t("sequenceDiagram.defaults.note"),
    loop: t("sequenceDiagram.defaults.loop"),
    alt: t("sequenceDiagram.defaults.alt"),
  };

  const insertStencil = (kind: SequenceStencilKind) => {
    const elements = convertToExcalidrawElements(
      createSequenceStencil(kind, appState.theme, defaults),
      { regenerateIds: false },
    );
    app.onInsertElements(elements);
  };

  const createDragPayload = (kind: SequenceStencilKind): LibraryItems => {
    const elements = convertToExcalidrawElements(
      createSequenceStencil(kind, appState.theme, defaults),
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

  const onDragStart = (kind: SequenceStencilKind, event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(
      MIME_TYPES.excalidrawlib,
      serializeLibraryAsJSON(createDragPayload(kind)),
    );
  };

  return (
    <>
      <DefaultSidebar docked={isSequenceSidebarOpen ? true : undefined}>
        <Sidebar.Tab tab={SEQUENCE_DIAGRAM_SIDEBAR_TAB}>
          <div className="sequence-diagram-sidebar">
            <div className="sequence-diagram-sidebar__intro">
              <div className="sequence-diagram-sidebar__intro-icon">
                <SequenceDiagramIcon />
              </div>
              <div>
                <div className="sequence-diagram-sidebar__title">
                  {t("sequenceDiagram.title")}
                </div>
                <div className="sequence-diagram-sidebar__hint">
                  {t("sequenceDiagram.description")}
                </div>
              </div>
            </div>

            {sequenceStencilSections.map((section) => (
              <section
                key={section.key}
                className="sequence-diagram-sidebar__section"
              >
                <h3 className="sequence-diagram-sidebar__section-title">
                  {t(`sequenceDiagram.sections.${section.key}`)}
                </h3>
                <div className="sequence-diagram-sidebar__grid">
                  {section.items.map((kind) => (
                    <SequenceStencilCard
                      key={kind}
                      kind={kind}
                      onInsert={insertStencil}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              </section>
            ))}

            <p className="sequence-diagram-sidebar__footer">
              {t("sequenceDiagram.footer")}
            </p>
          </div>
        </Sidebar.Tab>
      </DefaultSidebar>

      <DefaultSidebar.TabTriggers>
        <Sidebar.TabTrigger
          tab={LIBRARY_SIDEBAR_TAB}
          title={t("toolBar.library")}
          aria-label={t("toolBar.library")}
        >
          {LibraryIcon}
        </Sidebar.TabTrigger>
        <Sidebar.TabTrigger
          tab={SEQUENCE_DIAGRAM_SIDEBAR_TAB}
          title={t("sequenceDiagram.tab")}
          aria-label={t("sequenceDiagram.tab")}
        >
          <SequenceDiagramIcon className="sequence-diagram-sidebar__tab-icon" />
        </Sidebar.TabTrigger>
      </DefaultSidebar.TabTriggers>
    </>
  );
};

export const SequenceDiagramMenuIcon = (
  <SequenceDiagramIcon className="sequence-diagram-sidebar__menu-icon" />
);
