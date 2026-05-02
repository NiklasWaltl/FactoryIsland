import {
  gameReducer,
  createInitialState,
  type GameAction,
  type GameState,
} from "../reducer";
import { MODULE_FRAGMENT_RECIPES } from "../../constants/moduleLabConstants";
import { MODULE_FRAGMENT_ITEM_ID } from "../../ship/ship-constants";
import { DOCK_WAREHOUSE_ID } from "../bootstrap/apply-dock-warehouse-layout";

function tick(state: GameState, action: GameAction): GameState {
  return gameReducer(state, action);
}

function withFragments(state: GameState, count: number): GameState {
  return { ...state, moduleFragments: count };
}

describe("Module Lab — fragment crafting", () => {
  const tier1 = MODULE_FRAGMENT_RECIPES.find((r) => r.id === "module_tier1")!;
  const tier2 = MODULE_FRAGMENT_RECIPES.find((r) => r.id === "module_tier2")!;

  it("rejects START_MODULE_CRAFT when fragments are insufficient", () => {
    const state = withFragments(createInitialState("release"), 2);

    const after = tick(state, {
      type: "START_MODULE_CRAFT",
      recipeId: tier1.id,
    });

    expect(after.moduleLabJob).toBeNull();
    expect(after.moduleFragments).toBe(2);
  });

  it("rejects START_MODULE_CRAFT while another job is active", () => {
    let state = withFragments(createInitialState("release"), 20);

    state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier1.id });
    expect(state.moduleLabJob).not.toBeNull();
    const fragmentsAfterFirst = state.moduleFragments;

    state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier2.id });

    expect(state.moduleLabJob?.recipeId).toBe(tier1.id);
    expect(state.moduleFragments).toBe(fragmentsAfterFirst);
  });

  it("MODULE_LAB_TICK keeps a job in 'crafting' before its duration elapses", () => {
    const realNow = Date.now;
    const fakeNow = jest.spyOn(Date, "now").mockImplementation(() => 1_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier1.id });
      expect(state.moduleLabJob?.status).toBe("crafting");

      fakeNow.mockImplementation(() => 1_000_000 + tier1.durationMs - 100);
      state = tick(state, { type: "MODULE_LAB_TICK" });

      expect(state.moduleLabJob?.status).toBe("crafting");
    } finally {
      fakeNow.mockRestore();
      Date.now = realNow;
    }
  });

  it("MODULE_LAB_TICK flips a job to 'done' once duration has elapsed", () => {
    const fakeNow = jest.spyOn(Date, "now").mockImplementation(() => 2_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier1.id });

      fakeNow.mockImplementation(() => 2_000_000 + tier1.durationMs + 1);
      state = tick(state, { type: "MODULE_LAB_TICK" });

      expect(state.moduleLabJob?.status).toBe("done");
      expect(state.moduleInventory.length).toBe(0);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("COLLECT_MODULE moves a finished job into moduleInventory and clears the slot", () => {
    const fakeNow = jest.spyOn(Date, "now").mockImplementation(() => 3_000_000);

    try {
      let state = withFragments(createInitialState("release"), 10);
      state = tick(state, { type: "START_MODULE_CRAFT", recipeId: tier1.id });

      fakeNow.mockImplementation(() => 3_000_000 + tier1.durationMs + 1);
      state = tick(state, { type: "MODULE_LAB_TICK" });
      state = tick(state, { type: "COLLECT_MODULE" });

      expect(state.moduleLabJob).toBeNull();
      expect(state.moduleInventory.length).toBe(1);
      expect(state.moduleInventory[0].tier).toBe(tier1.outputTier);
      expect(state.moduleInventory[0].equippedTo).toBeNull();
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("ship fragment rewards land in moduleFragments via COLLECT_FRAGMENT, not in state.inventory", () => {
    let state = createInitialState("release");

    // Stage one fragment in the dock warehouse (mirrors ship-return reward flow).
    const dockInventory = state.warehouseInventories[DOCK_WAREHOUSE_ID] ?? {};
    state = {
      ...state,
      warehouseInventories: {
        ...state.warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...dockInventory,
          [MODULE_FRAGMENT_ITEM_ID]: (dockInventory[
            MODULE_FRAGMENT_ITEM_ID
          ] ?? 0) + 1,
        },
      },
    };

    const inventoryGearBefore = state.inventory.gear;
    state = tick(state, { type: "COLLECT_FRAGMENT" });

    expect(state.moduleFragments).toBe(1);
    expect(state.inventory.gear).toBe(inventoryGearBefore);
  });
});
