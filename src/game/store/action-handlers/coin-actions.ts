import type { GameState } from "../types";
import type { GameAction } from "../game-actions";
import {
  getFragmentTraderCostForShipsSinceLastFragment,
  MODULE_FRAGMENT_ITEM_ID,
} from "../../ship/ship-constants";
import { addDockWarehouseItem } from "../helpers/module-fragments";

export interface SpendCoinsResult {
  spent: boolean;
  state: GameState;
}

export function spendCoins(state: GameState, amount: number): SpendCoinsResult {
  if (amount <= 0) return { spent: true, state };
  if (state.inventory.coins < amount) return { spent: false, state };

  return {
    spent: true,
    state: {
      ...state,
      inventory: {
        ...state.inventory,
        coins: state.inventory.coins - amount,
      },
    },
  };
}

export function getFragmentTraderCost(state: Pick<GameState, "ship">): number {
  return getFragmentTraderCostForShipsSinceLastFragment(
    state.ship.shipsSinceLastFragment,
  );
}

export function handleCoinAction(
  state: GameState,
  action: GameAction,
): GameState | null {
  switch (action.type) {
    case "BUY_FRAGMENT":
      return buyFragment(state);

    default:
      return null;
  }
}

function buyFragment(state: GameState): GameState {
  const cost = getFragmentTraderCost(state);
  if (state.inventory.coins < cost) return state;

  const spendResult = spendCoins(state, cost);
  if (!spendResult.spent) return state;

  return {
    ...addDockWarehouseItem(spendResult.state, MODULE_FRAGMENT_ITEM_ID, 1),
    ship: {
      ...spendResult.state.ship,
      shipsSinceLastFragment: 0,
    },
  };
}
