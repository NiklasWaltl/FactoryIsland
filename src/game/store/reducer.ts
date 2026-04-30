// ============================================================
// Factory Island - Game State & Logic
// ============================================================

import { CELL_PX, GRID_H, GRID_W } from "../constants/grid";
import {
  GENERATOR_MAX_FUEL,
  getBuildingInputConfig,
  WAREHOUSE_CAPACITY,
} from "./constants/buildings/index";
import { CONVEYOR_TILE_CAPACITY } from "./conveyor/constants";
import {
  getManualAssemblerRecipe,
  getWorkbenchRecipe,
  getSmeltingRecipe,
  SMELTING_RECIPES,
} from "../simulation/recipes";
import {
  cancelJob as craftingCancelJob,
  enqueueJob as craftingEnqueueJob,
  createEmptyCraftingQueue,
  moveJob as craftingMoveJob,
  setJobPriority as craftingSetJobPriority,
} from "../crafting/queue";
import { buildWorkbenchAutoCraftPlan } from "../crafting/planner";
import { applyKeepStockRefills } from "../crafting/workflows/keepStockWorkflow";
import {
  applyPlanningTriggers,
  applyExecutionTick,
} from "../crafting/tickPhases";
import {
  applyRecipeAutomationPolicyPatch,
  areRecipeAutomationPolicyEntriesEqual,
  checkRecipeAutomationPolicy,
  isRecipeAutomationPolicyEntryDefault,
  type RecipeAutomationPolicyPatch,
} from "../crafting/policies";
import { routeOutput } from "../crafting/output";
import {
  applyCraftingSourceInventory,
  getCraftingSourceInventory,
  resolveCraftingSource,
} from "../crafting/crafting-sources";
import { getConnectedConsumerDrainEntries } from "../power/energy-consumers";
import { getEnergyProductionPerPeriod } from "../power/energy-production";
import {
  getZoneAggregateInventory,
  getZoneWarehouseIds,
} from "../zones/production-zone-aggregation";
import { applyZoneDelta } from "../zones/production-zone-mutation";
import { cleanBuildingZoneIds } from "../zones/production-zone-cleanup";
import {
  cleanBuildingSourceIds,
  getNearestWarehouseId,
  reassignBuildingSourceIds,
} from "../buildings/warehouse/warehouse-assignment";
import {
  createEmptyHubInventory,
  finalizeHubTier2Upgrade,
} from "../buildings/service-hub/hub-upgrade-workflow";
import { getBuildingInputTargets } from "../buildings/building-input-targets";
import {
  consumeFromPhysicalStorage,
  hasResourcesInPhysicalStorage,
} from "../buildings/warehouse/warehouse-storage";
import {
  DRONE_NEARBY_WAREHOUSE_LIMIT,
  DRONE_WAREHOUSE_PRIORITY_BONUS,
  scoreDroneTask,
} from "../drones/candidates/scoring";
export {
  DRONE_NEARBY_WAREHOUSE_LIMIT,
  scoreDroneTask,
  DRONE_WAREHOUSE_PRIORITY_BONUS,
};
import {
  getAssignedBuildingSupplyDroneCount as getAssignedBuildingSupplyDroneCountResolver,
  getAssignedConstructionDroneCount as getAssignedConstructionDroneCountResolver,
  getAssignedWorkbenchDeliveryDroneCount as getAssignedWorkbenchDeliveryDroneCountResolver,
  getAssignedWorkbenchInputDroneCount as getAssignedWorkbenchInputDroneCountResolver,
  getInboundConstructionAmount as getInboundConstructionAmountResolver,
  getInboundHubRestockAmount as getInboundHubRestockAmountResolver,
  getInboundHubRestockDroneCount as getInboundHubRestockDroneCountResolver,
  getOpenBuildingSupplyDroneSlots as getOpenBuildingSupplyDroneSlotsResolver,
  getOpenConstructionDroneSlots as getOpenConstructionDroneSlotsResolver,
  getOpenHubRestockDroneSlots as getOpenHubRestockDroneSlotsResolver,
  getRemainingConstructionNeed as getRemainingConstructionNeedResolver,
  getRemainingHubRestockNeed as getRemainingHubRestockNeedResolver,
} from "../drones/selection/helpers/need-slot-resolvers";
import { droneTravelTicks } from "../drones/movement/drone-movement";
import { getDroneDockOffset } from "../drones/dock/drone-dock-geometry";
import { syncDrones } from "../drones/utils/drone-state-helpers";
import { addErrorNotification, addNotification } from "./utils/notifications";
import { directionOffset } from "./utils/direction";
import { getWarehouseInputCell, isValidWarehouseInput } from "./warehouse-input";
import { isUnderConstruction } from "./helpers/asset-status";
import {
  EMPTY_HOTBAR_SLOT,
  createInitialHotbar,
  hotbarAdd,
  hotbarDecrement,
} from "./helpers/hotbar";
import { getAvailableResource } from "./helpers/inventory-queries";
import { computeConnectedAssetIds } from "../logistics/connectivity";
import {
  areZonesTransportCompatible,
  getConveyorZone,
} from "../logistics/conveyor-zone";
import { getConveyorZoneStatus } from "./selectors/conveyor-zone-status";
import { decideHubDispatchExecutionAction } from "./workflows/hub-dispatch-execution";
import {
  handleCraftingQueueAction,
} from "./action-handlers/crafting-queue-actions";
import { handleZoneAction } from "./action-handlers/zone-actions";
import { handleUiAction } from "./action-handlers/ui-actions";
import {
  handleBuildingPlacementAction,
} from "./action-handlers/building-placement";
import {
  handleBuildingSiteAction,
} from "./action-handlers/building-site";
import {
  handleMachineAction,
} from "./action-handlers/machine-actions";
import {
  handleClickCellAction,
} from "./action-handlers/click-cell";
import {
  handleWarehouseHotbarAction,
} from "./action-handlers/warehouse-hotbar-actions";
import {
  handleManualAssemblerAction,
} from "./action-handlers/manual-assembler-actions";
import {
  handleFloorPlacementAction,
} from "./action-handlers/floor-placement";
import {
  handleShopAction,
} from "./action-handlers/shop";
import { handleMachineConfigAction } from "./action-handlers/machine-config";
import { handleBuildModeAction } from "./action-handlers/build-mode-actions";
import { handleMaintenanceAction } from "./action-handlers/maintenance-actions";
import { handleGrowthAction } from "./action-handlers/growth-actions";
import { handleHubTargetAction } from "./action-handlers/hub-target-actions";
import { handleAutoSmelterAction } from "./action-handlers/auto-smelter-actions";
import { handleAutoAssemblerAction } from "./action-handlers/auto-assembler-actions";
import {
  handleDroneRoleAction,
} from "./action-handlers/drone-role-actions";
import {
  handleDroneTickAction,
} from "./action-handlers/drone-tick-actions";
import {
  handleDroneAssignmentAction,
} from "./action-handlers/drone-assignment";
import {
  handleLogisticsTickAction,
} from "./action-handlers/logistics-tick";
import {
  decideInitialWarehousePlacement,
  deriveDebugBootstrapLayout,
} from "./helpers/initialState";
import { runEnergyNetTick } from "./energy/energy-net-tick";
import { resolveBuildingSource } from "./building-source";
import { toCraftingJobInventorySource } from "./crafting/crafting-source-adapters";
import {
  decideAutoSmelterTickEntryEligibility,
  decideAutoSmelterInputBeltEligibility,
  decideAutoSmelterNonPendingStatus,
  decideAutoSmelterOutputTarget,
  decideAutoSmelterPendingOutputStatus,
  decideAutoSmelterStartProcessingEligibility,
} from "./decisions/smelter-decisions";
import { consumeAutoSmelterPendingOutput } from "./helpers/smelter-mutations";
import {
  decideConveyorTickEligibility,
  decideConveyorTargetSelection,
} from "./decisions/conveyor-decisions";
import {
  decideAutoMinerOutputTarget,
  decideAutoMinerTickEligibility,
} from "./decisions/auto-miner-decisions";
import type { CraftingInventorySource } from "../crafting/types";

