// ============================================================
// Main dispatch chain for the game reducer.
// ------------------------------------------------------------
// `dispatchAction` is structured as an early-return dispatch chain
// over action-handler clusters under ./action-handlers/*. Each
// `handle...Action(state, action, deps?)` returns either the next
// state (action belonged to its cluster) or `null` (fall through).
//
// As of 2026-05-16 the inline `switch` has no active cases left —
// ENERGY_NET_TICK was the last and is now live-switched via
// applyLiveContextReducers in contexts/create-game-reducer.ts.
// All cases are documented inline below via
// `// <ACTION> is handled above by handle<Cluster>Action` markers so the
// action surface remains greppable from this file. The dispatcher is
// effectively empty and will be removed with the full cutover.
//
// IMPORTANT: This module must NOT import from ./reducer to avoid an
// ESM initialization cycle (reducer.ts imports this file).
// ============================================================

/**
 * @deprecated
 * This file is the legacy monolithic dispatch router. Domain logic is being
 * migrated to Bounded Contexts under `src/game/store/contexts/`.
 *
 * Migration guide: `docs/bounded-context-state-management-prd.md`
 *
 * Do NOT add new action handlers here. Add them to the relevant context file.
 * This file will remain functional until the cutover in Phase 3.
 */

import type { GameState } from "./types";
import type { GameAction } from "./game-actions";

// runEnergyNetTick import removed with ENERGY_NET_TICK live-switch
// migration (2026-05-16). Restore alongside the commented case below
// only if the cutover is reverted.

import {
  CRAFTING_QUEUE_ACTION_DEPS,
  CLICK_CELL_ACTION_DEPS,
  MACHINE_ACTION_DEPS,
  WAREHOUSE_HOTBAR_ACTION_DEPS,
  MANUAL_ASSEMBLER_ACTION_DEPS,
  BUILDING_PLACEMENT_IO_DEPS,
  BUILDING_SITE_ACTION_DEPS,
  FLOOR_PLACEMENT_ACTION_DEPS,
  SHOP_ACTION_DEPS,
  DRONE_ASSIGNMENT_ACTION_DEPS,
  DRONE_ROLE_ACTION_DEPS,
  DRONE_TICK_ACTION_DEPS,
  LOGISTICS_TICK_IO_DEPS,
} from "./action-handler-deps";

import { handleCraftingQueueAction } from "./action-handlers/crafting-queue-actions";
import { handleZoneAction } from "./action-handlers/zone-actions";
import { handleUiAction } from "./action-handlers/ui-actions";
import { handleBuildingPlacementAction } from "./action-handlers/building-placement";
import { handleBuildingSiteAction } from "./action-handlers/building-site";
import { handleMachineAction } from "./action-handlers/machine-actions";
import { handleClickCellAction } from "./action-handlers/click-cell";
import { handleWarehouseHotbarAction } from "./action-handlers/warehouse-hotbar-actions";
import { handleManualAssemblerAction } from "./action-handlers/manual-assembler-actions";
import { handleFloorPlacementAction } from "./action-handlers/floor-placement";
import { handleShopAction } from "./action-handlers/shop";
import { handleResearchAction } from "./action-handlers/research";
import { handleCoinAction } from "./action-handlers/coin-actions";
import { handleModuleFragmentAction } from "./action-handlers/module-fragment-actions";
import { handleModuleLabAction } from "./action-handlers/module-lab-actions";
import { handleMachineConfigAction } from "./action-handlers/machine-config";
import { handleBuildModeAction } from "./action-handlers/build-mode-actions";
import { handleMaintenanceAction } from "./action-handlers/maintenance-actions";
import { handleGrowthAction } from "./action-handlers/growth-actions";
import { handleHubTargetAction } from "./action-handlers/hub-target-actions";
import { handleAutoSmelterAction } from "./action-handlers/auto-smelter-actions";
import { handleAutoAssemblerAction } from "./action-handlers/auto-assembler-actions";
import { handleDroneRoleAction } from "./action-handlers/drone-role-actions";
import { handleDroneTickAction } from "./action-handlers/drone-tick-actions";
import { handleDroneAssignmentAction } from "./action-handlers/drone-assignment";
import { handleLogisticsTickAction } from "./action-handlers/logistics-tick";
import { handleShipAction } from "./action-handlers/ship-actions";

