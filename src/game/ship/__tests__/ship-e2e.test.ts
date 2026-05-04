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
import type { ShipState } from "../../store/types/ship-types";

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
  for (const action of actions) {
    next = gameReducer(next, action);
  }
  return next;
}

function withQuestCargo(state: GameState, amount: number): GameState {
  const quest = state.ship.activeQuest;
  if (!quest) return state;

  return {
    ...state,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: {
        ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
        [quest.itemId]: amount,
      },
    },
  };
}

describe("ship runtime e2e", () => {
  it("docked -> 100% quest -> SHIP_DEPART -> return tick grants reward", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(100_000);
    const fakeRandom = jest.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      let state = dispatch(freshState(), { type: "SHIP_DOCK" });
      const quest = state.ship.activeQuest;
      expect(quest).not.toBeNull();
      if (!quest) return;

      state = withQuestCargo(state, quest.amount);
      const coinsBefore = state.inventory.coins;

      state = dispatch(state, { type: "SHIP_DEPART" });

      expect(state.ship.status).toBe("sailing");
      expect(state.ship.pendingMultiplier).toBe(1);
      expect(state.ship.rewardPending).toBe(true);

      fakeNow.mockReturnValue(state.ship.returnsAt! + 1);
      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.rewardPending).toBe(false);
      expect(state.ship.lastReward).not.toBeNull();
      expect(state.ship.lastReward?.kind).toBe("coins");
      expect(state.inventory.coins).toBe(
        coinsBefore + (state.ship.lastReward?.amount ?? 0),
      );
    } finally {
      fakeRandom.mockRestore();
      fakeNow.mockRestore();
    }
  });

  it("docked -> 50% quest -> SHIP_DEPART -> return tick uses 1x multiplier", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(200_000);
    const fakeRandom = jest.spyOn(Math, "random").mockReturnValue(0.25);

    try {
      let state = dispatch(freshState(), { type: "SHIP_DOCK" });
      const quest = state.ship.activeQuest;
      expect(quest).not.toBeNull();
      if (!quest) return;

      const partialAmount = Math.max(1, Math.floor(quest.amount / 2));
      state = withQuestCargo(state, partialAmount);
      const coinsBefore = state.inventory.coins;

      state = dispatch(state, { type: "SHIP_DEPART" });

      expect(state.ship.status).toBe("sailing");
      expect(state.ship.pendingMultiplier).toBe(1);
      expect(state.ship.rewardPending).toBe(true);

      fakeNow.mockReturnValue(state.ship.returnsAt! + 1);
      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.lastReward?.kind).toBe("coins");
      expect(state.inventory.coins).toBe(
        coinsBefore + (state.ship.lastReward?.amount ?? 0),
      );
    } finally {
      fakeRandom.mockRestore();
      fakeNow.mockRestore();
    }
  });

  it("docked -> 0% quest -> SHIP_DEPART -> return tick gives no reward and increases pity", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(300_000);

    try {
      let state = dispatch(freshState(), { type: "SHIP_DOCK" });
      const activeQuest = state.ship.activeQuest;
      expect(activeQuest).not.toBeNull();
      if (!activeQuest) return;

      state = {
        ...state,
        ship: {
          ...state.ship,
          questPhase: 5,
          pityCounter: 4,
          activeQuest: { ...activeQuest, phase: 5 },
        },
      };

      const coinsBefore = state.inventory.coins;
      const fragmentsBefore = state.moduleFragments;

      state = dispatch(state, { type: "SHIP_DEPART" });

      expect(state.ship.pendingMultiplier).toBe(0);
      expect(state.ship.rewardPending).toBe(false);

      fakeNow.mockReturnValue(state.ship.returnsAt! + 1);
      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.lastReward).toBeNull();
      expect(state.inventory.coins).toBe(coinsBefore);
      expect(state.moduleFragments).toBe(fragmentsBefore);
      expect(state.ship.pityCounter).toBe(5);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("timer expiry without manual depart stays rewardless and docks on return", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(400_000);

    try {
      let state = dispatch(freshState(), { type: "SHIP_DOCK" });
      const quest = state.ship.activeQuest;
      expect(quest).not.toBeNull();
      if (!quest) return;

      state = {
        ...withQuestCargo(state, quest.amount),
        ship: {
          ...state.ship,
          questPhase: 5,
          pityCounter: 12,
          activeQuest: { ...quest, phase: 5 },
        },
      };

      fakeNow.mockReturnValue(state.ship.departureAt! + 1);
      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.status).toBe("departing");
      expect(state.ship.rewardPending).toBe(false);
      expect(state.ship.lastReward).toBeNull();
      expect(state.ship.activeQuest).toBeNull();
      expect(state.ship.departureAt).toBeNull();
      expect(
        state.warehouseInventories[DOCK_WAREHOUSE_ID][quest.itemId] ?? 0,
      ).toBe(0);
      expect(state.ship.pityCounter).toBe(12);

      fakeNow.mockReturnValue(state.ship.returnsAt! + 1);
      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.status).toBe("docked");
      expect(state.ship.rewardPending).toBe(false);
      expect(state.ship.lastReward).toBeNull();
      expect(state.ship.activeQuest).not.toBeNull();
      expect(state.ship.pityCounter).toBe(12);
    } finally {
      fakeNow.mockRestore();
    }
  });
});
