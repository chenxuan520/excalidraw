import { beforeEach, describe, expect, it } from "vitest";
import {
  Excalidraw,
  StoreAction,
  convertToExcalidrawElements,
} from "../../packages/excalidraw";
import {
  GlobalTestState,
  fireEvent,
  mockBoundingClientRect,
  render,
  waitFor,
} from "../../packages/excalidraw/tests/test-utils";
import type { ExcalidrawImperativeAPI } from "../../packages/excalidraw/types";
import {
  resolvablePromise,
  sceneCoordsToViewportCoords,
} from "../../packages/excalidraw/utils";
import type {
  ExcalidrawLinearElement,
  OrderedExcalidrawElement,
} from "../../packages/excalidraw/element/types";
import {
  createSequenceActivationStencil,
  createSequenceStencil,
  isSequenceActivationElement,
  isSequenceMessageElement,
  isSequenceLifelineElement,
  type SequenceStencilDefaults,
} from "./sequenceStencils";
import { SequenceActivationHandles } from "./SequenceActivationHandles";

const defaults: SequenceStencilDefaults = {
  actor: "角色",
  service: "服务",
  boundary: "边界",
  control: "控制",
  entity: "实体",
  participant: "参与者",
  database: "数据库",
  mq: "消息队列",
  request: "请求",
  async: "异步",
  response: "响应",
  self: "自调用",
  note: "备注",
  loop: "循环",
  alt: "分支",
};

