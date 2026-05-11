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

/**
 * Slices whose context reducer treats a given action as a cross-slice no-op
 * (returns `state`) while the legacy reducer legitimately mutates them.
 * Comparing those pairs always mismatches and floods DEV with warnings, so
 * we skip them here.
 *
 * Applies to ticks the bounded contexts cannot replicate in isolation because
 * the legacy handlers need cross-slice reads beyond the context's owned slices
 * (assets / hubs / warehouses / crafting / etc.).
 */
const SHADOW_DIFF_EXPECTED_DIVERGENCES: Partial<
  Record<GameAction["type"], readonly (keyof GameState)[]>
> = {
  LOGISTICS_TICK: ["autoMiners", "autoSmelters", "autoAssemblers", "inventory"],
  SHIP_TICK: ["ship"],
  DRONE_TICK: ["drones", "autoAssemblers"],
  ASSIGN_DRONE_TO_HUB: ["drones"],
  // Placement is inherently cross-slice: it reads assets/cellMap/tileMap to
  // validate position and resolve the deposit/warehouse, and writes to many
  // slices that the single-slice machine/drone/inventory contexts cannot
  // initialize in isolation. Same cross-slice pattern as SHIP_DEPART /
  // BUY_FRAGMENT / COLLECT_FRAGMENT.
  //  - autoMiners/autoSmelters/autoAssemblers: machine placement requires
  //    reading assets/cellMap to resolve deposits/footprints.
  //  - drones: direct service_hub placement spawns the first drone.
  //  - inventory: non-construction-site placements consume build costs.
  //  - buildingSourceWarehouseIds: auto-assigns nearest warehouse for
  //    crafting buildings (needs assets to find warehouse positions).
  BUILD_PLACE_BUILDING: [
    "autoMiners",
    "autoSmelters",
    "autoAssemblers",
    "drones",
    "inventory",
    "buildingSourceWarehouseIds",
  ],
  // CLICK_CELL routes through tryTogglePanelFromAsset, which reads assets /
  // cellMap / constructionSites to decide which panel + selected-id to set.
  // UI context cannot replicate those cross-slice reads in isolation, so the
  // legacy path legitimately writes openPanel and the selected-* fields here.
  CLICK_CELL: [
    "openPanel",
    "selectedWarehouseId",
    "selectedAutoMinerId",
    "selectedAutoSmelterId",
    "selectedAutoAssemblerId",
    "selectedGeneratorId",
    "selectedServiceHubId",
    "selectedCraftingBuildingId",
    "selectedSplitterId",
  ],
  // DEBUG_SET_STATE replaces the entire GameState from the debug panel.
  // No bounded context handles it, so every owned slice legitimately
  // diverges. Suppress diffing against the full owned-slice list.
  DEBUG_SET_STATE: SHADOW_DIFF_SLICES,
  // BUY_FRAGMENT writes to inventory (coins), warehouseInventories (dock),
  // and ship (shipsSinceLastFragment) — cross-slice action that no single
  // context can own in isolation. warehouseInventories is not in
  // SHADOW_DIFF_SLICES so only the tracked slices need entries.
  BUY_FRAGMENT: ["inventory", "ship"],
  // COLLECT_FRAGMENT writes to warehouseInventories (dock) and
  // moduleFragments — cross-slice, no single context owns both.
  COLLECT_FRAGMENT: ["moduleFragments"],
  // BUY_MAP_SHOP_ITEM writes inventory, hotbarSlots, and notifications —
  // cross-slice, no single context owns all three.
  BUY_MAP_SHOP_ITEM: ["inventory", "hotbarSlots", "notifications"],
  // SHIP_DEPART reads warehouseInventories[DOCK] to compute quest-delivery
  // multiplier, then writes ship (status/returnsAt/pendingMultiplier/etc.)
  // AND clears warehouseInventories[DOCK]. ship-context only owns `ship`,
  // so it cannot read warehouseInventories to compute the multiplier —
  // same cross-slice pattern as SHIP_TICK, BUY_FRAGMENT, COLLECT_FRAGMENT.
  SHIP_DEPART: ["ship"],
  // SHIP_RETURN writes ship + inventory + moduleInventory + notifications
  // and reads warehouseInventories for reward computation — same cross-slice
  // pattern as SHIP_DEPART / SHIP_TICK. Only "ship" is in SHADOW_DIFF_SLICES
  // so only that slice needs the entry; others are not tracked.
  SHIP_RETURN: ["ship"],
};

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
  const skip = SHADOW_DIFF_EXPECTED_DIVERGENCES[action.type];
  for (const key of SHADOW_DIFF_SLICES) {
    if (skip?.includes(key)) continue;
    if (!deepEqual(legacy[key], context[key])) {
      // eslint-disable-next-line no-console -- DEV shadow-mode diagnostic; never reached in production.
      console.warn(
        `[BoundedContext shadow] Mismatch on slice "${key}" for action ${action.type}`,
        { legacy: legacy[key], context: context[key] },
      );
    }
  }
}
