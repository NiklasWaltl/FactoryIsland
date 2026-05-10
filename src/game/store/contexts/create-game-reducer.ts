import type { GameAction } from "../game-actions";
import type { GameState } from "../types";
import { autoMinerContext } from "./auto-miner-context";
import { craftingContext } from "./crafting-context";
import { dronesContext } from "./drones-context";
import { inventoryContext } from "./inventory-context";

export type ContextGameReducer = (
  state: GameState,
  action: GameAction,
) => GameState;

/**
 * Applies all implemented Bounded Context reducers to the given state.
 *
 * In Phase 3 this function is NOT wired into the live runtime reducer yet.
 * It is used for testing context composition and verifying slice isolation
 * before the bounded-context reducer becomes the primary implementation path.
 *
 * @param state - Current GameState.
 * @param action - The dispatched GameAction.
 * @returns Partially updated GameState for implemented context slices.
 */
export function applyContextReducers(
  state: GameState,
  action: GameAction,
): GameState {
  let next = state;

  const autoMiner = autoMinerContext.reduce(
    { autoMiners: next.autoMiners },
    action,
  );
  if (autoMiner !== null && autoMiner.autoMiners !== next.autoMiners) {
    next = { ...next, autoMiners: autoMiner.autoMiners };
  }

  const crafting = craftingContext.reduce(
    {
      crafting: next.crafting,
      keepStockByWorkbench: next.keepStockByWorkbench,
      recipeAutomationPolicies: next.recipeAutomationPolicies,
    },
    action,
  );
  if (
    crafting !== null &&
    (crafting.crafting !== next.crafting ||
      crafting.keepStockByWorkbench !== next.keepStockByWorkbench ||
      crafting.recipeAutomationPolicies !== next.recipeAutomationPolicies)
  ) {
    next = { ...next, ...crafting };
  }

  const drones = dronesContext.reduce({ drones: next.drones }, action);
  if (drones !== null && drones.drones !== next.drones) {
    next = { ...next, drones: drones.drones };
  }

  const inventory = inventoryContext.reduce(
    { inventory: next.inventory, network: next.network },
    action,
  );
  if (
    inventory !== null &&
    (inventory.inventory !== next.inventory ||
      inventory.network !== next.network)
  ) {
    next = { ...next, ...inventory };
  }

  return next;
}

/**
 * Creates the Phase 3 bounded-context reducer facade.
 *
 * The returned reducer is intentionally not wired into the live store yet.
 */
export function createGameReducer(): ContextGameReducer {
  return applyContextReducers;
}
