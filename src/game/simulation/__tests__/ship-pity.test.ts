import {
  createInitialState,
  gameReducer,
  type GameAction,
  type GameState,
} from "../../store/reducer";
import { DOCK_WAREHOUSE_ID } from "../../store/bootstrap/apply-dock-warehouse-layout";
import { drawShipReward } from "../../ship/reward-table";
import { SHIP_FRAGMENT_PITY_THRESHOLD } from "../../ship/ship-constants";
import {
  CURRENT_SAVE_VERSION,
  deserializeState,
  migrateSave,
  serializeState,
  type SaveGameLatest,
} from "../save";

function dispatch(state: GameState, ...actions: GameAction[]): GameState {
  let next = state;
  for (const action of actions) next = gameReducer(next, action);
  return next;
}

function withPendingShipReward(phase = 5, pityCounter = 0): GameState {
  let state = dispatch(createInitialState("release"), { type: "SHIP_DOCK" });
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

describe("ship pity counter", () => {
  it("increments on non-fragment SHIP_RETURN for Phase-5+ ships", () => {
    let state = withPendingShipReward(5, 4);

    state = withMockedRandom(0.25, () =>
      dispatch(state, { type: "SHIP_RETURN" }),
    );

    expect(state.ship.lastReward?.kind).toBe("coins");
    expect(state.ship.pityCounter).toBe(5);
  });

  it("resets to 0 after a fragment drop", () => {
    let state = withPendingShipReward(5, 4);

    state = withMockedRandom(0.935, () =>
      dispatch(state, { type: "SHIP_RETURN" }),
    );

    expect(state.ship.lastReward?.kind).toBe("module_fragment");
    expect(state.ship.pityCounter).toBe(0);
  });

  it("resets to 0 after a complete_module drop", () => {
    let state = withPendingShipReward(5, 4);

    state = withMockedRandom(0.99, () =>
      dispatch(state, { type: "SHIP_RETURN" }),
    );

    expect(state.ship.lastReward?.kind).toBe("complete_module");
    expect(state.ship.pityCounter).toBe(0);
  });

  it("pityCounter >= 31 gives a guaranteed fragment in drawShipReward", () => {
    const pityGuaranteed = SHIP_FRAGMENT_PITY_THRESHOLD >= 31;

    expect(pityGuaranteed).toBe(true);
    expect(drawShipReward(1, pityGuaranteed)).toBe("module_fragment");
  });

  it("survives a v27 save/load round-trip through v26 migration", () => {
    const state = {
      ...createInitialState("release"),
      ship: {
        ...createInitialState("release").ship,
        pityCounter: 17,
      },
    };
    const currentSave = serializeState(state) as unknown as Record<
      string,
      unknown
    >;
    const v26Save = {
      ...currentSave,
      version: 26,
      ship: {
        ...(currentSave.ship as Record<string, unknown>),
        pityCounter: 17,
      },
    };

    const migrated = migrateSave(v26Save) as SaveGameLatest;
    const hydrated = deserializeState(migrated);

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(hydrated.ship.pityCounter).toBe(17);
  });

  it("stays 0 in a fresh GameState", () => {
    expect(createInitialState("release").ship.pityCounter).toBe(0);
  });
});
