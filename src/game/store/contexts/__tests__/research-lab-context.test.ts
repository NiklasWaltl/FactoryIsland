import type { GameAction } from "../../game-actions";
import type { ResearchLabContextState } from "../types";
import {
  RESEARCH_LAB_HANDLED_ACTION_TYPES,
  researchLabContext,
} from "../research-lab-context";

function createResearchLabState(): ResearchLabContextState {
  return {
    unlockedBuildings: ["smithy"],
  } satisfies ResearchLabContextState;
}

describe("researchLabContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createResearchLabState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(researchLabContext.reduce(state, action)).toBeNull();
    });

    it("RESEARCH_BUILDING keeps the unlockedBuildings slice unchanged (cross-slice no-op)", () => {
      const state = createResearchLabState();
      const action = {
        type: "RESEARCH_BUILDING",
        recipeId: "auto_smelter",
      } satisfies GameAction;

      expect(researchLabContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(researchLabContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(
        researchLabContext.handledActionTypes.length,
      );
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        RESEARCH_LAB_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(researchLabContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