// ---- Core types ----------------------------------------------------------
// All shape declarations live in ./types. Imported for internal use and
// re-exported below for backward-compatible `from "../store/reducer"` consumers.
// GameAction moved to ./game-actions; re-exported below at the ACTIONS section.
import type {
  GameMode,
  AssetType,
  BuildingType,
  FloorTileType,
  MachinePriority,
  PlacedAsset,
  Inventory,
  ToolKind,
  HotbarSlot,
  SmithyState,
  ManualAssemblerState,
  Direction,
  AutoMinerEntry,
  ConveyorItem,
  ConveyorState,
  AutoSmelterStatus,
  AutoSmelterProcessing,
  AutoSmelterEntry,
  UIPanel,
  BatteryState,
  GeneratorState,
  GameNotification,
  AutoDeliveryEntry,
  CollectableItemType,
  CollectionNode,
  DroneRole,
  DroneStatus,
  DroneCargoItem,
  StarterDroneState,
  DroneTaskType,
  ConstructionSite,
  ServiceHubInventory,
  HubTier,
  ServiceHubEntry,
  KeepStockTargetEntry,
  KeepStockByWorkbench,
  RecipeAutomationPolicyEntry,
  RecipeAutomationPolicyMap,
  ProductionZone,
  CraftingSource,
  WorkbenchSource,
  GameState,
} from "./types";

