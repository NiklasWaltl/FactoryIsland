import type { GameAction } from "../../game-actions";
import type { ModuleLabJob } from "../../types";
import type { ModuleLabContextState } from "../types";
import {
  MODULE_LAB_HANDLED_ACTION_TYPES,
  moduleLabContext,
} from "../module-lab-context";

function createModuleLabState(
  overrides: Partial<ModuleLabContextState> = {},
): ModuleLabContextState {
  return {
    moduleLabJob: null,
    moduleFragments: 0,
    moduleInventory: [],
    ...overrides,
  } satisfies ModuleLabContextState;
}

function expectHandled(
  result: ModuleLabContextState | null,
): ModuleLabContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected module-lab action handled");
  return result;
}

describe("moduleLabContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createModuleLabState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBeNull();
    });

    it("START_MODULE_CRAFT consumes fragments and opens a crafting job", () => {
      const state = createModuleLabState({ moduleFragments: 3 });
      const action = {
        type: "START_MODULE_CRAFT",
        recipeId: "module_tier1",
      } satisfies GameAction;

      const result = expectHandled(moduleLabContext.reduce(state, action));

      expect(result.moduleFragments).toBe(0);
      expect(result.moduleLabJob).not.toBeNull();
      expect(result.moduleLabJob?.status).toBe("crafting");
    });

    it("START_MODULE_CRAFT is a no-op when fragments are insufficient", () => {
      const state = createModuleLabState({ moduleFragments: 1 });
      const action = {
        type: "START_MODULE_CRAFT",
        recipeId: "module_tier1",
      } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("START_MODULE_CRAFT is a no-op when the recipe is unknown", () => {
      const state = createModuleLabState({ moduleFragments: 10 });
      const action = {
        type: "START_MODULE_CRAFT",
        recipeId: "does_not_exist",
      } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("START_MODULE_CRAFT is a no-op while another job is in flight", () => {
      const existingJob: ModuleLabJob = {
        recipeId: "module_tier1",
        moduleType: "miner-boost",
        tier: 1,
        fragmentsRequired: 3,
        startedAt: 0,
        durationMs: 10_000,
        status: "crafting",
      };
      const state = createModuleLabState({
        moduleFragments: 10,
        moduleLabJob: existingJob,
      });
      const action = {
        type: "START_MODULE_CRAFT",
        recipeId: "module_tier2",
      } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("COLLECT_MODULE moves a completed job into the module inventory", () => {
      const finishedJob: ModuleLabJob = {
        recipeId: "module_tier1",
        moduleType: "miner-boost",
        tier: 1,
        fragmentsRequired: 3,
        startedAt: 0,
        durationMs: 1,
        status: "done",
      };
      const state = createModuleLabState({ moduleLabJob: finishedJob });
      const action = { type: "COLLECT_MODULE" } satisfies GameAction;

      const result = expectHandled(moduleLabContext.reduce(state, action));

      expect(result.moduleLabJob).toBeNull();
      expect(result.moduleInventory).toHaveLength(1);
      expect(result.moduleInventory[0]?.type).toBe("miner-boost");
      expect(result.moduleInventory[0]?.tier).toBe(1);
      expect(result.moduleInventory[0]?.equippedTo).toBeNull();
    });

    it("COLLECT_MODULE is a no-op when the job is still crafting", () => {
      const craftingJob: ModuleLabJob = {
        recipeId: "module_tier1",
        moduleType: "miner-boost",
        tier: 1,
        fragmentsRequired: 3,
        startedAt: Date.now(),
        durationMs: 60_000,
        status: "crafting",
      };
      const state = createModuleLabState({ moduleLabJob: craftingJob });
      const action = { type: "COLLECT_MODULE" } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("COLLECT_MODULE is a no-op when no job exists", () => {
      const state = createModuleLabState();
      const action = { type: "COLLECT_MODULE" } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("MODULE_LAB_TICK keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createModuleLabState();
      const action = { type: "MODULE_LAB_TICK" } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("PLACE_MODULE keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createModuleLabState();
      const action = {
        type: "PLACE_MODULE",
        moduleId: "mod-1",
        assetId: "asset-1",
      } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("REMOVE_MODULE keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createModuleLabState();
      const action = {
        type: "REMOVE_MODULE",
        moduleId: "mod-1",
      } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(moduleLabContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(moduleLabContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        MODULE_LAB_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(moduleLabContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
