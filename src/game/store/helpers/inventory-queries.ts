import {
  getEffectiveBuildInventory,
  createEmptyInventory,
  COLLECTABLE_KEYS,
} from "../inventory-ops";
import type { CollectableItemType, GameState, Inventory } from "../types";

interface GlobalInventoryInputs {
  readonly inventory: GameState["inventory"];
  readonly warehouseInventories: GameState["warehouseInventories"];
  readonly serviceHubs: GameState["serviceHubs"];
}

interface BuildMenuInventoryInputs {
  readonly serviceHubs: GameState["serviceHubs"];
  readonly collectionNodes: GameState["collectionNodes"];
}

let lastGlobalInventoryInputs: GlobalInventoryInputs | null = null;
let lastGlobalInventoryView: Inventory | null = null;

let lastBuildMenuInventoryInputs: BuildMenuInventoryInputs | null = null;
let lastBuildMenuInventoryView: Inventory | null = null;

/** Read the available amount of a single resource from the global pool. */
export function getAvailableResource(
  state: { inventory: Inventory },
  key: keyof Inventory,
): number {
  return state.inventory[key] as number;
}

/**
 * Phase-1 derived "global inventory" view.
 *
 * SOURCE OF TRUTH for physical resources is now `warehouseInventories` and
 * `serviceHubs[id].inventory`. `state.inventory` continues to back items that
 * have no physical home (coins, tools, building counters, ingots in flight),
 * but for any resource key that also lives in a warehouse or hub, this view
 * is the truthful, summed read-only projection.
 *
 * USE THIS for: HUD display, build-/craft-affordance UI, debug overlays.
 * DO NOT mutate the result - write to the underlying physical stores instead.
 */
export function selectGlobalInventoryView(
  state: Pick<GameState, "inventory" | "warehouseInventories" | "serviceHubs">,
): Inventory {
  const nextInputs: GlobalInventoryInputs = {
    inventory: state.inventory,
    warehouseInventories: state.warehouseInventories,
    serviceHubs: state.serviceHubs,
  };

  if (
    lastGlobalInventoryInputs &&
    lastGlobalInventoryView &&
    lastGlobalInventoryInputs.inventory === nextInputs.inventory &&
    lastGlobalInventoryInputs.warehouseInventories ===
      nextInputs.warehouseInventories &&
    lastGlobalInventoryInputs.serviceHubs === nextInputs.serviceHubs
  ) {
    return lastGlobalInventoryView;
  }

  const nextView = getEffectiveBuildInventory(state);
  lastGlobalInventoryInputs = nextInputs;
  lastGlobalInventoryView = nextView;
  return nextView;
}

/**
 * UI-only build-menu view.
 *
 * Counts only resources that can directly feed the construction flow today:
 *   1. service hub inventories
 *   2. world-bound collection nodes (manual harvest drops)
 *
 * Warehouses and `state.inventory` are intentionally excluded so the build UI
 * reflects construction-accessible stock instead of broad storage totals.
 */
export function selectBuildMenuInventoryView(
  state: Pick<GameState, "serviceHubs" | "collectionNodes">,
): Inventory {
  const nextInputs: BuildMenuInventoryInputs = {
    serviceHubs: state.serviceHubs,
    collectionNodes: state.collectionNodes,
  };

  if (
    lastBuildMenuInventoryInputs &&
    lastBuildMenuInventoryView &&
    lastBuildMenuInventoryInputs.serviceHubs === nextInputs.serviceHubs &&
    lastBuildMenuInventoryInputs.collectionNodes === nextInputs.collectionNodes
  ) {
    return lastBuildMenuInventoryView;
  }

  const effective = createEmptyInventory();

  for (const hub of Object.values(state.serviceHubs)) {
    for (const res of COLLECTABLE_KEYS) {
      const key = res as CollectableItemType;
      effective[key] = (effective[key] as number) + (hub.inventory[key] ?? 0);
    }
  }

  for (const node of Object.values(state.collectionNodes)) {
    if (node.amount <= 0) continue;
    effective[node.itemType] =
      (effective[node.itemType] as number) + node.amount;
  }

  lastBuildMenuInventoryInputs = nextInputs;
  lastBuildMenuInventoryView = effective;

  return effective;
}