export type {
  GameMode,
  AssetType,
  BuildingType,
  FloorTileType,
  MachinePriority,
  PlacedAsset,
  Inventory,
  ToolKind,
  HotbarSlot,
  SmithyState,
  ManualAssemblerState,
  Direction,
  AutoMinerEntry,
  ConveyorItem,
  ConveyorState,
  AutoSmelterStatus,
  AutoSmelterProcessing,
  AutoSmelterEntry,
  UIPanel,
  BatteryState,
  GeneratorState,
  GameNotification,
  AutoDeliveryEntry,
  CollectableItemType,
  CollectionNode,
  DroneRole,
  DroneStatus,
  DroneCargoItem,
  StarterDroneState,
  DroneTaskType,
  ConstructionSite,
  ServiceHubInventory,
  HubTier,
  ServiceHubEntry,
  KeepStockTargetEntry,
  KeepStockByWorkbench,
  RecipeAutomationPolicyEntry,
  RecipeAutomationPolicyMap,
  ProductionZone,
  CraftingSource,
  WorkbenchSource,
  GameState,
};

/** Returns true if the building with the given asset ID is still under construction. */
export { isUnderConstruction };

// ============================================================
// CONSTANTS
// ============================================================

// Conveyor constants live in ./conveyor/constants.
// Re-exported via ./reducer-public-api (see end of file).
export { GRID_W, GRID_H, CELL_PX };

// Floor tile constants live in ./constants/map/floor.

// Timing constants live in ./constants/timing/timing.
import {
  DRONE_TICK_MS,
  LOGISTICS_TICK_MS,
  NATURAL_SPAWN_CAP,
  NATURAL_SPAWN_CHANCE,
  SAPLING_GROW_MS,
} from "./constants/timing/timing";

// Auto-delivery log limits live in ./constants/auto/auto-delivery.
import {
  AUTO_DELIVERY_BATCH_WINDOW_MS,
  AUTO_DELIVERY_LOG_MAX,
} from "./constants/auto/auto-delivery";

// Drone/logistics constants live in ./constants/drone/drone-config.
import {
  AUTO_MINER_PRODUCE_TICKS,
  DRONE_COLLECT_TICKS,
  DRONE_DEPOSIT_TICKS,
  DRONE_SPEED_TILES_PER_TICK,
} from "./constants/drone/drone-config";

// Energy/auto-smelter coupled constants live in ./constants/energy-smelter.
import {
  AUTO_SMELTER_IDLE_DRAIN_PER_PERIOD,
  AUTO_SMELTER_PROCESSING_DRAIN_PER_PERIOD,
  ENERGY_NET_TICK_MS,
} from "./constants/energy/energy-smelter";

// Energy balance constants live in ./constants/energy-balance.
import {
  POWER_CABLE_CONDUCTOR_TYPES,
  POWER_POLE_RANGE_TYPES,
} from "./constants/energy/energy-balance";

// Generator constants live in ./constants/generator.
import {
  GENERATOR_ENERGY_PER_TICK,
  GENERATOR_TICK_MS,
  GENERATOR_TICKS_PER_WOOD,
} from "./constants/energy/generator";

