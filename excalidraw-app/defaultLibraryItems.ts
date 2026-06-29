import {
  DEFAULT_ELEMENT_PROPS,
  FONT_FAMILY,
} from "../packages/excalidraw/constants";
import enLocale from "../packages/excalidraw/locales/en.json";
import zhCNLocale from "../packages/excalidraw/locales/zh-CN.json";
import {
  convertToExcalidrawElements,
  type ExcalidrawElementSkeleton,
} from "../packages/excalidraw/data/transform";
import { measureText } from "../packages/excalidraw/element/textElement";
import { getLineHeight } from "../packages/excalidraw/fonts";
import type { LibraryItem, LibraryItems } from "../packages/excalidraw/types";
import { getFontString } from "../packages/excalidraw/utils";

const DEFAULT_LIBRARY_STROKE = DEFAULT_ELEMENT_PROPS.strokeColor;
const DEFAULT_LIBRARY_TEXT_FONT_FAMILY = FONT_FAMILY["Comic Shanns"];
const DEFAULT_LIBRARY_TEXT_FONT_SIZE = 18;
const DEFAULT_LIBRARY_TEXT_LINE_HEIGHT = getLineHeight(
  DEFAULT_LIBRARY_TEXT_FONT_FAMILY,
);
const DEFAULT_LIBRARY_TEXT_FONT = getFontString({
  fontFamily: DEFAULT_LIBRARY_TEXT_FONT_FAMILY,
  fontSize: DEFAULT_LIBRARY_TEXT_FONT_SIZE,
});

const makeItemId = (key: string) => `default-library-${key}`;

const LEGACY_REMOVED_DEFAULT_LIBRARY_ITEM_IDS = [
  makeItemId("speech-bubble"),
  makeItemId("left-brace"),
  makeItemId("right-brace"),
  makeItemId("stored-data"),
  makeItemId("horizontal-cylinder"),
  makeItemId("cloud"),
] as const;

export const MANAGED_DEFAULT_LIBRARY_ITEM_IDS = new Set<string>([
  makeItemId("star"),
  makeItemId("triangle"),
  makeItemId("left-arrow"),
  makeItemId("right-arrow"),
  makeItemId("bidirectional-arrow"),
  makeItemId("database"),
  makeItemId("message-queue"),
  makeItemId("stick-figure"),
  ...LEGACY_REMOVED_DEFAULT_LIBRARY_ITEM_IDS,
]);

const getNestedLocaleValue = (
  locale: Record<string, unknown>,
  path: string,
) => {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== "object" || !(key in acc)) {
      return undefined;
    }
    return (acc as Record<string, unknown>)[key];
  }, locale);
};

const getDefaultLibraryLocale = (langCode: string) => {
  return langCode.startsWith("zh") ? zhCNLocale : enLocale;
};

const getDefaultLibraryText = (langCode: string, path: string) => {
  const localized = getNestedLocaleValue(getDefaultLibraryLocale(langCode), path);
  if (typeof localized === "string") {
    return localized;
  }

  const fallback = getNestedLocaleValue(enLocale, path);
  if (typeof fallback === "string") {
    return fallback;
  }

  throw new Error(`Missing default library i18n key: ${path}`);
};

const makeBaseSkeleton = (id: string, seed: number) => ({
  id,
  seed,
  version: 1,
  versionNonce: seed,
  strokeColor: DEFAULT_LIBRARY_STROKE,
  backgroundColor: DEFAULT_ELEMENT_PROPS.backgroundColor,
  fillStyle: "solid" as const,
  strokeStyle: "solid" as const,
  strokeWidth: 2,
  roughness: 0,
  opacity: DEFAULT_ELEMENT_PROPS.opacity,
  locked: false,
});

const createLineSkeleton = (
  id: string,
  seed: number,
  points: readonly [number, number][],
  extra?: {
    x?: number;
    y?: number;
    groupIds?: string[];
    backgroundColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  },
): ExcalidrawElementSkeleton => {
  const width = Math.max(...points.map(([x]) => x));
  const height = Math.max(...points.map(([, y]) => y));

  return {
    type: "line",
    x: 0,
    y: 0,
    width,
    height,
    points: points.map(([x, y]) => [x, y]),
    ...makeBaseSkeleton(id, seed),
    ...extra,
  } as ExcalidrawElementSkeleton;
};

const createEllipseSkeleton = (
  id: string,
  seed: number,
  x: number,
  y: number,
  width: number,
  height: number,
  extra?: {
    groupIds?: string[];
    backgroundColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  },
): ExcalidrawElementSkeleton =>
  ({
    type: "ellipse",
    x,
    y,
    width,
    height,
    ...makeBaseSkeleton(id, seed),
    ...extra,
  }) as ExcalidrawElementSkeleton;

