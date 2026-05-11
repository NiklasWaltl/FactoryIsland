import type { GameAction } from "../../game-actions";
import type { AutoAssemblerContextState } from "../types";
import {
  AUTO_ASSEMBLER_HANDLED_ACTION_TYPES,
  autoAssemblerContext,
} from "../auto-assembler-context";

function createAutoAssemblerState(
  overrides: Partial<AutoAssemblerContextState["autoAssemblers"][string]> = {},
): AutoAssemblerContextState {
  return {
    autoAssemblers: {
      "assembler-1": {
        ironIngotBuffer: 0,
        processing: null,
        pendingOutput: [],
        status: "IDLE",
        selectedRecipe: "metal_plate",
        ...overrides,
      },
    },
  } satisfies AutoAssemblerContextState;
}

function expectHandled(
  result: AutoAssemblerContextState | null,
): AutoAssemblerContextState {
  expect(result).not.toBeNull();
  if (result === null)
    throw new Error("Expected auto-assembler action handled");
  return result;
}

describe("autoAssemblerContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createAutoAssemblerState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(autoAssemblerContext.reduce(state, action)).toBeNull();
    });

    it("AUTO_ASSEMBLER_SET_RECIPE switches recipe when fully idle", () => {
      const state = createAutoAssemblerState();
      const action = {
        type: "AUTO_ASSEMBLER_SET_RECIPE",
        assetId: "assembler-1",
        recipe: "gear",
      } satisfies GameAction;

      const result = expectHandled(autoAssemblerContext.reduce(state, action));

      expect(result.autoAssemblers["assembler-1"]?.selectedRecipe).toBe("gear");
    });

    it("AUTO_ASSEMBLER_SET_RECIPE is a no-op when buffer is non-empty", () => {
      const state = createAutoAssemblerState({ ironIngotBuffer: 2 });
      const action = {
        type: "AUTO_ASSEMBLER_SET_RECIPE",
        assetId: "assembler-1",
        recipe: "gear",
      } satisfies GameAction;

      expect(autoAssemblerContext.reduce(state, action)).toBe(state);
    });

    it("AUTO_ASSEMBLER_SET_RECIPE is a no-op while processing", () => {
      const state = createAutoAssemblerState({
        processing: {
          outputItem: "metalPlate",
          progressMs: 100,
          durationMs: 1000,
        },
      });
      const action = {
        type: "AUTO_ASSEMBLER_SET_RECIPE",
        assetId: "assembler-1",
        recipe: "gear",
      } satisfies GameAction;

      expect(autoAssemblerContext.reduce(state, action)).toBe(state);
    });

    it("AUTO_ASSEMBLER_SET_RECIPE is a no-op when pendingOutput is not empty", () => {
      const state = createAutoAssemblerState({ pendingOutput: ["metalPlate"] });
      const action = {
        type: "AUTO_ASSEMBLER_SET_RECIPE",
        assetId: "assembler-1",
        recipe: "gear",
      } satisfies GameAction;

      expect(autoAssemblerContext.reduce(state, action)).toBe(state);
    });

    it("AUTO_ASSEMBLER_SET_RECIPE is a no-op when the entry does not exist", () => {
      const state = createAutoAssemblerState();
      const action = {
        type: "AUTO_ASSEMBLER_SET_RECIPE",
        assetId: "missing",
        recipe: "gear",
      } satisfies GameAction;

      expect(autoAssemblerContext.reduce(state, action)).toBe(state);
    });

    it("AUTO_ASSEMBLER_SET_RECIPE is a no-op when the recipe is unchanged", () => {
      const state = createAutoAssemblerState();
      const action = {
        type: "AUTO_ASSEMBLER_SET_RECIPE",
        assetId: "assembler-1",
        recipe: "metal_plate",
      } satisfies GameAction;

      expect(autoAssemblerContext.reduce(state, action)).toBe(state);
    });

    it("LOGISTICS_TICK keeps the auto-assembler slice unchanged (cross-slice no-op)", () => {
      const state = createAutoAssemblerState();
      const action = { type: "LOGISTICS_TICK" } satisfies GameAction;

      expect(autoAssemblerContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(autoAssemblerContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(
        autoAssemblerContext.handledActionTypes.length,
      );
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        AUTO_ASSEMBLER_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(autoAssemblerContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
