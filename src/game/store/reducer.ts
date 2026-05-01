// ============================================================
// Factory Island - Game State & Logic
// ============================================================

import { dispatchAction } from "./game-reducer-dispatch";
import { devAssertInventoryNonNegative } from "./helpers/misc-helpers";
import type { GameState } from "./types";
import type { GameAction } from "./game-actions";

// ============================================================
// INITIAL STATE
// ============================================================

export { createInitialState } from "./initial-state";

// ============================================================
// ACTIONS
// ============================================================

export type { GameAction };

// ============================================================
// DISPATCHER
// ------------------------------------------------------------
// The dispatch chain itself lives in ./game-reducer-dispatch.
// `gameReducer` here is a thin entry-point so that tooling, tests
// and external consumers keep importing it from "../store/reducer".
// ============================================================
export function gameReducer(state: GameState, action: GameAction): GameState {
  return dispatchAction(state, action);
}

/** Wraps the core reducer with dev-mode invariant assertions. */
export function gameReducerWithInvariants(
  state: GameState,
  action: GameAction,
): GameState {
  const next = gameReducer(state, action);
  if (import.meta.env.DEV && next !== state) {
    devAssertInventoryNonNegative("state.inventory", next.inventory);
    for (const [whId, whInv] of Object.entries(next.warehouseInventories)) {
      devAssertInventoryNonNegative(`warehouseInventories[${whId}]`, whInv);
    }
  }
  return next;
}

// Public API barrel: pure `export ... from` lines extracted to ./reducer-public-api.
// Placed at end-of-file so explicit local exports above take precedence in CJS init order.
export * from "./reducer-public-api";
