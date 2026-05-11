// ============================================================
// Factory Island - Game State & Logic
// ============================================================

import { applyContextReducers } from "./contexts/create-game-reducer";
import { shadowDiff } from "./contexts/shadow-diff";
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
  const legacyNext = dispatchAction(state, action);

  // Phase 3 Cutover — shadow mode. Bounded contexts run on the pre-action
  // state alongside the legacy dispatcher; mismatches surface as warnings
  // without affecting runtime. Production builds skip the diff entirely.
  if (import.meta.env.DEV) {
    try {
      const contextNext = applyContextReducers(state, action);
      shadowDiff(legacyNext, contextNext, action);
    } catch (err) {
      // eslint-disable-next-line no-console -- DEV shadow-mode diagnostic; never reached in production.
      console.warn(
        `[BoundedContext shadow] applyContextReducers threw for action ${action.type}`,
        err,
      );
    }
  }

  return legacyNext;
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
