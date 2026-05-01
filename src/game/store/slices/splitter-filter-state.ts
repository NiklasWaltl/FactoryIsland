// ============================================================
// Splitter per-output filter state (Variante B: lives in GameState).
// ------------------------------------------------------------
// Per splitter asset ID, each output side ("left" / "right") may carry an
// optional ConveyorItem filter. `null` = no filter (Round-Robin only).
//
// State shape lives in GameState.splitterFilterState. The reducer-case
// SET_SPLITTER_FILTER applies pure updates via setSplitterFilter; this
// module is import-cycle-safe (no reducer / no game-actions imports).
// ============================================================

import type { ConveyorItem } from "../types/conveyor-types";

export type SplitterOutputSide = "left" | "right";

export type SplitterFilterEntry = {
  left: ConveyorItem | null;
  right: ConveyorItem | null;
};

export type SplitterFilterState = Record<string, SplitterFilterEntry>;

export const initialSplitterFilterState: SplitterFilterState = {};

/**
 * Read the filter for a specific (splitterId, side). Returns `null` if no
 * filter is set or if the splitter has no entry yet.
 */
export function getSplitterFilter(
  state: SplitterFilterState,
  splitterId: string,
  side: SplitterOutputSide,
): ConveyorItem | null {
  return state[splitterId]?.[side] ?? null;
}

/**
 * Pure update: returns a new SplitterFilterState with the given side updated.
 * Missing splitter entries are initialized with both sides null.
 */
export function setSplitterFilter(
  state: SplitterFilterState,
  splitterId: string,
  side: SplitterOutputSide,
  itemType: ConveyorItem | null,
): SplitterFilterState {
  const prev = state[splitterId] ?? { left: null, right: null };
  return {
    ...state,
    [splitterId]: { ...prev, [side]: itemType },
  };
}

/** Drop the entry for a splitter (used when the asset is removed). */
export function removeSplitterFilter(
  state: SplitterFilterState,
  splitterId: string,
): SplitterFilterState {
  if (!(splitterId in state)) return state;
  const next = { ...state };
  delete next[splitterId];
  return next;
}
