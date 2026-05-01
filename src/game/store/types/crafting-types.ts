/** Keep-in-stock target for one workbench recipe. */
export interface KeepStockTargetEntry {
  /** Whether automatic refill is active for this recipe. */
  enabled: boolean;
  /** Desired minimum stock for the recipe output item. */
  amount: number;
}

/** Keep-in-stock config map: workbenchId -> recipeId -> target entry. */
export type KeepStockByWorkbench = Record<
  string,
  Record<string, KeepStockTargetEntry>
>;

// ---- Crafting source (read/write resource scope) ----
//
// Where a crafting device reads/writes resources:
// - "global": state.inventory
// - "warehouse": a specific warehouseInventories[id]
// - "zone": aggregate of zone member warehouses
//
// Resolvers may fall back to global when a warehouse/zone is invalid.
export type CraftingSource =
  | { kind: "global" }
  | { kind: "warehouse"; warehouseId: string }
  | { kind: "zone"; zoneId: string };

/** @deprecated Use CraftingSource */
export type WorkbenchSource = CraftingSource;
