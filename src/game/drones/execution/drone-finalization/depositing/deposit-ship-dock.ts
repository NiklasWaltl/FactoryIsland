import {
  addResources,
  createEmptyInventory,
} from "../../../../store/inventory-ops";
import { getWarehouseCapacity } from "../../../../store/warehouse-capacity";
import { applyDroneUpdate } from "../../../utils/drone-state-helpers";
import type { GameState } from "../../../../store/types";
import type {
  BuildingSupplyDepositOutcome,
  ShipDockDepositContext,
} from "./types";

export function depositShipDock(
  state: GameState,
  droneId: string,
  context: ShipDockDepositContext,
): BuildingSupplyDepositOutcome {
  const { deliveryId, idleDrone, cargo, deps } = context;
  const { itemType, amount } = cargo;
  const { debugLog } = deps;

  const targetAsset = state.assets[deliveryId];
  if (targetAsset?.isDockWarehouse !== true) {
    return { handled: false, outcome: "not_deposited" };
  }
  if (
    state.ship.status !== "docked" ||
    state.ship.activeQuest?.itemId !== itemType
  ) {
    return { handled: false, outcome: "not_deposited" };
  }

  const currentInv =
    state.warehouseInventories[deliveryId] ?? createEmptyInventory();
  const current = currentInv[itemType] ?? 0;
  const remainingQuestNeed = Math.max(
    0,
    (state.ship.activeQuest?.amount ?? 0) - current,
  );
  const remainingWarehouseSpace = Math.max(
    0,
    getWarehouseCapacity(state.mode) - current,
  );
  if (remainingQuestNeed <= 0 || remainingWarehouseSpace <= 0) {
    return { handled: false, outcome: "not_deposited" };
  }
  const applied = Math.min(amount, remainingQuestNeed, remainingWarehouseSpace);
  const leftover = amount - applied;
  const newWarehouseInventories =
    applied > 0
      ? {
          ...state.warehouseInventories,
          [deliveryId]: {
            ...currentInv,
            [itemType]: current + applied,
          },
        }
      : state.warehouseInventories;
  const newInv =
    leftover > 0
      ? addResources(state.inventory, { [itemType]: leftover })
      : state.inventory;
  debugLog.inventory(
    `Drone deposited ${applied}× ${itemType} into dock warehouse ${deliveryId}` +
      (leftover > 0 ? ` (${leftover} overflow → global)` : ""),
  );
  const nextState = applyDroneUpdate(
    {
      ...state,
      inventory: newInv,
      warehouseInventories: newWarehouseInventories,
    },
    droneId,
    idleDrone,
  );
  return { handled: true, outcome: "deposited", nextState };
}
