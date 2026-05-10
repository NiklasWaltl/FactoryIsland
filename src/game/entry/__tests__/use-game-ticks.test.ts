import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useGameTicks } from "../use-game-ticks";
import type { GameAction } from "../../store/game-actions";
import type { GameState } from "../../store/types";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Minimal state shape — useGameTicks only reads a handful of fields.
function buildMockState(overrides: Partial<GameState> = {}): GameState {
  const base = {
    smithy: { processing: false },
    manualAssembler: { processing: false },
    moduleLabJob: null,
    generators: { gen1: { running: true } },
    crafting: { jobs: [{ status: "queued" }] },
    keepStockByWorkbench: {},
    saplingGrowAt: {},
  };
  return { ...base, ...overrides } as unknown as GameState;
}

interface HookHostProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

function HookHost({ state, dispatch }: HookHostProps): null {
  useGameTicks(state, dispatch);
  return null;
}

function createHostElement(props: HookHostProps): React.ReactElement {
  return React.createElement(HookHost, props);
}

describe("useGameTicks orchestrator", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.useRealTimers();
  });

  describe("deterministic in-tick order", () => {
    it("dispatches generator → energy → logistics → drone → job within a single firing", () => {
      const dispatch = jest.fn<void, [GameAction]>();
      const state = buildMockState();

      act(() => {
        root.render(createHostElement({ state, dispatch }));
      });

      // Skip past the first 19 firings (1900ms). Tick #20 at 2000ms is the
      // first iteration where every chain dispatch coincides — GENERATOR
      // (200ms), ENERGY_NET (2000ms), LOGISTICS/DRONE/JOB (500ms) all align.
      act(() => {
        jest.advanceTimersByTime(1900);
      });
      dispatch.mockClear();

      act(() => {
        jest.advanceTimersByTime(100);
      });

      const calledTypes = dispatch.mock.calls.map((c) => c[0].type);
      const indexOf = (type: string): number => calledTypes.indexOf(type);

      // All chain ticks fired
      expect(indexOf("GENERATOR_TICK")).toBeGreaterThanOrEqual(0);
      expect(indexOf("ENERGY_NET_TICK")).toBeGreaterThanOrEqual(0);
      expect(indexOf("LOGISTICS_TICK")).toBeGreaterThanOrEqual(0);
      expect(indexOf("DRONE_TICK")).toBeGreaterThanOrEqual(0);
      expect(indexOf("JOB_TICK")).toBeGreaterThanOrEqual(0);

      // Strict pairwise ordering as documented in use-game-ticks.ts.
      expect(indexOf("GENERATOR_TICK")).toBeLessThan(
        indexOf("ENERGY_NET_TICK"),
      );
      expect(indexOf("ENERGY_NET_TICK")).toBeLessThan(
        indexOf("LOGISTICS_TICK"),
      );
      expect(indexOf("LOGISTICS_TICK")).toBeLessThan(indexOf("DRONE_TICK"));
      expect(indexOf("DRONE_TICK")).toBeLessThan(indexOf("JOB_TICK"));
    });
  });

  describe("safeDispatchRef error handling", () => {
    it("catches a thrown handler error and dispatches ADD_ERROR_NOTIFICATION with sourceAction and tick", () => {
      const dispatch = jest.fn<void, [GameAction]>((action) => {
        if (action.type === "LOGISTICS_TICK") {
          throw new Error("boom");
        }
      });
      const state = buildMockState();

      act(() => {
        root.render(createHostElement({ state, dispatch }));
      });

      // Advance past the first LOGISTICS_TICK firing (500ms).
      expect(() => {
        act(() => {
          jest.advanceTimersByTime(500);
        });
      }).not.toThrow();

      const errorCall = dispatch.mock.calls.find(
        (c) => c[0].type === "ADD_ERROR_NOTIFICATION",
      );
      expect(errorCall).toBeDefined();
      const action = errorCall![0] as Extract<
        GameAction,
        { type: "ADD_ERROR_NOTIFICATION" }
      >;
      expect(action.sourceAction).toBe("LOGISTICS_TICK");
      expect(action.message).toContain("LOGISTICS_TICK");
      expect(action.message).toContain("boom");
      expect(typeof action.tick).toBe("number");
      expect(action.tick).toBeGreaterThan(0);
    });

    it("keeps the orchestrator running after a handler error (subsequent ticks still fire)", () => {
      const dispatch = jest.fn<void, [GameAction]>((action) => {
        if (action.type === "LOGISTICS_TICK") {
          throw new Error("boom");
        }
      });
      const state = buildMockState();

      act(() => {
        root.render(createHostElement({ state, dispatch }));
      });

      act(() => {
        jest.advanceTimersByTime(500);
      });
      const errorsAfterFirstFire = dispatch.mock.calls.filter(
        (c) => c[0].type === "ADD_ERROR_NOTIFICATION",
      ).length;
      expect(errorsAfterFirstFire).toBe(1);

      // The next 500ms window must still produce another LOGISTICS_TICK
      // attempt — proving the interval did not get torn down by the throw.
      act(() => {
        jest.advanceTimersByTime(500);
      });
      const logisticsCalls = dispatch.mock.calls.filter(
        (c) => c[0].type === "LOGISTICS_TICK",
      ).length;
      expect(logisticsCalls).toBeGreaterThanOrEqual(2);
      const errorsAfterSecondFire = dispatch.mock.calls.filter(
        (c) => c[0].type === "ADD_ERROR_NOTIFICATION",
      ).length;
      expect(errorsAfterSecondFire).toBe(2);
    });

    it("does not dispatch ADD_ERROR_NOTIFICATION on the happy path", () => {
      const dispatch = jest.fn<void, [GameAction]>();
      const state = buildMockState();

      act(() => {
        root.render(createHostElement({ state, dispatch }));
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      const errorCalls = dispatch.mock.calls.filter(
        (c) => c[0].type === "ADD_ERROR_NOTIFICATION",
      );
      expect(errorCalls).toHaveLength(0);
    });
  });

  describe("standalone ticks (NATURAL_SPAWN, GROW_SAPLINGS)", () => {
    it("reports a NATURAL_SPAWN handler error via ADD_ERROR_NOTIFICATION", () => {
      const dispatch = jest.fn<void, [GameAction]>((action) => {
        if (action.type === "NATURAL_SPAWN") {
          throw new Error("spawn-fail");
        }
      });
      const state = buildMockState();

      act(() => {
        root.render(createHostElement({ state, dispatch }));
      });

      // NATURAL_SPAWN_MS is 60_000.
      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      const errorCall = dispatch.mock.calls.find(
        (c) =>
          c[0].type === "ADD_ERROR_NOTIFICATION" &&
          (c[0] as { sourceAction?: string }).sourceAction === "NATURAL_SPAWN",
      );
      expect(errorCall).toBeDefined();
      const action = errorCall![0] as Extract<
        GameAction,
        { type: "ADD_ERROR_NOTIFICATION" }
      >;
      expect(action.message).toContain("spawn-fail");
    });

    it("reports a GROW_SAPLINGS handler error via ADD_ERROR_NOTIFICATION", () => {
      const dispatch = jest.fn<void, [GameAction]>((action) => {
        if (action.type === "GROW_SAPLINGS") {
          throw new Error("grow-fail");
        }
      });
      // A sapling already past its grow-at time guarantees the GROW_SAPLINGS
      // dispatch fires on the next 1s tick.
      const state = buildMockState({
        saplingGrowAt: { "sap-1": Date.now() - 1 },
      } as Partial<GameState>);

      act(() => {
        root.render(createHostElement({ state, dispatch }));
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      const errorCall = dispatch.mock.calls.find(
        (c) =>
          c[0].type === "ADD_ERROR_NOTIFICATION" &&
          (c[0] as { sourceAction?: string }).sourceAction === "GROW_SAPLINGS",
      );
      expect(errorCall).toBeDefined();
      const action = errorCall![0] as Extract<
        GameAction,
        { type: "ADD_ERROR_NOTIFICATION" }
      >;
      expect(action.message).toContain("grow-fail");
    });
  });
});
