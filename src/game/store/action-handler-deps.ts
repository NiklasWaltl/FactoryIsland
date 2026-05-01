// Dependency-injection containers for action handlers.
// Extracted from reducer.ts — no logic changes.
//
// IMPORTANT: This module must NOT import runtime values from reducer.ts
// to avoid an ESM initialization cycle (reducer.ts imports this file).

import { debugLog } from "../debug/debugLogger";
import { GRID_W, GRID_H } from "../constants/grid";
import { WAREHOUSE_CAPACITY } from "./constants/buildings/index";
import { FLOOR_TILE_COSTS } from "./constants/map/floor";
import { MAP_SHOP_ITEMS } from "./constants/ui/shop";
import { RESOURCE_1x1_DROP_AMOUNT } from "./constants/resources";
import {
  KEEP_STOCK_MAX_TARGET,
  KEEP_STOCK_OPEN_JOB_CAP,
} from "./constants/keep-stock";

import { addErrorNotification, addNotification } from "./utils/notifications";
import { makeId } from "./utils/make-id";
import { cellKey } from "./utils/cell-key";

import { isUnderConstruction } from "./helpers/asset-status";
import {
  EMPTY_HOTBAR_SLOT,
  hotbarAdd,
  hotbarDecrement,
} from "./helpers/hotbar";
import { getAvailableResource } from "./helpers/inventory-queries";
import {
  getActiveSmithyAsset,
  getSelectedCraftingAsset,
} from "./helpers/crafting-asset-lookup";
import { resolveShopItemTarget } from "./helpers/shop";
import { tryTogglePanelFromAsset } from "./helpers/ui-panel-toggle";
import { validateDroneHubAssignment } from "./helpers/droneAssignment";
import {
  checkFloorPlacementEligibility,
  mapFloorPlacementError,
} from "./helpers/floorPlacement";
import {
  addAutoDelivery,
  addToCollectionNodeAt,
  consumeResources,
  getCapacityPerResource,
  getKeepStockByWorkbench,
  getRecipeAutomationPolicies,
  getWarehouseCapacity,
  logCraftingSelectionComparison,
  tickOneDrone,
} from "./helpers/reducer-helpers";

import { removeAsset, placeAsset } from "./asset-mutation";
import {
  hasResources,
  addResources,
  getEffectiveBuildInventory,
  fullCostAsRemaining,
  consumeBuildResources,
} from "./inventory-ops";
import { getZoneItemCapacity } from "./warehouse-capacity";
import { resolveBuildingSource } from "./building-source";
import { toCraftingJobInventorySource } from "./crafting/crafting-source-adapters";

import { syncDrones } from "../drones/utils/drone-state-helpers";
import { getCraftingSourceInventory } from "../crafting/crafting-sources";
import {
  type ExecutionTickDeps,
  type PlanningTriggerDeps,
} from "../crafting/tickPhases";

import { type BuildingPlacementIoDeps } from "./action-handlers/building-placement";
import { type BuildingSiteActionDeps } from "./action-handlers/building-site";
import { type ClickCellActionDeps } from "./action-handlers/click-cell";
import { type ClickCellToolActionDeps } from "./action-handlers/click-cell-tools";
import { type CraftingQueueActionDeps } from "./action-handlers/crafting-queue-actions";
import { type DroneAssignmentActionDeps } from "./action-handlers/drone-assignment";
import { type DroneRoleActionDeps } from "./action-handlers/drone-role-actions";
import { type DroneTickActionDeps } from "./action-handlers/drone-tick-actions";
import { type FloorPlacementActionDeps } from "./action-handlers/floor-placement";
import { type LogisticsTickIoDeps } from "./action-handlers/logistics-tick";
import { type MachineActionDeps } from "./action-handlers/machine-actions";
import { type ManualAssemblerActionDeps } from "./action-handlers/manual-assembler-actions";
import { type ShopActionDeps } from "./action-handlers/shop";
import { type UiCellPreludeDeps } from "./action-handlers/ui-cell-prelude";
import { type WarehouseHotbarActionDeps } from "./action-handlers/warehouse-hotbar-actions";

// ---- Crafting tick phase deps (must stay store-layer, not crafting/) ----

export const PLANNING_TRIGGER_DEPS: PlanningTriggerDeps = {
  KEEP_STOCK_OPEN_JOB_CAP,
  KEEP_STOCK_MAX_TARGET,
  resolveBuildingSource,
  toCraftingJobInventorySource,
  getCraftingSourceInventory,
  isUnderConstruction,
};