const createRectangleSkeleton = (
  id: string,
  seed: number,
  x: number,
  y: number,
  width: number,
  height: number,
  extra?: {
    groupIds?: string[];
    backgroundColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
  },
): ExcalidrawElementSkeleton =>
  ({
    type: "rectangle",
    x,
    y,
    width,
    height,
    ...makeBaseSkeleton(id, seed),
    ...extra,
  }) as ExcalidrawElementSkeleton;

const createCenteredTextSkeleton = (
  id: string,
  seed: number,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  groupIds?: string[],
): ExcalidrawElementSkeleton => {
  const metrics = measureText(
    text,
    DEFAULT_LIBRARY_TEXT_FONT,
    DEFAULT_LIBRARY_TEXT_LINE_HEIGHT,
  );

  return {
    type: "text",
    text,
    x: x + (width - metrics.width) / 2,
    y: y + (height - metrics.height) / 2,
    groupIds,
    fontSize: DEFAULT_LIBRARY_TEXT_FONT_SIZE,
    fontFamily: DEFAULT_LIBRARY_TEXT_FONT_FAMILY,
    lineHeight: DEFAULT_LIBRARY_TEXT_LINE_HEIGHT,
    ...makeBaseSkeleton(id, seed),
  } as ExcalidrawElementSkeleton;
};

const createBuiltinLibraryItem = (
  key: string,
  created: number,
  name: string,
  elements: ExcalidrawElementSkeleton[],
): LibraryItem => ({
  id: makeItemId(key),
  status: "published",
  created,
  name,
  elements: convertToExcalidrawElements(elements, { regenerateIds: false }),
});

const createFilledPolygonItem = (
  key: string,
  created: number,
  name: string,
  seed: number,
  points: readonly [number, number][],
) =>
  createBuiltinLibraryItem(key, created, name, [
    createLineSkeleton(`${makeItemId(key)}-shape`, seed, points),
  ]);

const createStarItem = (name: string) =>
  createFilledPolygonItem("star", 1, name, 1001, [
    [48, 0],
    [60, 32],
    [96, 36],
    [70, 58],
    [78, 92],
    [48, 72],
    [18, 92],
    [26, 58],
    [0, 36],
    [36, 32],
    [48, 0],
  ]);

const createTriangleItem = (name: string) =>
  createFilledPolygonItem("triangle", 2, name, 1002, [
    [43, 0],
    [86, 72],
    [0, 72],
    [43, 0],
  ]);

const createLeftArrowItem = (name: string) =>
  createFilledPolygonItem("left-arrow", 3, name, 1003, [
    [0, 30],
    [34, 2],
    [34, 18],
    [124, 18],
    [124, 42],
    [34, 42],
    [34, 58],
    [0, 30],
  ]);

const createRightArrowItem = (name: string) =>
  createFilledPolygonItem("right-arrow", 4, name, 1004, [
    [0, 18],
    [90, 18],
    [90, 2],
    [124, 30],
    [90, 58],
    [90, 42],
    [0, 42],
    [0, 18],
  ]);

const createBidirectionalArrowItem = (name: string) =>
  createFilledPolygonItem("bidirectional-arrow", 5, name, 1005, [
    [0, 30],
    [24, 4],
    [24, 18],
    [96, 18],
    [96, 4],
    [120, 30],
    [96, 56],
    [96, 42],
    [24, 42],
    [24, 56],
    [0, 30],
  ]);

const createDatabaseItem = (name: string, label: string) => {
  const groupId = `${makeItemId("database")}-group`;
  const width = 104;
  const bodyY = 10;
  const bodyHeight = 58;
  const ellipseHeight = 22;

  return createBuiltinLibraryItem("database", 7, name, [
    createEllipseSkeleton(
      `${makeItemId("database")}-top`,
      1007,
      0,
      0,
      width,
      ellipseHeight,
      { groupIds: [groupId] },
    ),
    createLineSkeleton(
      `${makeItemId("database")}-left-side`,
      1008,
      [
        [0, 0],
        [0, bodyHeight],
      ],
      { x: 0, y: bodyY, groupIds: [groupId] },
    ),
    createLineSkeleton(
      `${makeItemId("database")}-right-side`,
      1009,
      [
        [0, 0],
        [0, bodyHeight],
      ],
      { x: width, y: bodyY, groupIds: [groupId] },
    ),
    createEllipseSkeleton(
      `${makeItemId("database")}-bottom`,
      1010,
      0,
      bodyY + bodyHeight - ellipseHeight / 2,
      width,
      ellipseHeight,
      { groupIds: [groupId] },
    ),
    createCenteredTextSkeleton(
      `${makeItemId("database")}-label`,
      1011,
      label,
      0,
      18,
      width,
      44,
      [groupId],
    ),
  ]);
};

