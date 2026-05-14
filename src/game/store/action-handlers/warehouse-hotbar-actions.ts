// ============================================================
// Warehouse + hotbar action handler
// ------------------------------------------------------------
// Extracts warehouse-panel equip/transfer branches:
// - EQUIP_FROM_WAREHOUSE
// - EQUIP_BUILDING_FROM_WAREHOUSE
// - TRANSFER_TO_WAREHOUSE
// - TRANSFER_FROM_WAREHOUSE
// ============================================================

import type { GameAction } from "../game-actions";
import type { GameState } from "../types";
import type { WarehouseHotbarActionDeps } from "./warehouse-hotbar-actions/deps";
import {
  runHotbarEquipPhase,
  runHotbarRemovePhase,
} from "./warehouse-hotbar-actions/phases";

export type { WarehouseHotbarActionDeps } from "./warehouse-hotbar-actions/deps";

export function handleWarehouseHotbarAction(
  state: GameState,
  action: GameAction,
  deps: WarehouseHotbarActionDeps,
): GameState | null {
  switch (action.type) {
    case "EQUIP_BUILDING_FROM_WAREHOUSE":
    case "EQUIP_FROM_WAREHOUSE": {
      return runHotbarEquipPhase({ state, action, deps });
    }

    // TRANSFER_TO_WAREHOUSE and TRANSFER_FROM_WAREHOUSE are handled live by
    // warehouseContext. The isUnderConstruction guard runs in
    // applyLiveContextReducers, since constructionSites is outside
    // WarehouseContextState.
    // case "TRANSFER_TO_WAREHOUSE":
    // case "TRANSFER_FROM_WAREHOUSE": {
    //   return runHotbarTransferPhase({ state, action, deps });
    // }

    case "REMOVE_FROM_HOTBAR": {
      return runHotbarRemovePhase({ state, action, deps });
    }

    default:
      return null;
  }
}
