import type { GameAction } from "../../game-actions";
import type { ResearchLabContextState } from "../types";
import { createEmptyInventory } from "../../inventory-ops";
import {
  RESEARCH_LAB_HANDLED_ACTION_TYPES,
  researchLabContext,
} from "../research-lab-context";

function createResearchLabState(
  overrides: Partial<ResearchLabContextState> = {},
): ResearchLabContextState {
  return {
    unlockedBuildings: ["smithy"],
    inventory: createEmptyInventory(),
    notifications: [],
    ...overrides,
  } satisfies ResearchLabContextState;
}

function expectHandled(
  result: ResearchLabContextState | null,
): ResearchLabContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected research-lab action handled");
  return result;
}

describe("researchLabContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createResearchLabState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(researchLabContext.reduce(state, action)).toBeNull();
    });

    it("RESEARCH_BUILDING happy path: unlocks building, consumes cost, emits success notification", () => {
      const state = createResearchLabState({
        inventory: { ...createEmptyInventory(), ironIngot: 25 },
      });
      const action = {
        type: "RESEARCH_BUILDING",
        recipeId: "research_generator",
      } satisfies GameAction;

      const next = expectHandled(researchLabContext.reduce(state, action));

      expect(next.unlockedBuildings).toEqual(["smithy", "generator"]);
      expect(next.inventory.ironIngot).toBe(5);
      expect(next.notifications).toHaveLength(1);
      expect(next.notifications[0]).toMatchObject({
        kind: "success",
        resource: "research_unlock",
        amount: 1,
      });
    });

    it("RESEARCH_BUILDING already-unlocked: keeps unlockedBuildings + inventory, emits error notification", () => {
      const state = createResearchLabState({
        unlockedBuildings: ["smithy", "generator"],
        inventory: { ...createEmptyInventory(), ironIngot: 25 },
      });
      const action = {
        type: "RESEARCH_BUILDING",
        recipeId: "research_generator",
      } satisfies GameAction;

      const next = expectHandled(researchLabContext.reduce(state, action));

      expect(next.unlockedBuildings).toBe(state.unlockedBuildings);
      expect(next.inventory).toBe(state.inventory);
      expect(next.notifications).toHaveLength(1);
      expect(next.notifications[0]).toMatchObject({ kind: "error" });
    });

    it("RESEARCH_BUILDING insufficient resources: keeps unlockedBuildings + inventory, emits error notification", () => {
      const state = createResearchLabState({
        inventory: { ...createEmptyInventory(), ironIngot: 5 },
      });
      const action = {
        type: "RESEARCH_BUILDING",
        recipeId: "research_generator",
      } satisfies GameAction;

      const next = expectHandled(researchLabContext.reduce(state, action));

      expect(next.unlockedBuildings).toBe(state.unlockedBuildings);
      expect(next.inventory).toBe(state.inventory);
      expect(next.notifications).toHaveLength(1);
      expect(next.notifications[0]).toMatchObject({ kind: "error" });
    });

    it("RESEARCH_BUILDING unknown recipe: keeps unlockedBuildings + inventory, emits error notification", () => {
      const state = createResearchLabState();
      const action = {
        type: "RESEARCH_BUILDING",
        recipeId: "research_does_not_exist",
      } satisfies GameAction;

      const next = expectHandled(researchLabContext.reduce(state, action));

      expect(next.unlockedBuildings).toBe(state.unlockedBuildings);
      expect(next.inventory).toBe(state.inventory);
      expect(next.notifications).toHaveLength(1);
      expect(next.notifications[0]).toMatchObject({ kind: "error" });
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
