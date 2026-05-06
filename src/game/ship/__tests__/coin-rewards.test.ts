import { gameReducer, createInitialState } from "../../store/reducer";
import { DOCK_WAREHOUSE_ID } from "../../store/bootstrap/apply-dock-warehouse-layout";
import { spendCoins } from "../../store/action-handlers/coin-actions";

function freshState() {
  return createInitialState("release");
}

function dispatch(
  state: ReturnType<typeof freshState>,
  ...actions: Parameters<typeof gameReducer>[1][]
) {
  let next = state;
  for (const action of actions) {
    next = gameReducer(next, action);
  }
  return next;
}

function withQuestCargo(state: ReturnType<typeof freshState>) {
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

describe("ship coin rewards", () => {
  it("adds coin rewards from SHIP_RETURN to the global coin balance", () => {
    let state = withQuestCargo(dispatch(freshState(), { type: "SHIP_DOCK" }));
    state = dispatch(state, { type: "SHIP_DEPART" });
    const coinsBefore = state.inventory.coins;
    const dockCoinsBefore = state.warehouseInventories[DOCK_WAREHOUSE_ID].coins;

    const originalRandom = Math.random;
    Math.random = () => 0.25;
    try {
      state = dispatch(state, { type: "SHIP_RETURN" });
    } finally {
      Math.random = originalRandom;
    }

    expect(state.ship.lastReward?.kind).toBe("coins");
    expect(state.inventory.coins).toBe(
      coinsBefore + state.ship.lastReward!.amount,
    );
    expect(state.warehouseInventories[DOCK_WAREHOUSE_ID].coins).toBe(
      dockCoinsBefore,
    );
  });

  it("leaves coins unchanged when SHIP_RETURN has no pending reward", () => {
    const state = freshState();
    const coinsBefore = state.inventory.coins;

    const returned = dispatch(state, { type: "SHIP_RETURN" });

    expect(returned.ship.rewardPending).toBe(false);
    expect(returned.inventory.coins).toBe(coinsBefore);
  });
});

describe("spendCoins", () => {
  it("returns true and reduces coins when the balance can cover the amount", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 750 },
    };

    const result = spendCoins(state, 500);

    expect(result.spent).toBe(true);
    expect(result.state.inventory.coins).toBe(250);
    expect(state.inventory.coins).toBe(750);
  });

  it("returns false and leaves coins unchanged when the balance is too low", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 250 },
    };

    const result = spendCoins(state, 500);

    expect(result.spent).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.inventory.coins).toBe(250);
  });
});
