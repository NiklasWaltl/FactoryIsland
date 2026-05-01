import type { ItemId, WarehouseId } from "../items/types";
import type { NetworkSlice } from "../inventory/reservationTypes";
import type { CraftingInventorySource } from "./types";

export const GLOBAL_SOURCE_SCOPE_KEY = "crafting:global";

export type NonGlobalCraftingInventorySource = Exclude<
  CraftingInventorySource,
  { kind: "global" }
>;

export type PhysicalSourceKind = "warehouse" | "hub";

export function getLegacyScopeKeyForSource(
  source: CraftingInventorySource,
): string {
  if (source.kind === "global") return GLOBAL_SOURCE_SCOPE_KEY;
  if (source.kind === "warehouse")
    return `crafting:warehouse:${source.warehouseId}`;
  return `crafting:zone:${source.zoneId}`;
}

export function getSourceScopedScopeKey(
  source: NonGlobalCraftingInventorySource,
  kind: PhysicalSourceKind,
  sourceId: string,
): string {
  return `${getLegacyScopeKeyForSource(source)}:${kind}:${sourceId}`;
}

export function getWarehouseLaneScopeKey(
  source: NonGlobalCraftingInventorySource,
  warehouseId: WarehouseId,
): string {
  return getSourceScopedScopeKey(source, "warehouse", warehouseId);
}

export function getReservedInScope(
  network: NetworkSlice,
  itemId: ItemId,
  scopeKey: string,
  excludeReservationId?: string,
): number {
  let total = 0;
  for (const reservation of network.reservations) {
    if (excludeReservationId && reservation.id === excludeReservationId)
      continue;
    if (reservation.itemId !== itemId) continue;
    if (reservation.scopeKey !== scopeKey) continue;
    total += reservation.amount;
  }
  return total;
}
