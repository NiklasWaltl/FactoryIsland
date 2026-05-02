import type { GameState } from "../types";
import type { GameAction } from "../game-actions";
import type { Module } from "../../modules/module.types";
import {
  getFragmentTraderCostForShipsSinceLastFragment,
} from "../../ship/ship-constants";
import { makeId } from "../utils/make-id";

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

  const newModule: Module = {
    id: createModuleId(),
    type: "miner-boost",
    tier: 1,
    equippedTo: null,
  };

  return {
    ...spendResult.state,
    moduleInventory: [...spendResult.state.moduleInventory, newModule],
    ship: {
      ...spendResult.state.ship,
      shipsSinceLastFragment: 0,
    },
  };
}

function createModuleId(): string {
  return globalThis.crypto?.randomUUID?.() ?? makeId("module");
}
