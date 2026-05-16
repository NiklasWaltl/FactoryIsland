// ============================================================
// Crafting / Queue action handler
// ------------------------------------------------------------
// Handles:     NETWORK_RESERVE_BATCH, NETWORK_COMMIT_RESERVATION,
//              NETWORK_COMMIT_BY_OWNER, NETWORK_CANCEL_RESERVATION,
//              NETWORK_CANCEL_BY_OWNER, CRAFT_REQUEST_WITH_PREREQUISITES,
//              JOB_ENQUEUE, JOB_CANCEL, JOB_PAUSE, JOB_MOVE,
//              JOB_SET_PRIORITY,
//              JOB_TICK, SET_KEEP_STOCK_TARGET, SET_RECIPE_AUTOMATION_POLICY
// Reads:       state.crafting, state.network, state.warehouseInventories,
//              state.inventory, state.assets, state.serviceHubs,
//              state.keepStockByWorkbench, state.recipeAutomationPolicies
// Writes:      state.crafting, state.network, physical inventories
//              (warehouseInventories / inventory / serviceHubs)
//              on commit, state.keepStockByWorkbench,
//              state.recipeAutomationPolicies
// Depends on:  ./phases (6 phase modules), ./deps (reducer-internal
//              helpers injected to avoid ESM cycle with reducer.ts)
// Notes:       JOB_TICK is split into Planning + Execution
//              (see ../../crafting/tickPhases.ts). Only the
//              Planning phase is allowed to enqueue new jobs.
//              Largest cluster — see crafting/README.md for the
//              job-lifecycle overview.
// ============================================================

import type { GameState } from "../../types";
import type { GameAction } from "../../game-actions";
import type { CraftingQueueActionDeps } from "./deps";
import { invalidateRoutingIndexCache } from "../../helpers/routing-index-cache";
import { HANDLED_ACTION_TYPES, type CraftingQueueHandledAction } from "./types";
// runQueueManagementPhase — JOB_TICK was the last case using this in
// the legacy dispatch path; it is now live-switched in
// contexts/create-game-reducer.ts (Option B direct wrapper calling
// applyPlanningTriggers + applyExecutionTick inline, 2026-05-17). The
// phase function stays exported from ./phases for the queue-management
// cases JOB_CANCEL / JOB_PAUSE / JOB_MOVE / JOB_SET_PRIORITY, which
// route through craftingContext.
// import { runQueueManagementPhase } from "./phases";

export type { CraftingQueueActionDeps } from "./deps";

export function isCraftingQueueAction(
  action: GameAction,
): action is CraftingQueueHandledAction {
  return HANDLED_ACTION_TYPES.has(action.type);
}

function invalidateIfCraftingChanged(
  previousState: GameState,
  nextState: GameState,
): GameState {
  if (nextState.crafting === previousState.crafting) return nextState;
  return getRoutingRelevantCraftingSignature(nextState) ===
    getRoutingRelevantCraftingSignature(previousState)
    ? nextState
    : invalidateRoutingIndexCache(nextState);
}

function getRoutingRelevantCraftingSignature(state: GameState): string {
  return state.crafting.jobs
    .filter((job) => job.status !== "done" && job.status !== "cancelled")
    .map((job) => {
      const ingredients = job.ingredients
        .map((ingredient) => `${ingredient.itemId}:${ingredient.count}`)
        .join(",");
      return `${job.id}:${job.workbenchId}:${job.status}:${ingredients}`;
    })
    .join("|");
}

/**
 * Handles all crafting/queue cluster actions. Returns the next state
 * if the action belongs to this cluster, or `null` to signal the
 * reducer should fall through to its remaining switch cases.
 */
export function handleCraftingQueueAction(
  state: GameState,
  action: GameAction,
  deps: CraftingQueueActionDeps,
): GameState | null {
  switch (action.type) {
    // -----------------------------------------------------------------
    // Inventory-network reservations (Step 2)
    // -----------------------------------------------------------------
    // All NETWORK_* actions are live-switched via applyLiveContextReducers
    // -> inventoryContext. The invalidateIfCraftingChanged wrapper is
    // intentionally dropped for COMMIT_*: COMMIT does not mutate
    // state.crafting, so the wrapper was always a no-op for these cases
    // (asserted by shadow-diff.test.ts legacy parity checks).
    // case "NETWORK_RESERVE_BATCH":
    // case "NETWORK_COMMIT_RESERVATION":
    // case "NETWORK_COMMIT_BY_OWNER":
    // case "NETWORK_CANCEL_RESERVATION":
    // case "NETWORK_CANCEL_BY_OWNER":
    //   return invalidateIfCraftingChanged(
    //     state,
    //     runNetworkReservationsPhase({ state, action }),
    //   );

    // -----------------------------------------------------------------
    // Crafting jobs (Step 3)
    // -----------------------------------------------------------------
    // case "CRAFT_REQUEST_WITH_PREREQUISITES":
    // live-switched via applyLiveContextReducers -> craftingContext.

    // case "JOB_ENQUEUE":
    // live-switched via applyLiveContextReducers -> craftingContext.

    // case "JOB_CANCEL":
    // live-switched via applyLiveContextReducers -> craftingContext.
    // case "JOB_MOVE":
    // live-switched via applyLiveContextReducers -> craftingContext.
    // case "JOB_SET_PRIORITY":
    // live-switched via applyLiveContextReducers -> craftingContext.
    // case "JOB_PAUSE":
    // live-switched via applyLiveContextReducers -> craftingContext.

    // case "JOB_TICK":
    // live-switched via applyLiveContextReducers -> direct wrapper
    // (2026-05-17). applyPlanningTriggers + applyExecutionTick are
    // called inline there because applyExecutionTick writes
    // state.inventory, which is outside CraftingContextState — the
    // bounded-context reduce path cannot own JOB_TICK without
    // slice-widening. Same Option-B pattern as DRONE_TICK /
    // LOGISTICS_TICK.

    // case "SET_KEEP_STOCK_TARGET":
    // live-switched via applyLiveContextReducers -> craftingContext.

    // case "SET_RECIPE_AUTOMATION_POLICY":
    // live-switched via applyLiveContextReducers -> craftingContext.

    default:
      return null;
  }
}
