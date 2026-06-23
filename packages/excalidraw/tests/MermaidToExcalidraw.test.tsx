import { act, cleanup, fireEvent, render, screen, waitFor } from "./test-utils";
import { Excalidraw } from "../index";
import { expect } from "vitest";
import { getTextEditor, updateTextEditor } from "./queries/dom";
import { mockMermaidToExcalidraw } from "./helpers/mocks";
import { EDITOR_LS_KEYS, FONT_FAMILY } from "../constants";
import { TTDDialogBase } from "../components/TTDDialog/TTDDialog";
import { API } from "./helpers/api";
import { applyMermaidFontFamily } from "../components/TTDDialog/common";
import { convertToExcalidrawElements } from "../data/transform";

mockMermaidToExcalidraw({
  mockRef: true,
  parseMermaidToExcalidraw: async (definition) => {
    const firstLine = definition.split("\n")[0];
    return new Promise((resolve, reject) => {
      if (firstLine === "flowchart TD") {
        resolve({
          elements: [
            {
              id: "Start",
              type: "rectangle",
              groupIds: [],
              x: 0,
              y: 0,
              width: 69.703125,
              height: 44,
              strokeWidth: 2,
              label: {
                groupIds: [],
                text: "Start",
                fontSize: 20,
              },
              link: null,
            },
            {
              id: "Stop",
              type: "rectangle",
              groupIds: [],
              x: 2.7109375,
              y: 94,
              width: 64.28125,
              height: 44,
              strokeWidth: 2,
              label: {
                groupIds: [],
                text: "Stop",
                fontSize: 20,
              },
              link: null,
            },
            {
              id: "Start_Stop",
              type: "arrow",
              groupIds: [],
              x: 34.852,
              y: 44,
              strokeWidth: 2,
              points: [
                [0, 0],
                [0, 50],
              ],
              roundness: {
                type: 2,
              },
              start: {
                id: "Start",
              },
              end: {
                id: "Stop",
              },
            },
          ],
        });
      } else {
        reject(new Error("ERROR"));
      }
    });
  },
});

describe("Test <MermaidToExcalidraw/>", () => {
  beforeEach(async () => {
    localStorage.clear();

    await render(
      <Excalidraw
        initialData={{
          appState: {
            openDialog: { name: "ttd", tab: "mermaid" },
          },
        }}
      />,
    );
  });

  it("should open mermaid popup when active tool is mermaid", async () => {
    const dialog = document.querySelector(".ttd-dialog")!;
    await waitFor(() => dialog.querySelector("canvas"));
    expect(dialog.outerHTML).toMatchSnapshot();
  });

  it("should show error in preview when mermaid library throws error", async () => {
    const dialog = document.querySelector(".ttd-dialog")!;

    expect(dialog).not.toBeNull();

    const selector = ".ttd-dialog-input";
    let editor = await getTextEditor(selector, true);

    expect(dialog.querySelector('[data-testid="mermaid-error"]')).toBeNull();

    expect(editor.textContent).toMatchInlineSnapshot(`
      "flowchart TD
       A[Christmas] -->|Get money| B(Go shopping)
       B --> C{Let me think}
       C -->|One| D[Laptop]
       C -->|Two| E[iPhone]
       C -->|Three| F[Car]"
    `);

    await act(async () => {
      updateTextEditor(editor, "flowchart TD1");
      await new Promise((cb) => setTimeout(cb, 0));
    });
    editor = await getTextEditor(selector, false);

    expect(editor.textContent).toBe("flowchart TD1");
    expect(
      dialog.querySelector('[data-testid="mermaid-error"]'),
    ).toMatchInlineSnapshot("null");
  });

  it("should apply selected font family to converted mermaid text elements", async () => {
    const text = API.createElement({ type: "text", text: "Label" });
    const rect = API.createElement({ type: "rectangle" });

    const updated = applyMermaidFontFamily(
      [text, rect] as any,
      FONT_FAMILY.Helvetica,
    ) as readonly { type: string; fontFamily?: number; lineHeight?: number }[];

    expect(updated[0]?.fontFamily).toBe(FONT_FAMILY.Helvetica);
    expect(updated[1]?.fontFamily).toBeUndefined();
  });

  it.each(["<br>", "<br/>", "<br />"])(
    "should normalize %s tags in converted mermaid text",
    (lineBreakTag) => {
      const text = API.createElement({
        type: "text",
        text: `foo\n${lineBreakTag}\nbar`,
        fontFamily: FONT_FAMILY.Excalifont,
      });

      const updated = applyMermaidFontFamily(
        [text] as any,
        FONT_FAMILY.Helvetica,
      ) as readonly { text?: string; fontFamily?: number }[];

      expect(updated[0]?.text).toBe("foo\nbar");
      expect(updated[0]?.fontFamily).toBe(FONT_FAMILY.Helvetica);
    },
  );

  it("should reflow bound labels after normalizing mermaid line breaks", () => {
    const converted = convertToExcalidrawElements(
      [
        {
          type: "rectangle",
          x: 0,
          y: 0,
          width: 320,
          height: 80,
          label: {
            text: "Interface<br/>接入口",
          },
        },
      ],
      { regenerateIds: false },
    ) as readonly {
      type: string;
      text?: string;
      originalText?: string;
      containerId?: string | null;
      height?: number;
    }[];

    const initialLabel = converted.find(
      (element) => element.type === "text" && element.containerId,
    )!;

    const updated = applyMermaidFontFamily(
      converted as any,
      FONT_FAMILY.Helvetica,
    ) as readonly {
      type: string;
      text?: string;
      originalText?: string;
      containerId?: string | null;
      height?: number;
    }[];

    const updatedLabel = updated.find(
      (element) => element.type === "text" && element.containerId,
    )!;

    expect(updatedLabel.text).toBe("Interface\n接入口");
    expect(updatedLabel.originalText).toBe("Interface\n接入口");
    expect(updatedLabel.height).toBeGreaterThan(initialLabel.height || 0);
  });

  it("should hide text to diagram tab when disabled", async () => {
    cleanup();

    await render(
      <Excalidraw>
        <TTDDialogBase
          tab="mermaid"
          disableTextToDiagram={true}
          onTextSubmit={async () => ({ generatedResponse: undefined })}
        />
      </Excalidraw>,
    );

    expect(screen.queryByText(/Text to diagram/i)).toBeNull();
    expect(screen.getByText(/^Mermaid$/i)).toBeTruthy();
  });

  it("should restore persisted font family selection", async () => {
    cleanup();
    localStorage.setItem(
      EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW_FONT_FAMILY,
      JSON.stringify(FONT_FAMILY.Helvetica),
    );

    await render(
      <Excalidraw
        initialData={{
          appState: {
            openDialog: { name: "ttd", tab: "mermaid" },
          },
        }}
      />,
    );

    expect(screen.getByLabelText("Font")).toHaveValue(
      String(FONT_FAMILY.Helvetica),
    );
  });

  it("should persist selected font family", async () => {
    const select = screen.getByLabelText("Font");

    fireEvent.change(select, {
      target: { value: String(FONT_FAMILY.Helvetica) },
    });

    await waitFor(() => {
      expect(localStorage.getItem(EDITOR_LS_KEYS.MERMAID_TO_EXCALIDRAW_FONT_FAMILY)).toBe(
        JSON.stringify(FONT_FAMILY.Helvetica),
      );
    });
  });
});
