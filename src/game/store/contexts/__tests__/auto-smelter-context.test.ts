import type { GameAction } from "../../game-actions";
import type { AutoSmelterContextState } from "../types";
import {
  AUTO_SMELTER_HANDLED_ACTION_TYPES,
  autoSmelterContext,
} from "../auto-smelter-context";

function createAutoSmelterState(): AutoSmelterContextState {
  return {
    autoSmelters: {
      "smelter-1": {
        inputBuffer: [],
        processing: null,
        pendingOutput: [],
        status: "IDLE",
        lastRecipeInput: null,
        lastRecipeOutput: null,
        throughputEvents: [],
        selectedRecipe: "iron",
      },
    },
  } satisfies AutoSmelterContextState;
}

function expectHandled(
  result: AutoSmelterContextState | null,
): AutoSmelterContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected auto-smelter action handled");
  return result;
}

describe("autoSmelterContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createAutoSmelterState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(autoSmelterContext.reduce(state, action)).toBeNull();
    });

    it("AUTO_SMELTER_SET_RECIPE updates selectedRecipe on the target smelter", () => {
      const state = createAutoSmelterState();
      const action = {
        type: "AUTO_SMELTER_SET_RECIPE",
        assetId: "smelter-1",
        recipe: "copper",
      } satisfies GameAction;

      const result = expectHandled(autoSmelterContext.reduce(state, action));

      expect(result.autoSmelters["smelter-1"]?.selectedRecipe).toBe("copper");
    });

    it("AUTO_SMELTER_SET_RECIPE is a no-op when the smelter does not exist", () => {
      const state = createAutoSmelterState();
      const action = {
        type: "AUTO_SMELTER_SET_RECIPE",
        assetId: "missing",
        recipe: "copper",
      } satisfies GameAction;

      expect(autoSmelterContext.reduce(state, action)).toBe(state);
    });

    it("AUTO_SMELTER_SET_RECIPE is a no-op when the recipe is unchanged", () => {
      const state = createAutoSmelterState();
      const action = {
        type: "AUTO_SMELTER_SET_RECIPE",
        assetId: "smelter-1",
        recipe: "iron",
      } satisfies GameAction;

      expect(autoSmelterContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(autoSmelterContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(
        autoSmelterContext.handledActionTypes.length,
      );
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        AUTO_SMELTER_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(autoSmelterContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