describe("SequenceActivationHandles", () => {
  let excalidrawAPI: ExcalidrawImperativeAPI;

  beforeEach(async () => {
    mockBoundingClientRect({
      width: 1200,
      height: 900,
      top: 0,
      left: 0,
      x: 0,
      y: 0,
    });
    const apiPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    await render(
      <Excalidraw excalidrawAPI={(api) => apiPromise.resolve(api as any)}>
        <SequenceActivationHandles />
      </Excalidraw>,
    );
    excalidrawAPI = await apiPromise;

    Object.defineProperty(
      GlobalTestState.interactiveCanvas,
      "getBoundingClientRect",
      {
        configurable: true,
        value: () => ({
          top: 0,
          left: 0,
          bottom: 900,
          right: 1200,
          width: 1200,
          height: 900,
          x: 0,
          y: 0,
          toJSON: () => {},
        }),
      },
    );
  });

  it("creates a message and target activation when dragging from a handle to another lane", async () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const leftLifeline = leftLane.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const activation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: leftLifeline.x,
        y: 140,
        height: 120,
        theme: "light",
        laneId: leftLifeline.customData?.sequenceDiagram?.laneId,
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    excalidrawAPI.updateScene({
      elements: [...leftLane, ...rightLane, activation],
      storeAction: StoreAction.UPDATE,
    });

    await waitFor(() => {
      expect(
        window.h.elements.filter(isSequenceActivationElement),
      ).toHaveLength(1);
    });

    const start = sceneCoordsToViewportCoords(
      {
        sceneX: activation.x + activation.width,
        sceneY: activation.y + activation.height / 2,
      },
      window.h.state,
    );
    const end = sceneCoordsToViewportCoords(
      {
        sceneX: rightLane.find((element) => isSequenceLifelineElement(element))!
          .x,
        sceneY: 220,
      },
      window.h.state,
    );

    fireEvent.pointerMove(window, {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    const handle = await waitFor(() => {
      const node = document.querySelectorAll(
        ".sequence-activation-handles__handle",
      )[1] as HTMLButtonElement | undefined;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.pointerDown(handle, {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerMove(document, {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerUp(document, {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    await waitFor(() => {
      expect(window.h.elements.filter(isSequenceMessageElement)).toHaveLength(
        1,
      );
      expect(
        window.h.elements.filter(isSequenceActivationElement),
      ).toHaveLength(2);
    });
  });

  it("shows a blank activation bar when hovering a lifeline", async () => {
    const lane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const lifeline = lane.find((element) => isSequenceLifelineElement(element))!;

    excalidrawAPI.updateScene({
      elements: lane,
      storeAction: StoreAction.UPDATE,
    });

    const hoverPoint = sceneCoordsToViewportCoords(
      {
        sceneX: lifeline.x,
        sceneY: lifeline.y + 120,
      },
      window.h.state,
    );

    fireEvent.pointerMove(window, {
      clientX: hoverPoint.x,
      clientY: hoverPoint.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    await waitFor(() => {
      const ghost = document.querySelector(
        ".sequence-activation-handles__hover-activation",
      ) as SVGRectElement | null;
      expect(ghost).toBeTruthy();
      expect(Number(ghost?.getAttribute("y"))).toBe(hoverPoint.y);
      expect(
        document.querySelectorAll(".sequence-activation-handles__handle"),
      ).toHaveLength(2);
    });
  });

  it("creates source and target activations when dragging from a blank hovered bar", async () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const leftLifeline = leftLane.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const rightLifeline = rightLane.find((element) =>
      isSequenceLifelineElement(element),
    )!;

    excalidrawAPI.updateScene({
      elements: [...leftLane, ...rightLane],
      storeAction: StoreAction.UPDATE,
    });

    const start = sceneCoordsToViewportCoords(
      {
        sceneX: leftLifeline.x,
        sceneY: leftLifeline.y + 140,
      },
      window.h.state,
    );
    const end = sceneCoordsToViewportCoords(
      {
        sceneX: rightLifeline.x,
        sceneY: rightLifeline.y + 180,
      },
      window.h.state,
    );

    fireEvent.pointerMove(window, {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    const handle = await waitFor(() => {
      const node = document.querySelectorAll(
        ".sequence-activation-handles__handle",
      )[1] as HTMLButtonElement | undefined;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.pointerDown(handle, {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerMove(document, {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerUp(document, {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    await waitFor(() => {
      expect(window.h.elements.filter(isSequenceMessageElement)).toHaveLength(
        1,
      );
      const activations = window.h.elements.filter(isSequenceActivationElement);
      expect(activations).toHaveLength(2);
      const sourceActivation = activations
        .filter(isSequenceActivationElement)
        .sort((a, b) => a.x - b.x)[0];
      const targetActivation = activations
        .filter(isSequenceActivationElement)
        .sort((a, b) => a.x - b.x)[1];
      const message = window.h.elements.find(isSequenceMessageElement) as
        | (OrderedExcalidrawElement & ExcalidrawLinearElement)
        | undefined;

      expect(sourceActivation?.y).toBe(leftLifeline.y + 140);
      expect(targetActivation?.y).toBe(leftLifeline.y + 140);
      expect(message?.y).toBe(leftLifeline.y + 140);
    });
  });

  it("creates a self call at the dragged start and stop positions without adding activations", async () => {
    const lane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const lifeline = lane.find((element) => isSequenceLifelineElement(element))!;
    const sourceActivation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: lifeline.x,
        y: 140,
        height: 120,
        theme: "light",
        laneId: lifeline.customData?.sequenceDiagram?.laneId,
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    excalidrawAPI.updateScene({
      elements: [...lane, sourceActivation],
      storeAction: StoreAction.UPDATE,
    });

    const start = sceneCoordsToViewportCoords(
      {
        sceneX: sourceActivation.x + sourceActivation.width,
        sceneY: sourceActivation.y + 24,
      },
      window.h.state,
    );
    const end = sceneCoordsToViewportCoords(
      {
        sceneX: sourceActivation.x + 120,
        sceneY: sourceActivation.y + 60,
      },
      window.h.state,
    );

    fireEvent.pointerMove(window, {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    const handle = await waitFor(() => {
      const node = document.querySelectorAll(
        ".sequence-activation-handles__handle",
      )[1] as HTMLButtonElement | undefined;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.pointerDown(handle, {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerMove(document, {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerUp(document, {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    await waitFor(() => {
      const activations = window.h.elements.filter(isSequenceActivationElement);
      const message = window.h.elements.find(isSequenceMessageElement) as
        | (OrderedExcalidrawElement & ExcalidrawLinearElement)
        | undefined;

      expect(activations).toHaveLength(1);
      expect(message?.customData?.sequenceDiagram?.toActivationId).toBe(
        undefined,
      );
      expect(message?.points.length).toBe(4);
      expect(message?.y).toBe(sourceActivation.y + 24);
      expect((message?.points[1]?.[0] || 0) > 56).toBe(true);
      expect(message?.points[3]?.[0]).toBe(0);
      expect(message?.points[3]?.[1]).toBe(36);
    });
  });

  it("reuses an existing target activation instead of creating a new one", async () => {
    const leftLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ) as OrderedExcalidrawElement[];
    const rightLane = convertToExcalidrawElements(
      createSequenceStencil("participant", "light", defaults),
      { regenerateIds: false },
    ).map((element) => ({
      ...element,
      x: element.x + 320,
    })) as OrderedExcalidrawElement[];
    const leftLifeline = leftLane.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const rightLifeline = rightLane.find((element) =>
      isSequenceLifelineElement(element),
    )!;
    const sourceActivation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: leftLifeline.x,
        y: 140,
        height: 120,
        theme: "light",
        laneId: leftLifeline.customData?.sequenceDiagram?.laneId,
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;
    const targetActivation = convertToExcalidrawElements(
      createSequenceActivationStencil({
        centerX: rightLifeline.x,
        y: 200,
        height: 120,
        theme: "light",
        laneId: rightLifeline.customData?.sequenceDiagram?.laneId,
      }),
      { regenerateIds: false },
    )[0] as OrderedExcalidrawElement;

    excalidrawAPI.updateScene({
      elements: [...leftLane, ...rightLane, sourceActivation, targetActivation],
      storeAction: StoreAction.UPDATE,
    });

    await waitFor(() => {
      expect(
        window.h.elements.filter(isSequenceActivationElement),
      ).toHaveLength(2);
    });

    const start = sceneCoordsToViewportCoords(
      {
        sceneX: sourceActivation.x + sourceActivation.width,
        sceneY: sourceActivation.y + sourceActivation.height / 2,
      },
      window.h.state,
    );
    const end = sceneCoordsToViewportCoords(
      {
        sceneX: targetActivation.x + targetActivation.width / 2,
        sceneY: targetActivation.y + 24,
      },
      window.h.state,
    );

    fireEvent.pointerMove(window, {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    const handle = await waitFor(() => {
      const node = document.querySelectorAll(
        ".sequence-activation-handles__handle",
      )[1] as HTMLButtonElement | undefined;
      expect(node).toBeTruthy();
      return node!;
    });

    fireEvent.pointerDown(handle, {
      clientX: start.x,
      clientY: start.y,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerMove(document, {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      pointerId: 1,
    });
    fireEvent.pointerUp(document, {
      clientX: end.x,
      clientY: end.y,
      pointerType: "mouse",
      pointerId: 1,
    });

    await waitFor(() => {
      expect(window.h.elements.filter(isSequenceMessageElement)).toHaveLength(
        1,
      );
      expect(
        window.h.elements.filter(isSequenceActivationElement),
      ).toHaveLength(2);
    });
  });
});