export const EXECUTION_TICK_DEPS: ExecutionTickDeps = {
  isUnderConstruction,
};

// ---- Action-handler deps ----

export const CRAFTING_QUEUE_ACTION_DEPS: CraftingQueueActionDeps = {
  KEEP_STOCK_MAX_TARGET,
  planningTriggerDeps: PLANNING_TRIGGER_DEPS,
  executionTickDeps: EXECUTION_TICK_DEPS,
  isUnderConstruction,
  resolveBuildingSource,
  toCraftingJobInventorySource,
  logCraftingSelectionComparison,
  addErrorNotification,
  getKeepStockByWorkbench,
  getRecipeAutomationPolicies,
};

export const UI_CELL_PRELUDE_DEPS: UiCellPreludeDeps = {
  tryTogglePanelFromAsset,
};

export const CLICK_CELL_TOOL_ACTION_DEPS: ClickCellToolActionDeps = {
  RESOURCE_1x1_DROP_AMOUNT,
  removeAsset,
  addToCollectionNodeAt,
  hotbarDecrement,
  getCapacityPerResource,
  hotbarAdd,
  addResources,
  addNotification,
  placeAsset,
  addErrorNotification,
  debugLog,
};

export const CLICK_CELL_ACTION_DEPS: ClickCellActionDeps = {
  uiCellPreludeDeps: UI_CELL_PRELUDE_DEPS,
  clickCellToolActionDeps: CLICK_CELL_TOOL_ACTION_DEPS,
};

export const MACHINE_ACTION_DEPS: MachineActionDeps = {
  getSelectedCraftingAsset,
  getActiveSmithyAsset,
  logCraftingSelectionComparison,
  isUnderConstruction,
  resolveBuildingSource,
  addErrorNotification,
  addNotification,
  consumeResources,
  addResources,
};

export const WAREHOUSE_HOTBAR_ACTION_DEPS: WarehouseHotbarActionDeps = {
  EMPTY_HOTBAR_SLOT,
  hotbarAdd,
  addErrorNotification,
  isUnderConstruction,
  getAvailableResource,
  getWarehouseCapacity,
  consumeResources,
  addResources,
};

export const MANUAL_ASSEMBLER_ACTION_DEPS: ManualAssemblerActionDeps = {
  getSelectedCraftingAsset,
  logCraftingSelectionComparison,
  isUnderConstruction,
  resolveBuildingSource,
  getCapacityPerResource,
  getZoneItemCapacity,
  addErrorNotification,
  addNotification,
  consumeResources,
  addResources,
  WAREHOUSE_CAPACITY,
};

export const BUILDING_PLACEMENT_IO_DEPS: BuildingPlacementIoDeps = {
  makeId,
  addErrorNotification,
  debugLog,
};

export const BUILDING_SITE_ACTION_DEPS: BuildingSiteActionDeps = {
  isUnderConstruction,
  addErrorNotification,
  fullCostAsRemaining,
  debugLog,
};

export const FLOOR_PLACEMENT_ACTION_DEPS: FloorPlacementActionDeps = {
  GRID_W,
  GRID_H,
  FLOOR_TILE_COSTS,
  cellKey,
  hasResources,
  getEffectiveBuildInventory,
  addErrorNotification,
  checkFloorPlacementEligibility,
  mapFloorPlacementError,
  consumeBuildResources,
  debugLog,
};

export const SHOP_ACTION_DEPS: ShopActionDeps = {
  MAP_SHOP_ITEMS,
  hasResources,
  consumeResources,
  addNotification,
  resolveShopItemTarget,
  hotbarAdd,
  addResources,
};

export const DRONE_ASSIGNMENT_ACTION_DEPS: DroneAssignmentActionDeps = {
  validateDroneHubAssignment,
  addErrorNotification,
  syncDrones,
  debugLog,
};

export const DRONE_ROLE_ACTION_DEPS: DroneRoleActionDeps = {
  syncDrones,
};

export const DRONE_TICK_ACTION_DEPS: DroneTickActionDeps = {
  tickOneDrone,
};

export const LOGISTICS_TICK_IO_DEPS: LogisticsTickIoDeps = {
  addNotification,
  addAutoDelivery,
};
