// Helper functions extracted from reducer.ts.
// Used by action-handler deps objects and reducer internals.
// No logic changes — moved verbatim from reducer.ts.

import { debugLog } from "../../debug/debugLogger";
import { WAREHOUSE_CAPACITY } from "../constants/buildings/index";
import {
  AUTO_DELIVERY_BATCH_WINDOW_MS,
  AUTO_DELIVERY_LOG_MAX,
} from "../constants/auto/auto-delivery";
import { addNotification } from "../utils/notifications";
import { makeId } from "../utils/make-id";
import {
  tickOneDrone as tickOneDroneExecution,
  type TickOneDroneIoDeps,
} from "../../drones/execution/tick-one-drone";
import type {
  GameMode,
  GameState,
  Inventory,
  PlacedAsset,
  CollectionNode,
  CollectableItemType,
  AutoDeliveryEntry,
  KeepStockByWorkbench,
  RecipeAutomationPolicyMap,
} from "../types";

export function getWarehouseCapacity(mode: GameMode): number {
  return mode === "debug" ? Infinity : WAREHOUSE_CAPACITY;
}

export function getCapacityPerResource(state: {
  mode: string;
  warehousesPlaced: number;
}): number {
  if (state.mode === "debug") return Infinity;
  return (state.warehousesPlaced + 1) * WAREHOUSE_CAPACITY;
}

/**
 * Return a new Inventory with `costs` deducted.
 * DEV: warns if any resulting value becomes negative (indicates a missing hasResources check).
 */
export function consumeResources(
  inv: Inventory,
  costs: Partial<Record<keyof Inventory, number>>,
): Inventory {
  const result = { ...inv } as Record<string, number>;
  for (const [key, amt] of Object.entries(costs)) {
    result[key] = (result[key] ?? 0) - (amt ?? 0);
    if (import.meta.env.DEV && result[key] < 0) {
      // eslint-disable-next-line no-console -- DEV invariant failure should be visible immediately.
      console.warn(
        `[consumeResources] Negative value for "${key}": ${result[key]}. Missing hasResources() guard?`,
      );
    }
  }
  return result as unknown as Inventory;
}

type CraftingBuildingAssetType = "workbench" | "smithy" | "manual_assembler";

function getFirstCraftingAssetOfType(
  state: Pick<GameState, "assets">,
  assetType: CraftingBuildingAssetType,
): PlacedAsset | null {
  return (
    Object.values(state.assets).find((asset) => asset.type === assetType) ??
    null
  );
}

export function logCraftingSelectionComparison(
  state: Pick<GameState, "assets" | "selectedCraftingBuildingId">,
  assetType: CraftingBuildingAssetType,
  selectedId: string | null | undefined = state.selectedCraftingBuildingId,
): void {
  if (!import.meta.env.DEV) return;
  const firstId = getFirstCraftingAssetOfType(state, assetType)?.id ?? "none";
  const resolvedSelectedId = selectedId ?? "none";
  if (resolvedSelectedId === firstId) return;
  const logger = assetType === "smithy" ? debugLog.smithy : debugLog.general;
  logger(
    `Selected: ${assetType}[${resolvedSelectedId}], first would have been [${firstId}]`,
  );
}

/**
 * Add `amount` of `itemType` to a collection node at (tileX, tileY). If a
 * matching node (same tile + same itemType) already exists, merge into it;
 * otherwise spawn a new one. Returns a fresh record — never mutates.
 */
export function addToCollectionNodeAt(
  nodes: Record<string, CollectionNode>,
  itemType: CollectableItemType,
  tileX: number,
  tileY: number,
  amount: number,
): Record<string, CollectionNode> {
  if (amount <= 0) return nodes;
  for (const node of Object.values(nodes)) {
    if (
      node.tileX === tileX &&
      node.tileY === tileY &&
      node.itemType === itemType
    ) {
      return { ...nodes, [node.id]: { ...node, amount: node.amount + amount } };
    }
  }
  const id = makeId("cn");
  return {
    ...nodes,
    [id]: {
      id,
      itemType,
      amount,
      tileX,
      tileY,
      collectable: true,
      createdAt: Date.now(),
      reservedByDroneId: null,
    },
  };
}

/**
 * Appends (or batches into the latest matching entry) one unit delivered to a warehouse.
 * Same sourceId + resource within the batch window → increments amount.
 * Older entries are evicted when the log exceeds AUTO_DELIVERY_LOG_MAX.
 */
export function addAutoDelivery(
  log: AutoDeliveryEntry[],
  sourceType: AutoDeliveryEntry["sourceType"],
  sourceId: string,
  resource: string,
  warehouseId: string,
): AutoDeliveryEntry[] {
  const now = Date.now();
  const lastIdx = log.length - 1;
  const last = lastIdx >= 0 ? log[lastIdx] : null;
  if (
    last &&
    last.sourceId === sourceId &&
    last.resource === resource &&
    now - last.timestamp <= AUTO_DELIVERY_BATCH_WINDOW_MS
  ) {
    return [
      ...log.slice(0, lastIdx),
      { ...last, amount: last.amount + 1, timestamp: now },
    ];
  }
  const entry: AutoDeliveryEntry = {
    id: makeId(),
    sourceType,
    sourceId,
    resource,
    amount: 1,
    warehouseId,
    timestamp: now,
  };
  return log.length >= AUTO_DELIVERY_LOG_MAX
    ? [...log.slice(1), entry]
    : [...log, entry];
}

/**
 * Tick one drone (identified by droneId) through its state machine for one step.
 * Reads from state.drones[droneId]; writes back via applyDroneUpdate.
 * All other game-state fields (collectionNodes, serviceHubs, …) are updated in place.
 */
const TICK_ONE_DRONE_IO_DEPS: TickOneDroneIoDeps = {
  makeId,
  addNotification,
  debugLog,
};

export function tickOneDrone(state: GameState, droneId: string): GameState {
  return tickOneDroneExecution(state, droneId, TICK_ONE_DRONE_IO_DEPS);
}

export function getKeepStockByWorkbench(
  state: Pick<GameState, "keepStockByWorkbench">,
): KeepStockByWorkbench {
  return state.keepStockByWorkbench ?? {};
}

export function getRecipeAutomationPolicies(
  state: Pick<GameState, "recipeAutomationPolicies">,
): RecipeAutomationPolicyMap {
  return state.recipeAutomationPolicies ?? {};
}
