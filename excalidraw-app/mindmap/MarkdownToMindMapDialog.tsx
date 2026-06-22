import { useDeferredValue, useEffect, useRef, useState } from "react";
import {
  DEFAULT_EXPORT_PADDING,
  FONT_FAMILY,
} from "../../packages/excalidraw/constants";
import {
  useApp,
  useExcalidrawAppState,
  useExcalidrawSetAppState,
} from "../../packages/excalidraw/components/App";
import { Dialog } from "../../packages/excalidraw/components/Dialog";
import {
  ArrowRightIcon,
  MarkdownMindMapIcon,
  collapseDownIcon,
} from "../../packages/excalidraw/components/icons";
import { TTDDialogInput } from "../../packages/excalidraw/components/TTDDialog/TTDDialogInput";
import { TTDDialogOutput } from "../../packages/excalidraw/components/TTDDialog/TTDDialogOutput";
import { TTDDialogPanel } from "../../packages/excalidraw/components/TTDDialog/TTDDialogPanel";
import { TTDDialogPanels } from "../../packages/excalidraw/components/TTDDialog/TTDDialogPanels";
import { TTDDialogSubmitShortcut } from "../../packages/excalidraw/components/TTDDialog/TTDDialogSubmitShortcut";
import {
  exportToCanvas,
  getCommonBounds,
  newElementWith,
  StoreAction,
  viewportCoordsToSceneCoords,
} from "../../packages/excalidraw";
import { syncInvalidIndices } from "../../packages/excalidraw/fractionalIndex";
import { useI18n } from "../../packages/excalidraw/i18n";
import { getMindMapInsertAnchor } from "./MindMapSidebar";
import { isMindMapRootElement } from "./mindMapStencils";
import {
  clampMarkdownMindMapMaxDepth,
  DEFAULT_MARKDOWN_MIND_MAP_EXAMPLE,
  DEFAULT_MARKDOWN_MIND_MAP_FONT_FAMILY,
  DEFAULT_MARKDOWN_MIND_MAP_MAX_DEPTH,
  DEFAULT_MARKDOWN_MIND_MAP_TEMPLATE,
  convertMarkdownToMindMapElements,
  MARKDOWN_MIND_MAP_FONT_OPTIONS,
  MARKDOWN_MIND_MAP_TEMPLATES,
  type MarkdownMindMapTemplate,
} from "./markdownToMindMap";
import type { FontFamilyValues } from "../../packages/excalidraw/element/types";

import "./MarkdownToMindMapDialog.scss";

const getFontLabel = (fontFamily: number) => {
  return (
    Object.entries(FONT_FAMILY).find(([, value]) => value === fontFamily)?.[0] ||
    String(fontFamily)
  );
};

const resetPreview = (canvasRef: React.RefObject<HTMLDivElement>) => {
  const canvasNode = canvasRef.current;
  if (!canvasNode) {
    return;
  }
  canvasNode.parentElement?.style.removeProperty("background");
  canvasNode.replaceChildren();
};

