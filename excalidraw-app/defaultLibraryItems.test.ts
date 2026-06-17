import { FONT_FAMILY } from "../packages/excalidraw/constants";
import type { ExcalidrawTextElement } from "../packages/excalidraw/element/types";
import {
  getDefaultLibraryItems,
  replaceManagedDefaultLibraryItems,
} from "./defaultLibraryItems";

const getTextElement = (
  elements: ReturnType<typeof getDefaultLibraryItems>[number]["elements"],
) => {
  return elements.find(
    (element): element is ExcalidrawTextElement => element.type === "text",
  );
};

describe("defaultLibraryItems", () => {
  it("creates the requested built-in library shapes", () => {
    const items = getDefaultLibraryItems("zh-CN");

    expect(items.map((item) => item.name)).toEqual([
      "星形",
      "三角形",
      "左箭头",
      "右箭头",
      "双向箭头",
      "云朵",
      "数据库",
      "消息队列",
    ]);
  });

  it("uses localized english names and labels from i18n keys", () => {
    const items = getDefaultLibraryItems("en");

    expect(items.map((item) => item.name)).toEqual([
      "Star",
      "Triangle",
      "Left arrow",
      "Right arrow",
      "Bidirectional arrow",
      "Cloud",
      "Database",
      "Message Queue",
    ]);
    expect(
      items
        .find((item) => item.id === "default-library-database")
        ?.elements.find(
          (element): element is ExcalidrawTextElement => element.type === "text",
        )
        ?.text,
    ).toBe("Database");
    expect(
      items
        .find((item) => item.id === "default-library-message-queue")
        ?.elements.find(
          (element): element is ExcalidrawTextElement => element.type === "text",
        )
        ?.text,
    ).toBe("Queue");
  });

  it("uses stable ids and plain excalidraw elements", () => {
    const first = getDefaultLibraryItems("en");
    const second = getDefaultLibraryItems("en");

    expect(first.map((item) => item.id)).toEqual(second.map((item) => item.id));
    expect(
      first.map((item) => item.elements.map((element) => element.id)),
    ).toEqual(second.map((item) => item.elements.map((element) => element.id)));
    expect(
      first.flatMap((item) => item.elements).every((element) => !element.customData),
    ).toBe(true);
  });

  it("defaults database and message queue labels to Comic Shanns", () => {
    const items = getDefaultLibraryItems("zh-CN");
    const databaseLabel = getTextElement(
      items.find((item) => item.id === "default-library-database")!.elements,
    );
    const messageQueueLabel = getTextElement(
      items.find((item) => item.id === "default-library-message-queue")!.elements,
    );

    expect(databaseLabel?.fontFamily).toBe(FONT_FAMILY["Comic Shanns"]);
    expect(messageQueueLabel?.fontFamily).toBe(FONT_FAMILY["Comic Shanns"]);
  });

  it("keeps built-in library shapes unfilled by default", () => {
    const items = getDefaultLibraryItems("zh-CN");

    expect(
      items
        .flatMap((item) => item.elements)
        .filter((element) => "backgroundColor" in element)
        .every((element) => element.backgroundColor === "transparent"),
    ).toBe(true);
  });

  it("replaces old managed defaults and removes deleted ones", () => {
    const current = [
      {
        id: "default-library-speech-bubble",
        status: "published" as const,
        created: 1,
        elements: firstItemElements(),
        name: "Speech bubble",
      },
      {
        id: "default-library-left-brace",
        status: "published" as const,
        created: 2,
        elements: firstItemElements(),
        name: "Left brace",
      },
      {
        id: "default-library-horizontal-cylinder",
        status: "published" as const,
        created: 3,
        elements: firstItemElements(),
        name: "Horizontal cylinder",
      },
      {
        id: "default-library-stored-data",
        status: "published" as const,
        created: 4,
        elements: firstItemElements(),
        name: "Old stored data",
      },
      {
        id: "user-item",
        status: "unpublished" as const,
        created: 5,
        elements: firstItemElements(),
        name: "User item",
      },
    ];

    const next = replaceManagedDefaultLibraryItems(current, "zh-CN");

    expect(next.some((item) => item.id === "default-library-speech-bubble")).toBe(false);
    expect(next.some((item) => item.id === "default-library-left-brace")).toBe(false);
    expect(next.some((item) => item.id === "default-library-horizontal-cylinder")).toBe(false);
    expect(next.some((item) => item.id === "default-library-stored-data")).toBe(false);
    expect(next.find((item) => item.id === "user-item")?.name).toBe("User item");
    expect(next.find((item) => item.id === "default-library-cloud")?.name).toBe(
      "云朵",
    );
    expect(
      next.find((item) => item.id === "default-library-bidirectional-arrow")
        ?.name,
    ).toBe("双向箭头");
    expect(next.find((item) => item.id === "default-library-left-arrow")?.name).toBe(
      "左箭头",
    );
    expect(next.find((item) => item.id === "default-library-right-arrow")?.name).toBe(
      "右箭头",
    );
    expect(next.find((item) => item.id === "default-library-database")?.name).toBe(
      "数据库",
    );
    expect(next.find((item) => item.id === "default-library-message-queue")?.name).toBe(
      "消息队列",
    );
  });
});

const firstItemElements = () => getDefaultLibraryItems("en")[0]!.elements;