// Workbench/Smithy timing constants live in ./constants/timing/workbench-timing.
import {
  MANUAL_ASSEMBLER_PROCESS_MS,
  MANUAL_ASSEMBLER_TICK_MS,
  SMITHY_PROCESS_MS,
  SMITHY_TICK_MS,
} from "./constants/timing/workbench-timing";

// Service hub target-stock defaults live in ./constants/hub-target-stock.
import {
  createDefaultHubTargetStock,
  createDefaultProtoHubTargetStock,
} from "./constants/hub/hub-target-stock";

// Hub tier selector helpers live in ./selectors/hub-tier-selectors.
import {
  getHubRange,
  getActiveResources,
  getMaxDrones,
  getMaxTargetStockForTier,
  getHubTierLabel,
} from "./selectors/hub-tier-selectors";
export {
  getHubRange,
  getActiveResources,
  getMaxDrones,
  getMaxTargetStockForTier,
  getHubTierLabel,
};

// Service hub upgrade cost lives in ./constants/hub-upgrade-cost.
import { HUB_UPGRADE_COST } from "./constants/hub/hub-upgrade-cost";

// Map shop offer constants live in ./constants/ui/shop.

/** Drop amount for all 1×1 harvestable resources (tree, stone, iron, copper). */
export const RESOURCE_1x1_DROP_AMOUNT = 10;
if (import.meta.env.DEV) console.log(`[FactoryIsland] Drop-Multiplikator auf ${RESOURCE_1x1_DROP_AMOUNT}x für 1x1-Ressourcen gesetzt.`);