export function dispatchAction(
  state: GameState,
  action: GameAction,
): GameState {
  const craftingQueueResult = handleCraftingQueueAction(
    state,
    action,
    CRAFTING_QUEUE_ACTION_DEPS,
  );
  if (craftingQueueResult !== null) return craftingQueueResult;
  const zoneResult = handleZoneAction(state, action);
  if (zoneResult !== null) return zoneResult;
  const uiResult = handleUiAction(state, action);
  if (uiResult !== null) return uiResult;
  const buildingPlacementResult = handleBuildingPlacementAction(
    state,
    action,
    BUILDING_PLACEMENT_IO_DEPS,
  );
  if (buildingPlacementResult !== null) return buildingPlacementResult;
  const buildingSiteResult = handleBuildingSiteAction(
    state,
    action,
    BUILDING_SITE_ACTION_DEPS,
  );
  if (buildingSiteResult !== null) return buildingSiteResult;
  const machineResult = handleMachineAction(state, action, MACHINE_ACTION_DEPS);
  if (machineResult !== null) return machineResult;
  const warehouseHotbarResult = handleWarehouseHotbarAction(
    state,
    action,
    WAREHOUSE_HOTBAR_ACTION_DEPS,
  );
  if (warehouseHotbarResult !== null) return warehouseHotbarResult;
  const manualAssemblerResult = handleManualAssemblerAction(
    state,
    action,
    MANUAL_ASSEMBLER_ACTION_DEPS,
  );
  if (manualAssemblerResult !== null) return manualAssemblerResult;
  const floorPlacementResult = handleFloorPlacementAction(
    state,
    action,
    FLOOR_PLACEMENT_ACTION_DEPS,
  );
  if (floorPlacementResult !== null) return floorPlacementResult;
  const shopResult = handleShopAction(state, action, SHOP_ACTION_DEPS);
  if (shopResult !== null) return shopResult;
  const researchResult = handleResearchAction(state, action);
  if (researchResult !== null) return researchResult;
  const coinResult = handleCoinAction(state, action);
  if (coinResult !== null) return coinResult;
  const moduleFragmentResult = handleModuleFragmentAction(state, action);
  if (moduleFragmentResult !== null) return moduleFragmentResult;
  const moduleLabResult = handleModuleLabAction(state, action);
  if (moduleLabResult !== null) return moduleLabResult;
  const machineConfigResult = handleMachineConfigAction(state, action);
  if (machineConfigResult !== null) return machineConfigResult;
  const buildModeResult = handleBuildModeAction(state, action);
  if (buildModeResult !== null) return buildModeResult;
  const maintenanceResult = handleMaintenanceAction(state, action);
  if (maintenanceResult !== null) return maintenanceResult;
  const growthResult = handleGrowthAction(state, action);
  if (growthResult !== null) return growthResult;
  const hubTargetResult = handleHubTargetAction(state, action);
  if (hubTargetResult !== null) return hubTargetResult;
  const autoSmelterResult = handleAutoSmelterAction(state, action);
  if (autoSmelterResult !== null) return autoSmelterResult;
  const autoAssemblerResult = handleAutoAssemblerAction(state, action);
  if (autoAssemblerResult !== null) return autoAssemblerResult;
  const droneRoleResult = handleDroneRoleAction(
    state,
    action,
    DRONE_ROLE_ACTION_DEPS,
  );
  if (droneRoleResult !== null) return droneRoleResult;
  const droneTickResult = handleDroneTickAction(
    state,
    action,
    DRONE_TICK_ACTION_DEPS,
  );
  if (droneTickResult !== null) return droneTickResult;
  const droneAssignmentResult = handleDroneAssignmentAction(
    state,
    action,
    DRONE_ASSIGNMENT_ACTION_DEPS,
  );
  if (droneAssignmentResult !== null) return droneAssignmentResult;
  const clickCellResult = handleClickCellAction(
    state,
    action,
    CLICK_CELL_ACTION_DEPS,
  );
  if (clickCellResult !== null) return clickCellResult;
  const logisticsTickResult =
    action.type === "LOGISTICS_TICK"
      ? handleLogisticsTickAction(state, LOGISTICS_TICK_IO_DEPS)
      : null;
  if (logisticsTickResult !== null) return logisticsTickResult;
  const shipResult = handleShipAction(state, action);
  if (shipResult !== null) return shipResult;
  // All inline cases have been migrated to dedicated handlers or to the
  // live-switched bounded contexts. The switch below contains only marker
  // comments documenting where each action is handled. It falls through to
  // `return state` for any action that none of the cluster handlers above
  // claimed — which is correct since every reachable action is now claimed
  // by either a handle*Action above or by applyLiveContextReducers.
  switch (action.type) {
    // NETWORK_*, CRAFT_REQUEST_WITH_PREREQUISITES, JOB_*,
    // SET_KEEP_STOCK_TARGET and SET_RECIPE_AUTOMATION_POLICY are handled
    // above by handleCraftingQueueAction
    // (see action-handlers/crafting-queue-actions/index.ts).

    // CLICK_CELL is handled above by
    // handleClickCellAction (see action-handlers/click-cell.ts).

    // SET_ACTIVE_SLOT is handled above by
    // handleUiAction (see action-handlers/ui-actions.ts).

    // BUY_MAP_SHOP_ITEM is handled above by
    // handleShopAction (see action-handlers/shop.ts).

    // BUY_FRAGMENT is handled above by
    // handleCoinAction (see action-handlers/coin-actions.ts).

    // COLLECT_FRAGMENT is handled above by
    // handleModuleFragmentAction (see action-handlers/module-fragment-actions.ts).

    // CRAFT_WORKBENCH, REMOVE_BUILDING, EXPIRE_NOTIFICATIONS,
    // DEBUG_SET_STATE and REMOVE_POWER_POLE are handled above by
    // handleMaintenanceAction (see action-handlers/maintenance-actions/index.ts).

    // TOGGLE_PANEL and CLOSE_PANEL are handled above by
    // handleUiAction (see action-handlers/ui-actions.ts).

    // GROW_SAPLING, GROW_SAPLINGS and NATURAL_SPAWN are handled above by
    // handleGrowthAction (see action-handlers/growth-actions/index.ts).

    // ENERGY_NET_TICK is live-switched via applyLiveContextReducers in
    // contexts/create-game-reducer.ts (wrapper around runEnergyNetTick).
    // Migrated 2026-05-16. The legacy case is left here as a comment
    // until the full cutover removes game-reducer-dispatch.ts entirely.
    // case "ENERGY_NET_TICK": {
    //   return runEnergyNetTick(state);
    // }

    // AUTO_SMELTER_SET_RECIPE is handled above by
    // handleAutoSmelterAction (see action-handlers/auto-smelter-actions/index.ts).
    // AUTO_ASSEMBLER_SET_RECIPE is handled above by handleAutoAssemblerAction.

    // TOGGLE_BUILD_MODE, SELECT_BUILD_BUILDING and SELECT_BUILD_FLOOR_TILE
    // are handled above by handleBuildModeAction
    // (see action-handlers/build-mode-actions/index.ts).

    // BUILD_PLACE_BUILDING and BUILD_REMOVE_ASSET are handled above by
    // handleBuildingPlacementAction (see action-handlers/building-placement.ts).

    // BUILD_PLACE_FLOOR_TILE is handled above by
    // handleFloorPlacementAction (see action-handlers/floor-placement.ts).

    // LOGISTICS_TICK is handled above by
    // handleLogisticsTickAction (see action-handlers/logistics-tick.ts).

    // TOGGLE_ENERGY_DEBUG is handled above by
    // handleUiAction (see action-handlers/ui-actions.ts).

    // SET_MACHINE_PRIORITY and SET_MACHINE_BOOST are handled above by
    // handleMachineConfigAction (see action-handlers/machine-config.ts).

    // SET_BUILDING_SOURCE and UPGRADE_HUB are handled above by
    // handleBuildingSiteAction (see action-handlers/building-site.ts).

    // SET_KEEP_STOCK_TARGET and SET_RECIPE_AUTOMATION_POLICY are handled
    // above by handleCraftingQueueAction
    // (see action-handlers/crafting-queue-actions/index.ts).

    // CREATE_ZONE, DELETE_ZONE and SET_BUILDING_ZONE are handled above by
    // handleZoneAction (see action-handlers/zone-actions.ts).

    // SET_HUB_TARGET_STOCK is handled above by
    // handleHubTargetAction (see action-handlers/hub-target-actions/index.ts).

    // ASSIGN_DRONE_TO_HUB is handled above by
    // handleDroneAssignmentAction (see action-handlers/drone-assignment.ts).

    // DRONE_SET_ROLE is handled above by
    // handleDroneRoleAction (see action-handlers/drone-role-actions/index.ts).

    // DRONE_TICK is handled above by
    // handleDroneTickAction (see action-handlers/drone-tick-actions/index.ts).

    // SHIP_TICK, SHIP_DOCK, SHIP_DEPART and SHIP_RETURN are handled above by
    // handleShipAction (see action-handlers/ship-actions.ts).

    default:
      return state;
  }
}
