import type { GameState } from "../types";

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
