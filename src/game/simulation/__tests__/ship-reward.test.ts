import {
  createInitialState,
  gameReducer,
  type GameAction,
  type GameState,
} from "../../store/reducer";
import {
  applyDockWarehouseLayout,
  DOCK_WAREHOUSE_ID,
} from "../../store/bootstrap/apply-dock-warehouse-layout";
import {
  drawShipReward,
  getExpectedRewardRange,
  getAdjustedShipRewardWeights,
  SHIP_REWARD_TABLE,
  SHIP_REWARD_WEIGHTS,
} from "../../ship/reward-table";
import { MODULE_FRAGMENT_ITEM_ID } from "../../ship/ship-constants";
import type { ShipQuest, ShipState } from "../../store/types/ship-types";

function freshShipState(): ShipState {
  return {
    status: "sailing",
    activeQuest: null,
    nextQuest: null,
    questHistory: [],
    dockedAt: null,
    departureAt: null,
    returnsAt: Date.now() + 30_000,
    rewardPending: false,
    lastReward: null,
    questPhase: 1,
    shipsSinceLastFragment: 0,
    pityCounter: 0,
    pendingMultiplier: 1,
  };
}

function freshState(): GameState {
  const base = createInitialState("release");
  return applyDockWarehouseLayout({
    ...base,
    ship: freshShipState(),
    moduleInventory: [],
    moduleFragments: 0,
    moduleLabJob: null,
  });
}

function dispatch(state: GameState, ...actions: GameAction[]): GameState {
  let next = state;
  for (const action of actions) next = gameReducer(next, action);
  return next;
}

function withPendingShipReward(phase = 5, pityCounter = 0): GameState {
  let state = dispatch(freshState(), { type: "SHIP_DOCK" });
  const quest = state.ship.activeQuest!;
  state = {
    ...state,
    ship: {
      ...state.ship,
      questPhase: phase,
      activeQuest: { ...quest, phase },
      pityCounter,
    },
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: {
        ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
        [quest.itemId]: quest.amount,
      },
    },
  };

  return dispatch(state, { type: "SHIP_DEPART" });
}

function withMockedRandom<T>(value: number, run: () => T): T {
  const originalRandom = Math.random;
  Math.random = () => value;
  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

describe("drawShipReward", () => {
  it("base weights sum to 100", () => {
    expect(
      Object.values(SHIP_REWARD_WEIGHTS).reduce(
        (sum, weight) => sum + weight,
        0,
      ),
    ).toBe(100);
  });

  it("pityGuaranteed always returns module_fragment", () => {
    expect(drawShipReward(1, true)).toBe("module_fragment");
    expect(drawShipReward(2, true)).toBe("module_fragment");
  });

  it("fulfillmentRatio 2.0 increases fragment weight", () => {
    expect(getAdjustedShipRewardWeights(2).module_fragment).toBeGreaterThan(
      getAdjustedShipRewardWeights(1).module_fragment,
    );
  });
});

describe("getExpectedRewardRange", () => {
  it("uses known weights to return the most likely reward range", () => {
    const quest: ShipQuest = {
      itemId: "wood",
      amount: 30,
      label: "Holz",
      phase: 2,
    };
    const rewardTable = {
      ...SHIP_REWARD_TABLE,
      weights: {
        coins: 1,
        basic_resource: 100,
        rare_resource: 1,
        module_fragment: 1,
        complete_module: 1,
      },
    };

    expect(getExpectedRewardRange(quest, rewardTable)).toEqual({
      min: 5,
      max: 15,
      likely: {
        kind: "basic_resource",
        label: "Rohstoffe",
      },
    });
  });
});

describe("SHIP_RETURN rewards", () => {
  it("coins draw writes coins and leaves dock warehouse unchanged", () => {
    let state = withPendingShipReward();
    const coinsBefore = state.inventory.coins;
    const dockBefore = { ...state.warehouseInventories[DOCK_WAREHOUSE_ID] };

    state = withMockedRandom(0.25, () =>
      dispatch(state, { type: "SHIP_RETURN" }),
    );

    expect(state.ship.lastReward?.kind).toBe("coins");
    expect(state.inventory.coins).toBe(
      coinsBefore + state.ship.lastReward!.amount,
    );
    expect(state.warehouseInventories[DOCK_WAREHOUSE_ID]).toEqual(dockBefore);
  });

  it("fragment draw collects a fragment and resets pityCounter", () => {
    let state = withPendingShipReward(5, 12);
    const fragmentsBefore = state.moduleFragments;

    state = withMockedRandom(0.935, () =>
      dispatch(state, { type: "SHIP_RETURN" }),
    );

    expect(state.ship.lastReward?.kind).toBe("module_fragment");
    expect(state.moduleFragments).toBe(fragmentsBefore + 1);
    expect(
      state.warehouseInventories[DOCK_WAREHOUSE_ID][MODULE_FRAGMENT_ITEM_ID] ??
        0,
    ).toBe(0);
    expect(state.ship.pityCounter).toBe(0);
  });

  it("complete_module draw lands in moduleInventory", () => {
    let state = withPendingShipReward(5, 12);
    const moduleCountBefore = state.moduleInventory.length;

    state = withMockedRandom(0.99, () =>
      dispatch(state, { type: "SHIP_RETURN" }),
    );

    expect(state.ship.lastReward?.kind).toBe("complete_module");
    expect(state.moduleInventory).toHaveLength(moduleCountBefore + 1);
    expect(
      state.moduleInventory[state.moduleInventory.length - 1],
    ).toMatchObject({
      type: "miner-boost",
      tier: 1,
      equippedTo: null,
    });
    expect(state.ship.pityCounter).toBe(0);
  });
});
