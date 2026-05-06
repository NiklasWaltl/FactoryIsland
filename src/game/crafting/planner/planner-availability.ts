import type { ItemId, WarehouseId } from "../../items/types";
import {
  getLegacyScopeKeyForSource,
  getReservedInScope,
  getWarehouseLaneScopeKey,
} from "../scope-keys";
import { pickCraftingPhysicalSourceForIngredient } from "../tick";
import type { PlannerState } from "./planner-types";

export function getWarehouseLaneAvailability(
  planner: PlannerState,
  itemId: ItemId,
  warehouseId: WarehouseId,
): { stored: number; reserved: number; free: number } {
  const inv = planner.warehouseInventories[warehouseId];
  const stored =
    ((inv ?? {}) as unknown as Record<string, number>)[itemId] ?? 0;
  const legacyScope = getLegacyScopeKeyForSource(planner.source);
  const laneScope = getWarehouseLaneScopeKey(planner.source, warehouseId);
  const reserved =
    getReservedInScope(planner.network, itemId, legacyScope) +
    getReservedInScope(planner.network, itemId, laneScope);
  const free = Math.max(0, stored - reserved);
  return { stored, reserved, free };
}

function consumeFromWarehouse(
  planner: PlannerState,
  warehouseId: WarehouseId,
  itemId: ItemId,
  amount: number,
): void {
  if (amount <= 0) return;
  const current = planner.warehouseInventories[warehouseId];
  if (!current) return;
  const rec = current as unknown as Record<string, number>;
  planner.warehouseInventories[warehouseId] = {
    ...current,
    [itemId]: Math.max(0, (rec[itemId] ?? 0) - amount),
  };
}

function consumeFromHub(
  planner: PlannerState,
  hubId: string,
  itemId: ItemId,
  amount: number,
): void {
  if (amount <= 0) return;
  const hub = planner.serviceHubs[hubId];
  if (!hub) return;
  const inventory = hub.inventory as Record<string, number>;
  planner.serviceHubs[hubId] = {
    ...hub,
    inventory: {
      ...hub.inventory,
      [itemId]: Math.max(0, (inventory[itemId] ?? 0) - amount),
    },
  };
}

export function consumeIngredientIfAvailable(
  planner: PlannerState,
  itemId: ItemId,
  required: number,
):
  | { ok: true }
  | {
      ok: false;
      decision: ReturnType<typeof pickCraftingPhysicalSourceForIngredient>;
    } {
  const decision = pickCraftingPhysicalSourceForIngredient({
    source: planner.source,
    itemId,
    required,
    warehouseInventories: planner.warehouseInventories,
    serviceHubs: planner.serviceHubs,
    network: planner.network,
    assets: planner.assets,
    preferredFromAssetId: planner.producerAssetId,
  });

  if (!decision.source) {
    return { ok: false, decision };
  }

  if (decision.source.kind === "warehouse") {
    consumeFromWarehouse(
      planner,
      decision.source.warehouseId,
      itemId,
      required,
    );
  } else {
    consumeFromHub(planner, decision.source.hubId, itemId, required);
  }

  return { ok: true };
}
