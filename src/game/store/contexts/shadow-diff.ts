// ============================================================
// Phase 3 Cutover: Bounded-Context shadow diff
// ------------------------------------------------------------
// Runs `applyContextReducers` against the legacy reducer output in DEV
// and logs slice-level mismatches via `console.warn`. Never throws,
// never mutates state. Production builds short-circuit before the diff.
// ============================================================

import type { GameAction } from "../game-actions";
import type { GameState } from "../types";

/**
 * GameState slices owned by contexts that do real work (not pure no-ops).
 * Pure cross-slice no-op contexts (warehouse, power, construction, conveyor)
 * are intentionally excluded — they always return their input slice.
 */
export const SHADOW_DIFF_SLICES = [
  "crafting",
  "keepStockByWorkbench",
  "recipeAutomationPolicies",
  "drones",
  "inventory",
  "network",
  "autoMiners",
  "autoSmelters",
  "autoAssemblers",
  "unlockedBuildings",
  "moduleLabJob",
  "moduleFragments",
  "moduleInventory",
  "ship",
  "productionZones",
  "buildingZoneIds",
  "buildingSourceWarehouseIds",
  "hotbarSlots",
  "activeSlot",
  "energyDebugOverlay",
  "lastTickError",
  "notifications",
  "openPanel",
  "buildMode",
  "selectedWarehouseId",
  "selectedAutoMinerId",
  "selectedAutoSmelterId",
  "selectedAutoAssemblerId",
  "selectedGeneratorId",
  "selectedServiceHubId",
  "selectedCraftingBuildingId",
  "selectedSplitterId",
] as const satisfies readonly (keyof GameState)[];

/** Minimal structural deep equality. Handles primitives, arrays, plain objects. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a === null || b === null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(b)) return false;

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Compare slices the contexts claim to own against the legacy output for the
 * same (state, action). Logs warnings for any mismatch — never throws.
 *
 * Callers must gate on `import.meta.env.DEV`; this function does not.
 */
export function shadowDiff(
  legacy: GameState,
  context: GameState,
  action: GameAction,
): void {
  for (const key of SHADOW_DIFF_SLICES) {
    if (!deepEqual(legacy[key], context[key])) {
      // eslint-disable-next-line no-console -- DEV shadow-mode diagnostic; never reached in production.
      console.warn(
        `[BoundedContext shadow] Mismatch on slice "${key}" for action ${action.type}`,
        { legacy: legacy[key], context: context[key] },
      );
    }
  }
}
