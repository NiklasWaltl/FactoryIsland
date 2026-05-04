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
import { SHIP_WAIT_DURATION_MS } from "../../ship/ship-constants";
import type { ShipState } from "../../store/types/ship-types";
import { deserializeState, serializeState } from "../save";
import { migrateSave } from "../save-migrations";

function dispatch(state: GameState, ...actions: GameAction[]): GameState {
  let next = state;
  for (const action of actions) next = gameReducer(next, action);
  return next;
}

// Local ship/module bootstrap. createInitialState no longer wires these in
// (Bootstrap-WIP) and the central createInitialShipState helper has been removed,
// so each test file that exercises the ship has to supply its own seed for now.
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

function withQuestCargo(state: GameState): GameState {
  const quest = state.ship.activeQuest!;
  return {
    ...state,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: {
        ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
        [quest.itemId]: quest.amount,
      },
    },
  };
}

describe("ship departure timer", () => {
  it("sets departureAt on SHIP_DOCK", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(10_000);
    try {
      const state = dispatch(freshState(), {
        type: "SHIP_DOCK",
      });

      expect(state.ship.departureAt).toBe(10_000 + SHIP_WAIT_DURATION_MS);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("departs when departureAt has passed", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(20_000);
    try {
      let state = dispatch(freshState(), {
        type: "SHIP_DOCK",
      });
      fakeNow.mockReturnValue(state.ship.departureAt! + 1);

      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.status).toBe("departing");
    } finally {
      fakeNow.mockRestore();
    }
  });

  // The timer-departure path (SHIP_TICK firing handleShipTimedDeparture) is intentionally
  // rewardless: it represents the ship leaving on its own without the player committing cargo.
  // The reward-bearing path is the explicit player action SHIP_DEPART, covered by the test below.
  it("does not grant a reward on timer departure", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(30_000);
    try {
      let state = withQuestCargo(dispatch(freshState(), { type: "SHIP_DOCK" }));
      const coinsBefore = state.inventory.coins;
      const fragmentsBefore = state.moduleFragments;
      fakeNow.mockReturnValue(state.ship.departureAt! + 1);

      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.rewardPending).toBe(false);
      expect(state.ship.lastReward).toBeNull();
      expect(state.inventory.coins).toBe(coinsBefore);
      expect(state.moduleFragments).toBe(fragmentsBefore);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("player-triggered SHIP_DEPART with partial quest yields a reward on return", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(60_000);
    const fakeRandom = jest.spyOn(Math, "random").mockReturnValue(0.25);
    try {
      let state = dispatch(freshState(), {
        type: "SHIP_DOCK",
      });
      const quest = state.ship.activeQuest!;
      const partialAmount = Math.max(1, Math.floor(quest.amount / 2));
      state = {
        ...state,
        warehouseInventories: {
          ...state.warehouseInventories,
          [DOCK_WAREHOUSE_ID]: {
            ...state.warehouseInventories[DOCK_WAREHOUSE_ID],
            [quest.itemId]: partialAmount,
          },
        },
      };
      const coinsBefore = state.inventory.coins;

      state = dispatch(state, { type: "SHIP_DEPART" });

      expect(state.ship.status).toBe("sailing");
      expect(state.ship.rewardPending).toBe(true);
      expect(state.ship.pendingMultiplier).toBe(1);

      fakeNow.mockReturnValue(state.ship.returnsAt! + 1);
      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.rewardPending).toBe(false);
      expect(state.ship.lastReward).not.toBeNull();
      expect(state.ship.lastReward!.kind).toBe("coins");
      expect(state.inventory.coins).toBe(
        coinsBefore + state.ship.lastReward!.amount,
      );
    } finally {
      fakeRandom.mockRestore();
      fakeNow.mockRestore();
    }
  });

  it("does not increment pityCounter on timer departure", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(40_000);
    try {
      let state = dispatch(freshState(), {
        type: "SHIP_DOCK",
      });
      state = {
        ...state,
        ship: {
          ...state.ship,
          questPhase: 5,
          pityCounter: 12,
        },
      };
      fakeNow.mockReturnValue(state.ship.departureAt! + 1);

      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.pityCounter).toBe(12);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("clears departureAt after timer departure", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(50_000);
    try {
      let state = dispatch(freshState(), {
        type: "SHIP_DOCK",
      });
      fakeNow.mockReturnValue(state.ship.departureAt! + 1);

      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.departureAt).toBeNull();
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("preserves departureAt across save/load", () => {
    const base = freshState();
    const state = {
      ...base,
      ship: {
        ...base.ship,
        status: "docked" as const,
        departureAt: 123_456,
      },
    };

    const hydrated = deserializeState(serializeState(state));

    expect(hydrated.ship.departureAt).toBe(123_456);
  });

  it("migrates legacy departsAt into canonical departureAt", () => {
    const baseline = serializeState(freshState()) as unknown as Record<
      string,
      unknown
    >;
    const migrated = migrateSave({
      ...baseline,
      version: 28,
      ship: {
        ...(baseline.ship as Record<string, unknown>),
        departureAt: null,
        departsAt: 222_000,
      },
    });

    expect(migrated).not.toBeNull();
    expect(migrated!.ship.departureAt).toBe(222_000);
  });

  it("drops invalid activeQuest/nextQuest during migration", () => {
    const baseline = serializeState(freshState()) as unknown as Record<
      string,
      unknown
    >;
    const migrated = migrateSave({
      ...baseline,
      version: 28,
      ship: {
        ...(baseline.ship as Record<string, unknown>),
        activeQuest: { bad: true },
        nextQuest: 123,
      },
    });

    expect(migrated).not.toBeNull();
    expect(migrated!.ship.activeQuest).toBeNull();
    expect(migrated!.ship.nextQuest).toBeNull();
  });
});
