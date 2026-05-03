import {
  createInitialState,
  gameReducer,
  type GameAction,
  type GameState,
} from "../../store/reducer";
import { DOCK_WAREHOUSE_ID } from "../../store/bootstrap/apply-dock-warehouse-layout";
import { SHIP_WAIT_DURATION_MS } from "../../ship/ship-constants";
import { deserializeState, serializeState } from "../save";

function dispatch(state: GameState, ...actions: GameAction[]): GameState {
  let next = state;
  for (const action of actions) next = gameReducer(next, action);
  return next;
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
      const state = dispatch(createInitialState("release"), {
        type: "SHIP_DOCK",
      });

      expect(state.ship.departureAt).toBe(10_000 + SHIP_WAIT_DURATION_MS);
      expect(state.ship.departsAt).toBe(state.ship.departureAt);
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("departs when departureAt has passed", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(20_000);
    try {
      let state = dispatch(createInitialState("release"), {
        type: "SHIP_DOCK",
      });
      fakeNow.mockReturnValue(state.ship.departureAt! + 1);

      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.status).toBe("departing");
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("does not grant a reward on timer departure", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(30_000);
    try {
      let state = withQuestCargo(
        dispatch(createInitialState("release"), { type: "SHIP_DOCK" }),
      );
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

  it("does not increment pityCounter on timer departure", () => {
    const fakeNow = jest.spyOn(Date, "now").mockReturnValue(40_000);
    try {
      let state = dispatch(createInitialState("release"), {
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
      let state = dispatch(createInitialState("release"), {
        type: "SHIP_DOCK",
      });
      fakeNow.mockReturnValue(state.ship.departureAt! + 1);

      state = dispatch(state, { type: "SHIP_TICK" });

      expect(state.ship.departureAt).toBeNull();
      expect(state.ship.departsAt).toBeNull();
    } finally {
      fakeNow.mockRestore();
    }
  });

  it("preserves departureAt across save/load", () => {
    const base = createInitialState("release");
    const state = {
      ...base,
      ship: {
        ...base.ship,
        status: "docked" as const,
        departureAt: 123_456,
        departsAt: 123_456,
      },
    };

    const hydrated = deserializeState(serializeState(state));

    expect(hydrated.ship.departureAt).toBe(123_456);
    expect(hydrated.ship.departsAt).toBe(123_456);
  });
});