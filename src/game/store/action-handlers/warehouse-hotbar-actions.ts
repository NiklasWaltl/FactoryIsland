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

export type { WarehouseHotbarActionDeps } from "./warehouse-hotbar-actions/deps";

// All warehouse-hotbar actions (EQUIP_FROM_WAREHOUSE,
// EQUIP_BUILDING_FROM_WAREHOUSE, TRANSFER_TO_WAREHOUSE,
// TRANSFER_FROM_WAREHOUSE, REMOVE_FROM_HOTBAR) are live-switched via
// applyLiveContextReducers -> warehouseContext. The legacy phase modules
// (warehouse-hotbar-actions/phases/*) remain in the tree for now as
// reference implementations — they are no longer reachable through
// dispatchAction.
export function handleWarehouseHotbarAction(
  _state: GameState,
  _action: GameAction,
  _deps: WarehouseHotbarActionDeps,
): GameState | null {
  return null;
}