// Action-handler dependency-injection containers live in ./action-handler-deps.
// Imported here so the dispatch chain wiring (handle...Action(state, action, deps))
// remains greppable from this file.
import {
  PLANNING_TRIGGER_DEPS,
  EXECUTION_TICK_DEPS,
  CRAFTING_QUEUE_ACTION_DEPS,
  UI_CELL_PRELUDE_DEPS,
  CLICK_CELL_TOOL_ACTION_DEPS,
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

// ---- Energy / Generator ----

export function isPowerCableConductorType(type: AssetType): boolean {
  return POWER_CABLE_CONDUCTOR_TYPES.has(type);
}

export function isPowerPoleRangeType(type: AssetType): boolean {
  return POWER_POLE_RANGE_TYPES.has(type);
}

import { clampMachinePriority, isEnergyConsumerType, withDefaultMachinePriority } from "./helpers/machine-priority";
import { cellKey } from "./utils/cell-key";
import { assetWidth, assetHeight, getAutoSmelterIoCells } from "./asset-geometry";
import { removeAsset, placeAsset } from "./asset-mutation";
import {
  COLLECTABLE_KEYS,
  createEmptyInventory,
  hasResources,
  addResources,
  getEffectiveBuildInventory,
  fullCostAsRemaining,
  consumeBuildResources,
} from "./inventory-ops";
export { isEnergyConsumerType };
export {
  getConnectedConsumerDrainEntries,
  getEnergyProductionPerPeriod,
};
export {
  getZoneAggregateInventory,
  getZoneWarehouseIds,
  cleanBuildingZoneIds,
};
export {
  getNearestWarehouseId,
  reassignBuildingSourceIds,
  cleanBuildingSourceIds,
  consumeFromPhysicalStorage,
  hasResourcesInPhysicalStorage,
};
export {
  computeConnectedAssetIds,
  getConveyorZone,
  getConveyorZoneStatus,
  areZonesTransportCompatible,
};
export {
  resolveCraftingSource,
  getCraftingSourceInventory,
  applyCraftingSourceInventory,
};
export {
  createEmptyHubInventory,
};
export {
  getDroneDockOffset,
};

export function getConnectedDemandPerPeriod(
  state: Pick<GameState, "assets" | "connectedAssetIds" | "autoSmelters" | "autoAssemblers">,
): number {
  return getConnectedConsumerDrainEntries(state).reduce((sum, entry) => sum + entry.drain, 0);
}

export { withDefaultMachinePriority };

// ---- Auto-Miner / Conveyor ----
// ---- Crafting job queue ----
// ---- Starter Drone ----
// Drone constants and helper functions were extracted to:
// - ./constants/drone/drone-config
// - ./constants/drone/drone-assignment-caps
// - ./helpers/drone-helpers

export { createDefaultHubTargetStock, createDefaultProtoHubTargetStock };

// costIsFullyCollectable, fullCostAsRemaining, COLLECTABLE_KEYS extracted to ./inventory-ops

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getInboundHubRestockAmount(
  state: Pick<GameState, "drones" | "collectionNodes">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getInboundHubRestockAmountResolver(state, hubId, itemType, excludeDroneId);
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getInboundHubRestockDroneCount(
  state: Pick<GameState, "drones" | "collectionNodes">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getInboundHubRestockDroneCountResolver(state, hubId, itemType, excludeDroneId);
}

/**
 * True when the hub's own inventory already covers every resource still
 * outstanding in `pendingUpgrade`. Used to finalize a pending tier-2 upgrade
 * once drones have delivered the last of the required materials.
 */
function isHubUpgradeDeliverySatisfied(hub: ServiceHubEntry | undefined | null): boolean {
  if (!hub || !hub.pendingUpgrade) return false;
  for (const [k, v] of Object.entries(hub.pendingUpgrade)) {
    const needed = v ?? 0;
    if (needed <= 0) continue;
    const have = hub.inventory[k as CollectableItemType] ?? 0;
    if (have < needed) return false;
  }
  return true;
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getRemainingHubRestockNeed(
  state: Pick<GameState, "drones" | "collectionNodes" | "serviceHubs" | "constructionSites">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getRemainingHubRestockNeedResolver(state, hubId, itemType, excludeDroneId);
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getOpenHubRestockDroneSlots(
  state: Pick<GameState, "drones" | "collectionNodes" | "serviceHubs" | "constructionSites">,
  hubId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getOpenHubRestockDroneSlotsResolver(state, hubId, itemType, excludeDroneId);
}


// ---------------------------------------------------------------------------
// Warehouse-as-pickup-source helpers (warehouse > hub priority).
// Mirror the hub-dispatch model: synthetic targetNodeId "wh:{whId}:{item}",
// inbound counting throttles per-warehouse availability. We deliberately do
// NOT subtract crafting reservations here — symmetric to the existing hub
// path, which also ignores them. If a craft commit later races and finds
// short stock, the existing reservation system handles it.
// ---------------------------------------------------------------------------

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
/** Counts in-flight drone trips heading to a specific warehouse for `itemType`,
 *  across both hub_dispatch and building_supply task types. */
function getInboundConstructionAmount(
  state: Pick<GameState, "drones" | "collectionNodes">,
  siteId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getInboundConstructionAmountResolver(state, siteId, itemType, excludeDroneId);
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getAssignedConstructionDroneCount(
  state: Pick<GameState, "drones">,
  siteId: string,
  excludeDroneId?: string,
): number {
  return getAssignedConstructionDroneCountResolver(state, siteId, excludeDroneId);
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getRemainingConstructionNeed(
  state: Pick<GameState, "drones" | "collectionNodes" | "constructionSites">,
  siteId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getRemainingConstructionNeedResolver(state, siteId, itemType, excludeDroneId);
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getOpenConstructionDroneSlots(
  state: Pick<GameState, "drones" | "constructionSites">,
  siteId: string,
  excludeDroneId?: string,
): number {
  return getOpenConstructionDroneSlotsResolver(state, siteId, excludeDroneId);
}

// ---- Building Input Buffer helpers (drone supply targets) ------------------
//
// Mirrors the construction_supply helpers above, but targets a building's
// local input buffer (see BUILDING_INPUT_BUFFERS) instead of a construction
// site. Currently used by the wood generator.

/** Lists every placed asset that owns an input buffer, paired with its accepted resource. */
export { getBuildingInputTargets };

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getAssignedBuildingSupplyDroneCount(
  state: Pick<GameState, "drones">,
  assetId: string,
  excludeDroneId?: string,
): number {
  return getAssignedBuildingSupplyDroneCountResolver(state, assetId, excludeDroneId);
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getOpenBuildingSupplyDroneSlots(
  state: Pick<GameState, "assets" | "generators" | "drones">,
  assetId: string,
  itemType: CollectableItemType,
  excludeDroneId?: string,
): number {
  return getOpenBuildingSupplyDroneSlotsResolver(state, assetId, itemType, excludeDroneId);
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getAssignedWorkbenchDeliveryDroneCount(
  state: Pick<GameState, "drones">,
  jobId: string,
  excludeDroneId?: string,
): number {
  return getAssignedWorkbenchDeliveryDroneCountResolver(state, jobId, excludeDroneId);
}

// Implementation: drones/selection/helpers/need-slot-resolvers.ts
function getAssignedWorkbenchInputDroneCount(
  state: Pick<GameState, "drones">,
  reservationId: string,
  excludeDroneId?: string,
): number {
  return getAssignedWorkbenchInputDroneCountResolver(state, reservationId, excludeDroneId);
}

/**
 * Overclocking-Stufe 1: Zwei feste Modi (normal / boosted), nur für auto_miner
 * und auto_smelter. Multiplikator wirkt konsistent auf Strom UND Produktion.
 * Re-exported from the canonical source for backward compatibility.
 */
import {
  AUTO_MINER_BOOST_MULTIPLIER,
  AUTO_SMELTER_BOOST_MULTIPLIER,
} from "./constants/energy/boost-multipliers";
export { AUTO_MINER_BOOST_MULTIPLIER, AUTO_SMELTER_BOOST_MULTIPLIER };

/** Effektiver Boost-Multiplikator für ein Asset. 1 wenn nicht boosted oder nicht unterstützt. */
export function getBoostMultiplier(asset: Pick<PlacedAsset, "type" | "boosted">): number {
  if (!asset.boosted) return 1;
  if (asset.type === "auto_miner") return AUTO_MINER_BOOST_MULTIPLIER;
  if (asset.type === "auto_smelter") return AUTO_SMELTER_BOOST_MULTIPLIER;
  return 1;
}

export { createEmptyInventory };

// Helpers extracted to ./helpers/reducer-helpers.
// Re-exports for backward-compat (`getCapacityPerResource` was originally exported here).
import {
  getWarehouseCapacity,
  getCapacityPerResource,
  consumeResources,
  logCraftingSelectionComparison,
  addToCollectionNodeAt,
  addAutoDelivery,
  tickOneDrone,
  getKeepStockByWorkbench,
  getRecipeAutomationPolicies,
} from "./helpers/reducer-helpers";
export { getCapacityPerResource, consumeResources, addToCollectionNodeAt };

// ============================================================
// INVENTORY WRAPPERS
// V1: operate on the global `state.inventory` pool.
// Future versions may aggregate per-warehouse inventories.
// ============================================================

export { getAvailableResource };

export { hasResources };

export { addResources };

export { getEffectiveBuildInventory };
// consumeBuildResources extracted to ./inventory-ops

/**
 * DEV-only: assert no inventory field is negative.
 * Call after reducer transitions to catch silent corruption early.
 */
export function devAssertInventoryNonNegative(label: string, inv: Inventory): void {
  if (!import.meta.env.DEV) return;
  for (const [key, val] of Object.entries(inv)) {
    if ((val as number) < 0) {
      console.error(`[Invariant] ${label}: "${key}" is negative (${val})`);
    }
  }
}

// ============================================================
// CRAFTING SOURCE POLICY
//
// `CraftingSource` / `WorkbenchSource` are declared in ./types and
// re-exported above. Determines where a crafting device reads/writes resources.
// ============================================================

export { toCraftingJobInventorySource };

// ============================================================
// PRODUCTION ZONE HELPERS
// ============================================================

import { getZoneBuildingIds } from "./selectors/zone-selectors";
import { getZoneItemCapacity } from "./warehouse-capacity";
export { getZoneBuildingIds, getZoneItemCapacity };

/**
 * Resolve crafting source for a specific building instance.
 * Priority: zone (if assigned + has warehouses) > legacy per-building warehouse > global.
 */
export { resolveBuildingSource };

/** @deprecated Use resolveBuildingSource */
export function resolveWorkbenchSource(state: GameState): CraftingSource {
  return resolveBuildingSource(state, state.selectedCraftingBuildingId);
}

// ============================================================
// SOURCE STATUS VIEW-MODEL
// Pure derivation for UI transparency — no side effects.
// Re-exported via ./reducer-public-api (see end of file).
// ============================================================

/**
 * Manhattan distance between two grid positions.
 */
export function manhattanDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

// ============================================================
// HELPERS
// ============================================================

// _smelterRecipesLogged moved into action-handlers/logistics-tick.ts together with the smelter phase.
// makeId lives in ./make-id (extracted so handler modules can value-import it
// directly without an ESM cycle through this file). Re-exported via
// ./reducer-public-api for backward compatibility with `from "../store/reducer"`.
import { makeId } from "./utils/make-id";

export { cellKey };

/** Returns [dx, dy] offset for a direction. */
export { directionOffset };

export { assetWidth, assetHeight, getAutoSmelterIoCells };

export { getWarehouseInputCell, isValidWarehouseInput };


// removeAsset extracted to ./asset-mutation

export { placeAsset };

export {
  EMPTY_HOTBAR_SLOT,
  createInitialHotbar,
  hotbarAdd,
  hotbarDecrement,
};

// ============================================================
// CONNECTIVITY
// ============================================================

// ============================================================
// INITIAL STATE
// ============================================================

export { createInitialState } from "./initial-state";

// ============================================================
// ACTIONS
// ============================================================

import type { GameAction } from "./game-actions";
export type { GameAction };

// ============================================================
// REDUCER
// ============================================================

// Crafting-Job-Status-, Source-Vergleichs- und Cap-Helfer leben in
// ../crafting/jobStatus und werden oben importiert.
// Die Keep-in-stock-Refill-Orchestrierung liegt in
// ../crafting/workflows/keepStockWorkflow (applyKeepStockRefills).
//
// Die Action-Handler-Deps-Container leben in ./action-handler-deps und
// werden oben importiert.

// ============================================================
// DISPATCHER
// ------------------------------------------------------------
// `gameReducer` is structured as an early-return dispatch chain
// over action-handler clusters under ./action-handlers/*. Each
// `handle...Action(state, action, deps?)` returns either the next
// state (action belonged to its cluster) or `null` (fall through).
//
// The remaining inline `switch` only covers cases that have not
// been extracted (e.g. ENERGY_NET_TICK). All extracted cases are documented
// inline below via `// <ACTION> is handled above by handle<Cluster>Action`
// markers so the action surface remains greppable from this file.
//
// See PHASE 4.11 cluster set under src/game/store/action-handlers/.
// ============================================================
export function gameReducer(state: GameState, action: GameAction): GameState {
  const craftingQueueResult = handleCraftingQueueAction(state, action, CRAFTING_QUEUE_ACTION_DEPS);
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
  const machineResult = handleMachineAction(
    state,
    action,
    MACHINE_ACTION_DEPS,
  );
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
  const shopResult = handleShopAction(
    state,
    action,
    SHOP_ACTION_DEPS,
  );
  if (shopResult !== null) return shopResult;
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

    // CRAFT_WORKBENCH, REMOVE_BUILDING, EXPIRE_NOTIFICATIONS,
    // DEBUG_SET_STATE and REMOVE_POWER_POLE are handled above by
    // handleMaintenanceAction (see action-handlers/maintenance-actions/index.ts).

    // TOGGLE_PANEL and CLOSE_PANEL are handled above by
    // handleUiAction (see action-handlers/ui-actions.ts).

    // GROW_SAPLING, GROW_SAPLINGS and NATURAL_SPAWN are handled above by
    // handleGrowthAction (see action-handlers/growth-actions/index.ts).

    case "ENERGY_NET_TICK": {
      return runEnergyNetTick(state);
    }

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

    default:
      return state;
  }
}

/** Wraps the core reducer with dev-mode invariant assertions. */
export function gameReducerWithInvariants(state: GameState, action: GameAction): GameState {
  const next = gameReducer(state, action);
  if (import.meta.env.DEV && next !== state) {
    devAssertInventoryNonNegative("state.inventory", next.inventory);
    for (const [whId, whInv] of Object.entries(next.warehouseInventories)) {
      devAssertInventoryNonNegative(`warehouseInventories[${whId}]`, whInv);
    }
  }
  return next;
}



// Public API barrel: pure `export ... from` lines extracted to ./reducer-public-api.
// Placed at end-of-file so explicit local exports above take precedence in CJS init order.
export * from "./reducer-public-api";

