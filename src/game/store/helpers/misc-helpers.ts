// Miscellaneous helper functions and constants, extracted from reducer.ts.
// No logic changes - moved verbatim.

import { resolveBuildingSource } from "../building-source";
import type {
  CraftingSource,
  GameState,
  Inventory,
} from "../types";

export { RESOURCE_1x1_DROP_AMOUNT } from "../constants/resources";
export { getBoostMultiplier } from "./machine-priority";

/**
 * DEV-only: assert no inventory field is negative.
 * Call after reducer transitions to catch silent corruption early.
 */
export function devAssertInventoryNonNegative(label: string, inv: Inventory): void {
  if (!import.meta.env.DEV) return;
  for (const [key, val] of Object.entries(inv)) {
    if ((val as number) < 0) {
      console.error(`[Invariant] ${label}: "${key}" is negative (${val})`);
    }
  }
}

/** @deprecated Use resolveBuildingSource */
export function resolveWorkbenchSource(state: GameState): CraftingSource {
  return resolveBuildingSource(state, state.selectedCraftingBuildingId);
}

/**
 * Manhattan distance between two grid positions.
 */
export function manhattanDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}
