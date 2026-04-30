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
import { dispatchAction } from "./game-reducer-dispatch";
import {
  decideInitialWarehousePlacement,
  deriveDebugBootstrapLayout,
} from "./helpers/initialState";
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

// Action-handler dependency-injection containers live in ./action-handler-deps
// and are wired into the dispatch chain in ./game-reducer-dispatch.

import { RESOURCE_1x1_DROP_AMOUNT } from "./constants/resources";
import { getBoostMultiplier } from "./helpers/machine-priority";
import {
  devAssertInventoryNonNegative,
  resolveWorkbenchSource,
  manhattanDist,
} from "./helpers/misc-helpers";
import {
  isPowerCableConductorType,
  isPowerPoleRangeType,
  getConnectedDemandPerPeriod,
} from "./helpers/energy-helpers";

// ---- Energy / Generator ----
export {
  RESOURCE_1x1_DROP_AMOUNT,
  getBoostMultiplier,
  devAssertInventoryNonNegative,
  resolveWorkbenchSource,
  manhattanDist,
};
export {
  isPowerCableConductorType,
  isPowerPoleRangeType,
  getConnectedDemandPerPeriod,
};

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

// Need-slot resolvers live in drones/selection/helpers/need-slot-resolvers.ts
// and are imported directly by their consumers (drones/selection/*,
// drones/candidates/*, drones/execution/*).

/** Lists every placed asset that owns an input buffer, paired with its accepted resource. */
export { getBuildingInputTargets };

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

// ============================================================
// SOURCE STATUS VIEW-MODEL
// Pure derivation for UI transparency — no side effects.
// Re-exported via ./reducer-public-api (see end of file).
// ============================================================

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
// The dispatch chain itself lives in ./game-reducer-dispatch.
// `gameReducer` here is a thin entry-point so that tooling, tests
// and external consumers keep importing it from "../store/reducer".
// ============================================================
export function gameReducer(state: GameState, action: GameAction): GameState {
  return dispatchAction(state, action);
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

