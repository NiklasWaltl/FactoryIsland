import type { Module } from "../../modules/module.types";
import { getAutoSmelterTickInterval } from "../../simulation/smelting-utils";
import { getSmeltingRecipe } from "../../simulation/recipes";
import {
  cellKey,
  createInitialState,
  gameReducer,
  type AutoSmelterEntry,
  type GameAction,
  type GameState,
  type PlacedAsset,
} from "../reducer";

const SMELTER_ID = "smelter-1";
const RECIPE = getSmeltingRecipe("iron")!;
const BASE_DURATION_MS = RECIPE.processingTime * 1000;

function makeSmelterAsset(moduleSlot: string | null = null): PlacedAsset {
  return {
    id: SMELTER_ID,
    type: "auto_smelter",
    x: 20,
    y: 20,
    size: 2,
    width: 2,
    height: 1,
    direction: "east",
    moduleSlot,
  };
}

function makeSmelterEntry(): AutoSmelterEntry {
  return {
    inputBuffer: ["iron", "iron", "iron", "iron", "iron"],
    processing: null,
    pendingOutput: [],
    status: "IDLE",
    lastRecipeInput: null,
    lastRecipeOutput: null,
    throughputEvents: [],
    selectedRecipe: "iron",
  };
}

function makeModule(module: Partial<Module> & Pick<Module, "id">): Module {
  return {
    type: "smelter-boost",
    tier: 1,
    equippedTo: null,
    ...module,
  };
}

function buildState(input: {
  moduleSlot?: string | null;
  modules?: Module[];
} = {}): GameState {
  const base = createInitialState("release");
  return {
    ...base,
    assets: {
      ...base.assets,
      [SMELTER_ID]: makeSmelterAsset(input.moduleSlot ?? null),
    },
    cellMap: {
      ...base.cellMap,
      [cellKey(20, 20)]: SMELTER_ID,
      [cellKey(21, 20)]: SMELTER_ID,
    },
    autoSmelters: {
      ...base.autoSmelters,
      [SMELTER_ID]: makeSmelterEntry(),
    },
    machinePowerRatio: { ...base.machinePowerRatio, [SMELTER_ID]: 1 },
    moduleInventory: input.modules ?? [],
  };
}

function runLogisticsTick(state: GameState): GameState {
  return gameReducer(state, { type: "LOGISTICS_TICK" } as GameAction);
}

describe("Auto-Smelter smelter-boost speed", () => {
  it("uses the base processing interval without a module", () => {
    const after = runLogisticsTick(buildState());

    expect(after.autoSmelters[SMELTER_ID].processing?.durationMs).toBe(
      BASE_DURATION_MS,
    );
  });

  it("uses a shorter Tier 1 processing interval", () => {
    const module = makeModule({ id: "module-1", tier: 1, equippedTo: SMELTER_ID });
    const after = runLogisticsTick(
      buildState({ moduleSlot: module.id, modules: [module] }),
    );

    expect(after.autoSmelters[SMELTER_ID].processing?.durationMs).toBe(
      getAutoSmelterTickInterval(BASE_DURATION_MS, module),
    );
    expect(after.autoSmelters[SMELTER_ID].processing?.durationMs).toBeLessThan(
      BASE_DURATION_MS,
    );
  });

  it("falls back to the base interval after the module is removed", () => {
    const module = makeModule({ id: "module-1", tier: 1, equippedTo: SMELTER_ID });
    const state = buildState({ moduleSlot: module.id, modules: [module] });
    const withoutModule = gameReducer(state, {
      type: "REMOVE_MODULE",
      moduleId: module.id,
    });

    const after = runLogisticsTick(withoutModule);

    expect(after.assets[SMELTER_ID].moduleSlot).toBeNull();
    expect(after.autoSmelters[SMELTER_ID].processing?.durationMs).toBe(
      BASE_DURATION_MS,
    );
  });

  it("updates a running batch to the base interval on the next tick after removal", () => {
    const module = makeModule({ id: "module-1", tier: 1, equippedTo: SMELTER_ID });
    const boosted = runLogisticsTick(
      buildState({ moduleSlot: module.id, modules: [module] }),
    );
    expect(boosted.autoSmelters[SMELTER_ID].processing?.durationMs).toBe(
      getAutoSmelterTickInterval(BASE_DURATION_MS, module),
    );

    const withoutModule = gameReducer(boosted, {
      type: "REMOVE_MODULE",
      moduleId: module.id,
    });
    const after = runLogisticsTick(withoutModule);

    expect(after.autoSmelters[SMELTER_ID].processing?.durationMs).toBe(
      BASE_DURATION_MS,
    );
  });

  it("ignores a miner-boost module on a smelter", () => {
    const module = makeModule({
      id: "module-1",
      type: "miner-boost",
      tier: 3,
      equippedTo: SMELTER_ID,
    });
    const after = runLogisticsTick(
      buildState({ moduleSlot: module.id, modules: [module] }),
    );

    expect(after.autoSmelters[SMELTER_ID].processing?.durationMs).toBe(
      BASE_DURATION_MS,
    );
  });
});