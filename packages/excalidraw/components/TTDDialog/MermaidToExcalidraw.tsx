import { useState, useRef, useEffect, useDeferredValue } from "react";
import type { BinaryFiles } from "../../types";
import { useApp } from "../App";
import type { NonDeletedExcalidrawElement } from "../../element/types";
import {
  ArrowRightIcon,
  collapseDownIcon,
} from "../icons";
import "./MermaidToExcalidraw.scss";
import { t } from "../../i18n";
import Trans from "../Trans";
import type { MermaidToExcalidrawLibProps } from "./common";
import {
  convertMermaidToExcalidraw,
  insertToEditor,
  saveMermaidDataToStorage,
} from "./common";
import { TTDDialogPanels } from "./TTDDialogPanels";
import { TTDDialogPanel } from "./TTDDialogPanel";
import { TTDDialogInput } from "./TTDDialogInput";
import { TTDDialogOutput } from "./TTDDialogOutput";
import { EditorLocalStorage } from "../../data/EditorLocalStorage";
import { EDITOR_LS_KEYS } from "../../constants";
import { FONT_FAMILY } from "../../constants";
import { debounce, isDevEnv } from "../../utils";
import { TTDDialogSubmitShortcut } from "./TTDDialogSubmitShortcut";
import type { FontFamilyValues } from "../../element/types";

const MERMAID_EXAMPLE =
  "flowchart TD\n A[Christmas] -->|Get money| B(Go shopping)\n B --> C{Let me think}\n C -->|One| D[Laptop]\n C -->|Two| E[iPhone]\n C -->|Three| F[Car]";

const debouncedSaveMermaidDefinition = debounce(saveMermaidDataToStorage, 300);

const MERMAID_FONT_OPTIONS = [
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

const getFontLabel = (fontFamily: number) => {
  return (
    Object.entries(FONT_FAMILY).find(([, value]) => value === fontFamily)?.[0] ||
    String(fontFamily)
  );
};

const MermaidToExcalidraw = ({
  mermaidToExcalidrawLib,
}: {
  mermaidToExcalidrawLib: MermaidToExcalidrawLibProps;
}) => {
  const [text, setText] = useState(
    () =>
      EditorLocalStorage.get<string>(EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW) ||
      MERMAID_EXAMPLE,
  );
  const deferredText = useDeferredValue(text.trim());
  const [fontFamily, setFontFamily] = useState<FontFamilyValues>(
    FONT_FAMILY.Excalifont,
  );
  const [error, setError] = useState<Error | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const data = useRef<{
    elements: readonly NonDeletedExcalidrawElement[];
    files: BinaryFiles | null;
  }>({ elements: [], files: null });

  const app = useApp();

  useEffect(() => {
    convertMermaidToExcalidraw({
      canvasRef,
      data,
      mermaidToExcalidrawLib,
      setError,
      mermaidDefinition: deferredText,
      fontFamily,
    }).catch((err) => {
      if (isDevEnv()) {
        console.error("Failed to parse mermaid definition", err);
      }
    });

    debouncedSaveMermaidDefinition(deferredText);
  }, [deferredText, fontFamily, mermaidToExcalidrawLib]);

  useEffect(
    () => () => {
      debouncedSaveMermaidDefinition.flush();
    },
    [],
  );

  const onInsertToEditor = () => {
    insertToEditor({
      app,
      data,
      text,
      shouldSaveMermaidDataToStorage: true,
    });
  };

  return (
    <>
      <div className="ttd-dialog-desc">
        <Trans
          i18nKey="mermaid.description"
          flowchartLink={(el) => (
            <a href="https://mermaid.js.org/syntax/flowchart.html">{el}</a>
          )}
          sequenceLink={(el) => (
            <a href="https://mermaid.js.org/syntax/sequenceDiagram.html">
              {el}
            </a>
          )}
          classLink={(el) => (
            <a href="https://mermaid.js.org/syntax/classDiagram.html">{el}</a>
          )}
        />
      </div>
      <div className="dialog-mermaid-controls">
        <label className="dialog-mermaid-controls__chip">
          <span className="dialog-mermaid-controls__label">{t("mermaid.font")}</span>
          <span className="dialog-mermaid-controls__select-wrap">
            <select
              aria-label={t("mermaid.font")}
              className="dialog-mermaid-controls__select"
              value={fontFamily}
              onChange={(event) => {
                setFontFamily(Number(event.target.value) as FontFamilyValues);
              }}
            >
              {MERMAID_FONT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {getFontLabel(option)}
                </option>
              ))}
            </select>
            <span className="dialog-mermaid-controls__select-icon">
              {collapseDownIcon}
            </span>
          </span>
        </label>
      </div>
      <TTDDialogPanels>
        <TTDDialogPanel label={t("mermaid.syntax")}>
          <TTDDialogInput
            input={text}
            placeholder={"Write Mermaid diagram defintion here..."}
            onChange={(event) => setText(event.target.value)}
            onKeyboardSubmit={() => {
              onInsertToEditor();
            }}
          />
        </TTDDialogPanel>
        <TTDDialogPanel
          label={t("mermaid.preview")}
          panelAction={{
            action: () => {
              onInsertToEditor();
            },
            label: t("mermaid.button"),
            icon: ArrowRightIcon,
          }}
          renderSubmitShortcut={() => <TTDDialogSubmitShortcut />}
        >
          <TTDDialogOutput
            canvasRef={canvasRef}
            loaded={mermaidToExcalidrawLib.loaded}
            error={error}
          />
        </TTDDialogPanel>
      </TTDDialogPanels>
    </>
  );
};
export default MermaidToExcalidraw;