const createMessageQueueItem = (name: string, label: string) => {
  const groupId = `${makeItemId("message-queue")}-group`;
  const width = 136;
  const height = 52;
  const capWidth = 28;
  const bodyX = capWidth / 2;
  const bodyWidth = width - capWidth;

  return createBuiltinLibraryItem("message-queue", 8, name, [
    createEllipseSkeleton(
      `${makeItemId("message-queue")}-left-cap`,
      1012,
      0,
      0,
      capWidth,
      height,
      { groupIds: [groupId] },
    ),
    createEllipseSkeleton(
      `${makeItemId("message-queue")}-right-cap`,
      1013,
      width - capWidth,
      0,
      capWidth,
      height,
      { groupIds: [groupId] },
    ),
    createLineSkeleton(
      `${makeItemId("message-queue")}-top`,
      1014,
      [
        [0, 0],
        [bodyWidth, 0],
      ],
      { x: bodyX, y: 0, groupIds: [groupId] },
    ),
    createLineSkeleton(
      `${makeItemId("message-queue")}-bottom`,
      1015,
      [
        [0, 0],
        [bodyWidth, 0],
      ],
      { x: bodyX, y: height, groupIds: [groupId] },
    ),
    createCenteredTextSkeleton(
      `${makeItemId("message-queue")}-label`,
      1016,
      label,
      bodyX,
      10,
      bodyWidth,
      28,
      [groupId],
    ),
  ]);
};

const createStickFigureItem = (name: string) => {
  const groupId = `${makeItemId("stick-figure")}-group`;

  return createBuiltinLibraryItem("stick-figure", 9, name, [
    createEllipseSkeleton(
      `${makeItemId("stick-figure")}-head`,
      1017,
      22,
      0,
      44,
      44,
      { groupIds: [groupId] },
    ),
    createLineSkeleton(
      `${makeItemId("stick-figure")}-body`,
      1018,
      [
        [0, 0],
        [0, 52],
      ],
      { x: 44, y: 44, groupIds: [groupId] },
    ),
    createLineSkeleton(
      `${makeItemId("stick-figure")}-arms`,
      1019,
      [
        [0, 0],
        [60, 0],
      ],
      { x: 14, y: 64, groupIds: [groupId] },
    ),
    createLineSkeleton(
      `${makeItemId("stick-figure")}-left-leg`,
      1020,
      [
        [24, 0],
        [0, 34],
      ],
      { x: 20, y: 96, groupIds: [groupId] },
    ),
    createLineSkeleton(
      `${makeItemId("stick-figure")}-right-leg`,
      1021,
      [
        [0, 0],
        [24, 34],
      ],
      { x: 44, y: 96, groupIds: [groupId] },
    ),
  ]);
};

const getDefaultLibraryItemNames = (langCode: string) => {
  return {
    star: getDefaultLibraryText(langCode, "defaultLibraryItems.star.name"),
    triangle: getDefaultLibraryText(langCode, "defaultLibraryItems.triangle.name"),
    leftArrow: getDefaultLibraryText(
      langCode,
      "defaultLibraryItems.leftArrow.name",
    ),
    rightArrow: getDefaultLibraryText(
      langCode,
      "defaultLibraryItems.rightArrow.name",
    ),
    bidirectionalArrow: getDefaultLibraryText(
      langCode,
      "defaultLibraryItems.bidirectionalArrow.name",
    ),
    database: getDefaultLibraryText(
      langCode,
      "defaultLibraryItems.database.name",
    ),
    databaseLabel: getDefaultLibraryText(
      langCode,
      "defaultLibraryItems.database.label",
    ),
    messageQueue: getDefaultLibraryText(
      langCode,
      "defaultLibraryItems.messageQueue.name",
    ),
    messageQueueLabel: getDefaultLibraryText(
      langCode,
      "defaultLibraryItems.messageQueue.label",
    ),
    stickFigure: getDefaultLibraryText(
      langCode,
      "defaultLibraryItems.stickFigure.name",
    ),
  };
};

export const getDefaultLibraryItems = (langCode: string): LibraryItems => {
  const names = getDefaultLibraryItemNames(langCode);

  return [
    createStarItem(names.star),
    createTriangleItem(names.triangle),
    createLeftArrowItem(names.leftArrow),
    createRightArrowItem(names.rightArrow),
    createBidirectionalArrowItem(names.bidirectionalArrow),
    createDatabaseItem(names.database, names.databaseLabel),
    createMessageQueueItem(names.messageQueue, names.messageQueueLabel),
    createStickFigureItem(names.stickFigure),
  ];
};

export const replaceManagedDefaultLibraryItems = (
  currentLibraryItems: LibraryItems,
  langCode: string,
): LibraryItems => {
  const nextDefaultItems = getDefaultLibraryItems(langCode);
  const preservedItems = currentLibraryItems.filter(
    (item) => !MANAGED_DEFAULT_LIBRARY_ITEM_IDS.has(item.id),
  );

  return [...nextDefaultItems, ...preservedItems];
};