export const MarkdownToMindMapDialog = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const setAppState = useExcalidrawSetAppState();
  const { t } = useI18n();
  const isOpen = appState.openDialog?.name === "markdownMindMap";

  const [text, setText] = useState(DEFAULT_MARKDOWN_MIND_MAP_EXAMPLE);
  const [template, setTemplate] = useState<MarkdownMindMapTemplate>(
    DEFAULT_MARKDOWN_MIND_MAP_TEMPLATE,
  );
  const [fontFamily, setFontFamily] = useState<FontFamilyValues>(
    DEFAULT_MARKDOWN_MIND_MAP_FONT_FAMILY,
  );
  const [maxDepth, setMaxDepth] = useState(DEFAULT_MARKDOWN_MIND_MAP_MAX_DEPTH);
  const deferredText = useDeferredValue(text);
  const [error, setError] = useState<Error | null>(null);
  const [previewElementCount, setPreviewElementCount] = useState(0);
  const [previewRetryNonce, setPreviewRetryNonce] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<{
    elements: ReturnType<typeof convertMarkdownToMindMapElements>;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const retryFrame = window.requestAnimationFrame(() => {
      setPreviewRetryNonce((value) => value + 1);
    });

    return () => {
      window.cancelAnimationFrame(retryFrame);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;

    const renderPreview = async () => {
      const nextText = deferredText.trim();
      if (!nextText) {
        dataRef.current = null;
        setPreviewElementCount(0);
        setError(null);
        resetPreview(canvasRef);
        return;
      }

      try {
        const elements = convertMarkdownToMindMapElements({
          markdown: deferredText,
          fallbackRootLabel: t("mindMap.markdown.defaultRoot"),
          noHeadingsMessage: t("mindMap.markdown.noHeadings"),
          template,
          fontFamily,
          maxDepth,
        });

        const parent = canvasRef.current?.parentElement;
        if (!parent) {
          if (!cancelled) {
            window.requestAnimationFrame(() => {
              if (!cancelled) {
                setPreviewRetryNonce((value) => value + 1);
              }
            });
          }
          return;
        }

        const canvas = await exportToCanvas({
          elements,
          files: {},
          appState,
          exportPadding: DEFAULT_EXPORT_PADDING,
          maxWidthOrHeight:
            Math.max(parent.offsetWidth, parent.offsetHeight) *
            window.devicePixelRatio,
        });

        if (cancelled || !canvasRef.current) {
          return;
        }

        dataRef.current = { elements };
        setPreviewElementCount(elements.length);
        setError(null);
        parent.style.background = "var(--default-bg-color)";
        canvasRef.current.replaceChildren(canvas);
      } catch (err: any) {
        if (cancelled) {
          return;
        }

        dataRef.current = null;
        setPreviewElementCount(0);
        setError(err instanceof Error ? err : new Error("Failed to render preview"));
        resetPreview(canvasRef);
      }
    };

    renderPreview();

    return () => {
      cancelled = true;
    };
  }, [deferredText, fontFamily, isOpen, maxDepth, previewRetryNonce, t, template]);

  if (!isOpen) {
    return null;
  }

  const closeDialog = () => {
    setAppState({ openDialog: null });
  };

  const insertToEditor = () => {
    const elements = dataRef.current?.elements;
    if (!elements?.length) {
      return;
    }

    const [minX, minY, maxX, maxY] = getCommonBounds(elements);
    const anchor = getMindMapInsertAnchor(elements) || {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    };
    const viewportPoint =
      app.lastViewportPosition.x || app.lastViewportPosition.y
        ? {
            clientX: app.lastViewportPosition.x,
            clientY: app.lastViewportPosition.y,
          }
        : {
            clientX: appState.width / 2 + appState.offsetLeft,
            clientY: appState.height / 2 + appState.offsetTop,
          };
    const scenePoint = viewportCoordsToSceneCoords(viewportPoint, appState);
    const translatedElements = elements.map((element) =>
      newElementWith(element, {
        x: element.x + scenePoint.x - anchor.x,
        y: element.y + scenePoint.y - anchor.y,
      }),
    );
    const selectedRoot = translatedElements.find(isMindMapRootElement);

    app.syncActionResult({
      elements: syncInvalidIndices([
        ...app.scene.getElementsIncludingDeleted(),
        ...translatedElements,
      ]),
      appState: {
        ...appState,
        openDialog: null,
        selectedElementIds: selectedRoot ? { [selectedRoot.id]: true } : {},
        selectedGroupIds: {},
        editingElement: null,
        editingLinearElement: null,
        multiElement: null,
        draggingElement: null,
        selectionElement: null,
        selectedLinearElement: null,
        suggestedBindings: [],
      },
      storeAction: StoreAction.CAPTURE,
    });
    app.setActiveTool({ type: "selection" });
    app.scrollToContent(translatedElements, { fitToContent: true });
  };

  return (
    <Dialog
      className="ttd-dialog"
      onCloseRequest={closeDialog}
      size={1200}
      title={false}
      autofocus={false}
    >
      <div className="ttd-dialog-tabs-root markdown-mind-map-dialog">
        <div className="ttd-dialog-triggers markdown-mind-map-dialog__triggers">
          <button
            type="button"
            className="ttd-dialog-tab-trigger markdown-mind-map-dialog__title"
            data-state="active"
          >
            <span className="markdown-mind-map-dialog__title-icon">
              {MarkdownMindMapIcon}
            </span>
            <span>{t("mindMap.markdown.title")}</span>
          </button>
        </div>

        <div className="ttd-dialog-content markdown-mind-map-dialog__content">
          <div className="ttd-dialog-desc">{t("mindMap.markdown.description")}</div>

          <div className="markdown-mind-map-dialog__controls">
            <label className="markdown-mind-map-dialog__control-chip">
              <span className="markdown-mind-map-dialog__control-label">
                {t("mindMap.markdown.style")}
              </span>
              <span className="markdown-mind-map-dialog__control-select-wrap">
                <select
                  aria-label={t("mindMap.markdown.style")}
                  className="markdown-mind-map-dialog__control-select"
                  value={template}
                  onChange={(event) => {
                    setTemplate(event.target.value as MarkdownMindMapTemplate);
                  }}
                >
                  {MARKDOWN_MIND_MAP_TEMPLATES.map((option) => (
                    <option key={option} value={option}>
                      {t(`mindMap.items.${option}.label`)}
                    </option>
                  ))}
                </select>
                <span className="markdown-mind-map-dialog__control-select-icon">
                  {collapseDownIcon}
                </span>
              </span>
            </label>

            <label className="markdown-mind-map-dialog__control-chip">
              <span className="markdown-mind-map-dialog__control-label">
                {t("mindMap.markdown.font")}
              </span>
              <span className="markdown-mind-map-dialog__control-select-wrap">
                <select
                  aria-label={t("mindMap.markdown.font")}
                  className="markdown-mind-map-dialog__control-select"
                  value={fontFamily}
                  onChange={(event) => {
                    setFontFamily(Number(event.target.value) as FontFamilyValues);
                  }}
                >
                  {MARKDOWN_MIND_MAP_FONT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {getFontLabel(option)}
                    </option>
                  ))}
                </select>
                <span className="markdown-mind-map-dialog__control-select-icon">
                  {collapseDownIcon}
                </span>
              </span>
            </label>

            <label className="markdown-mind-map-dialog__control-chip markdown-mind-map-dialog__control-chip--depth">
              <span className="markdown-mind-map-dialog__control-label">
                {t("mindMap.markdown.maxDepth")}
              </span>
              <input
                aria-label={t("mindMap.markdown.maxDepth")}
                className="markdown-mind-map-dialog__control-input"
                type="number"
                min={1}
                max={DEFAULT_MARKDOWN_MIND_MAP_MAX_DEPTH}
                value={maxDepth}
                onChange={(event) => {
                  setMaxDepth(
                    clampMarkdownMindMapMaxDepth(Number(event.target.value)),
                  );
                }}
              />
            </label>
          </div>

          <TTDDialogPanels>
            <TTDDialogPanel label={t("mindMap.markdown.syntax")}>
              <TTDDialogInput
                input={text}
                placeholder={t("mindMap.markdown.placeholder")}
                onChange={(event) => setText(event.target.value)}
                onKeyboardSubmit={insertToEditor}
              />
            </TTDDialogPanel>
            <TTDDialogPanel
              label={t("mindMap.markdown.preview")}
              panelAction={{
                action: insertToEditor,
                label: t("mindMap.markdown.button"),
                icon: ArrowRightIcon,
              }}
              panelActionDisabled={previewElementCount === 0 || !!error}
              renderSubmitShortcut={() => <TTDDialogSubmitShortcut />}
            >
              <TTDDialogOutput canvasRef={canvasRef} error={error} loaded={true} />
            </TTDDialogPanel>
          </TTDDialogPanels>
        </div>
      </div>
    </Dialog>
  );
};
