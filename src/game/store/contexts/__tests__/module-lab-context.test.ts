import type { GameAction } from "../../game-actions";
import type { ModuleLabJob, PlacedAsset } from "../../types";
import type { Module } from "../../../modules/module.types";
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
    assets: {},
    notifications: [],
    ...overrides,
  } satisfies ModuleLabContextState;
}

function makeAsset(
  overrides: Partial<PlacedAsset> & Pick<PlacedAsset, "id" | "type">,
): PlacedAsset {
  return {
    x: 0,
    y: 0,
    size: 1,
    ...overrides,
  } as PlacedAsset;
}

function makeModule(
  overrides: Partial<Module> & Pick<Module, "id" | "type">,
): Module {
  return {
    tier: 1,
    equippedTo: null,
    ...overrides,
  } as Module;
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

    it("MODULE_LAB_TICK flips a crafting job to done once duration has elapsed", () => {
      const startedAt = Date.now() - 60_000;
      const job: ModuleLabJob = {
        recipeId: "module_tier1",
        moduleType: "miner-boost",
        tier: 1,
        fragmentsRequired: 3,
        startedAt,
        durationMs: 10_000,
        status: "crafting",
      };
      const state = createModuleLabState({ moduleLabJob: job });
      const action = { type: "MODULE_LAB_TICK" } satisfies GameAction;

      const result = expectHandled(moduleLabContext.reduce(state, action));

      expect(result.moduleLabJob?.status).toBe("done");
    });

    it("MODULE_LAB_TICK is a no-op while the duration has not elapsed", () => {
      const job: ModuleLabJob = {
        recipeId: "module_tier1",
        moduleType: "miner-boost",
        tier: 1,
        fragmentsRequired: 3,
        startedAt: Date.now(),
        durationMs: 60_000,
        status: "crafting",
      };
      const state = createModuleLabState({ moduleLabJob: job });
      const action = { type: "MODULE_LAB_TICK" } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("MODULE_LAB_TICK is a no-op while the module_lab asset is deconstructing", () => {
      const startedAt = Date.now() - 60_000;
      const job: ModuleLabJob = {
        recipeId: "module_tier1",
        moduleType: "miner-boost",
        tier: 1,
        fragmentsRequired: 3,
        startedAt,
        durationMs: 10_000,
        status: "crafting",
      };
      const state = createModuleLabState({
        moduleLabJob: job,
        assets: {
          lab: makeAsset({
            id: "lab",
            type: "module_lab",
            status: "deconstructing",
          }),
        },
      });
      const action = { type: "MODULE_LAB_TICK" } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("PLACE_MODULE equips a compatible module to the asset", () => {
      const state = createModuleLabState({
        moduleInventory: [makeModule({ id: "mod-1", type: "miner-boost" })],
        assets: {
          miner: makeAsset({ id: "miner", type: "auto_miner" }),
        },
      });
      const action = {
        type: "PLACE_MODULE",
        moduleId: "mod-1",
        assetId: "miner",
      } satisfies GameAction;

      const result = expectHandled(moduleLabContext.reduce(state, action));

      expect(result.moduleInventory[0]?.equippedTo).toBe("miner");
      expect(result.assets.miner?.moduleSlot).toBe("mod-1");
      expect(result.notifications).toHaveLength(0);
    });

    it("PLACE_MODULE emits an error notification for an incompatible asset", () => {
      const state = createModuleLabState({
        moduleInventory: [makeModule({ id: "mod-1", type: "miner-boost" })],
        // miner-boost is only compatible with auto_miner; auto_smelter rejects it.
        assets: {
          smelter: makeAsset({ id: "smelter", type: "auto_smelter" }),
        },
      });
      const action = {
        type: "PLACE_MODULE",
        moduleId: "mod-1",
        assetId: "smelter",
      } satisfies GameAction;

      const result = expectHandled(moduleLabContext.reduce(state, action));

      expect(result.moduleInventory[0]?.equippedTo).toBeNull();
      expect(result.assets.smelter?.moduleSlot).toBeUndefined();
      expect(result.notifications).toHaveLength(1);
      expect(result.notifications[0]).toMatchObject({ kind: "error" });
    });

    it("PLACE_MODULE is a no-op when the asset is missing", () => {
      const state = createModuleLabState({
        moduleInventory: [makeModule({ id: "mod-1", type: "miner-boost" })],
      });
      const action = {
        type: "PLACE_MODULE",
        moduleId: "mod-1",
        assetId: "missing",
      } satisfies GameAction;

      expect(moduleLabContext.reduce(state, action)).toBe(state);
    });

    it("REMOVE_MODULE clears equippedTo and the asset's moduleSlot", () => {
      const state = createModuleLabState({
        moduleInventory: [
          makeModule({ id: "mod-1", type: "miner-boost", equippedTo: "miner" }),
        ],
        assets: {
          miner: makeAsset({
            id: "miner",
            type: "auto_miner",
            moduleSlot: "mod-1",
          }),
        },
      });
      const action = {
        type: "REMOVE_MODULE",
        moduleId: "mod-1",
      } satisfies GameAction;

      const result = expectHandled(moduleLabContext.reduce(state, action));

      expect(result.moduleInventory[0]?.equippedTo).toBeNull();
      expect(result.assets.miner?.moduleSlot).toBeNull();
    });

    it("REMOVE_MODULE is a no-op when the module is not equipped", () => {
      const state = createModuleLabState({
        moduleInventory: [makeModule({ id: "mod-1", type: "miner-boost" })],
      });
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
