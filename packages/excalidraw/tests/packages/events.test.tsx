import { vi } from "vitest";
import { Excalidraw, StoreAction } from "../../index";
import type { ExcalidrawImperativeAPI } from "../../types";
import { resolvablePromise } from "../../utils";
import { cleanup, render } from "../test-utils";
import { Pointer } from "../helpers/ui";

describe("event callbacks", () => {
  const h = window.h;

  let excalidrawAPI: ExcalidrawImperativeAPI;

  const mouse = new Pointer("mouse");

  beforeEach(async () => {
    const excalidrawAPIPromise = resolvablePromise<ExcalidrawImperativeAPI>();
    await render(
      <Excalidraw
        excalidrawAPI={(api) => excalidrawAPIPromise.resolve(api as any)}
      />,
    );
    excalidrawAPI = await excalidrawAPIPromise;
  });

  it("should trigger onChange on render", async () => {
    const onChange = vi.fn();

    const origBackgroundColor = h.state.viewBackgroundColor;
    excalidrawAPI.onChange(onChange);
    excalidrawAPI.updateScene({
      appState: { viewBackgroundColor: "red" },
      storeAction: StoreAction.CAPTURE,
    });
    expect(onChange).toHaveBeenCalledWith(
      // elements
      [],
      // appState
      expect.objectContaining({
        viewBackgroundColor: "red",
      }),
      // files
      {},
    );
    expect(onChange.mock.lastCall[1].viewBackgroundColor).not.toBe(
      origBackgroundColor,
    );
  });

  it("should trigger onPointerDown/onPointerUp on canvas pointerDown/pointerUp", async () => {
    const onPointerDown = vi.fn();
    const onPointerUp = vi.fn();

    excalidrawAPI.onPointerDown(onPointerDown);
    excalidrawAPI.onPointerUp(onPointerUp);

    mouse.downAt(100);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).not.toHaveBeenCalled();
    mouse.up();
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onPointerUp).toHaveBeenCalledTimes(1);
  });

  it("should trigger onPointerUpAfterFinalize after pointer up completes", async () => {
    const onPointerUpAfterFinalize = vi.fn();

    cleanup();
    await render(
      <Excalidraw onPointerUpAfterFinalize={onPointerUpAfterFinalize} />,
    );

    mouse.downAt(100);
    expect(onPointerUpAfterFinalize).not.toHaveBeenCalled();
    mouse.up();
    expect(onPointerUpAfterFinalize).toHaveBeenCalledTimes(1);
  });
});
