// ============================================================
// Public API barrel — re-exports previously inline in reducer.ts.
// Consumers may import from here directly, or via simulation/game.ts
// or store/reducer (which re-exports this module via `export * from`).
//
// IMPORTANT: This module must NOT import from ./reducer to avoid
// an ESM initialization cycle.
// ============================================================

// ---- Constants (conveyor) ----
export {
  CONVEYOR_TILE_CAPACITY,
  MAX_UNDERGROUND_SPAN,
  MIN_UNDERGROUND_SPAN,
  undergroundSpanCellsInBounds,
  undergroundSpanSteps,
} from "./conveyor/constants";

// ---- Constants (energy) ----
export { BATTERY_CAPACITY } from "./constants/energy/battery";
export { POWER_POLE_RANGE } from "./constants/energy/power-pole";

// ---- Constants (UI) ----
export { HOTBAR_SIZE, HOTBAR_STACK_MAX } from "./constants/ui/hotbar";

// ---- Constants (keep-stock) ----
export {
  KEEP_STOCK_MAX_TARGET,
  KEEP_STOCK_OPEN_JOB_CAP,
} from "./constants/keep-stock";

// ---- Constants (drone) ----
export {
  DRONE_CAPACITY,
  DRONE_SEPARATION_RADIUS,
} from "./constants/drone/drone-config";
export {
  MAX_DRONES_PER_CONSTRUCTION_TARGET,
  MAX_DRONES_PER_HUB_RESTOCK_RESOURCE,
  MAX_DRONES_PER_BUILDING_SUPPLY,
} from "./constants/drone/drone-assignment-caps";

// ---- Constants (auto-smelter) ----
export { AUTO_SMELTER_BUFFER_CAPACITY } from "./constants/auto/auto-smelter";

// ---- Constants (map) ----
export { MAP_SHOP_POS } from "./constants/map/map-layout";

// ---- Constants (grid) ----
export { GRID_W, GRID_H, CELL_PX } from "../constants/grid";

// ---- Constants (energy / boost multipliers) ----
export {
  AUTO_MINER_BOOST_MULTIPLIER,
  AUTO_SMELTER_BOOST_MULTIPLIER,
} from "./constants/energy/boost-multipliers";

// ---- Constants (hub target stock) ----
export {
  createDefaultHubTargetStock,
  createDefaultProtoHubTargetStock,
} from "./constants/hub/hub-target-stock";

// ---- Constants (drone scoring) ----
export {
  DRONE_NEARBY_WAREHOUSE_LIMIT,
  DRONE_WAREHOUSE_PRIORITY_BONUS,
  scoreDroneTask,
} from "../drones/candidates/scoring";

// ---- Selectors / view-models ----
export type { ConveyorZoneStatus } from "./selectors/conveyor-zone-status";
export { getConveyorZoneStatus } from "./selectors/conveyor-zone-status";
export type {
  FallbackReason,
  SourceStatusInfo,
} from "./selectors/source-status";
export {
  hasStaleWarehouseAssignment,
  getSourceStatusInfo,
} from "./selectors/source-status";

// ---- Selectors (hub tier) ----
export {
  getHubRange,
  getActiveResources,
  getMaxDrones,
  getMaxTargetStockForTier,
  getHubTierLabel,
} from "./selectors/hub-tier-selectors";

// ---- Selectors (zones) ----
export { getZoneBuildingIds } from "./selectors/zone-selectors";

// ---- Helpers ----
export {
  isBoostSupportedType,
  getBoostMultiplier,
  isEnergyConsumerType,
  withDefaultMachinePriority,
} from "./helpers/machine-priority";
export { RESOURCE_1x1_DROP_AMOUNT } from "./constants/resources";
export {
  selectBuildMenuInventoryView,
  selectGlobalInventoryView,
  getAvailableResource,
} from "./helpers/inventory-queries";

// ---- Helpers (asset status) ----
export { isUnderConstruction } from "./helpers/asset-status";

// ---- Helpers (hotbar) ----
export {
  EMPTY_HOTBAR_SLOT,
  createInitialHotbar,
  hotbarAdd,
  hotbarDecrement,
} from "./helpers/hotbar";

// ---- Helpers (reducer-helpers) ----
export {
  getCapacityPerResource,
  consumeResources,
  addToCollectionNodeAt,
} from "./helpers/reducer-helpers";

// ---- Inventory ops ----
export {
  createEmptyInventory,
  hasResources,
  addResources,
  getEffectiveBuildInventory,
} from "./inventory-ops";

// ---- Asset geometry / mutation ----
export {
  assetWidth,
  assetHeight,
  getAutoSmelterIoCells,
} from "./asset-geometry";
export { placeAsset } from "./asset-mutation";

// ---- Warehouse input / capacity ----
export {
  getWarehouseInputCell,
  isValidWarehouseInput,
} from "./warehouse-input";
export { getZoneItemCapacity } from "./warehouse-capacity";

// ---- Building source ----
export { resolveBuildingSource } from "./building-source";

// ---- Crafting source adapters ----
export { toCraftingJobInventorySource } from "./crafting/crafting-source-adapters";

// ---- Crafting sources ----
export {
  resolveCraftingSource,
  getCraftingSourceInventory,
  applyCraftingSourceInventory,
} from "../crafting/crafting-sources";

// ---- Power / energy ----
export { getConnectedConsumerDrainEntries } from "../power/energy-consumers";
export { getEnergyProductionPerPeriod } from "../power/energy-production";

// ---- Zones ----
export {
  getZoneAggregateInventory,
  getZoneWarehouseIds,
} from "../zones/production-zone-aggregation";
export { cleanBuildingZoneIds } from "../zones/production-zone-cleanup";

// ---- Warehouse assignment / storage ----
export {
  cleanBuildingSourceIds,
  getNearestWarehouseId,
  reassignBuildingSourceIds,
} from "../buildings/warehouse/warehouse-assignment";
export {
  consumeFromPhysicalStorage,
  hasResourcesInPhysicalStorage,
} from "../buildings/warehouse/warehouse-storage";

// ---- Service hub ----
export { createEmptyHubInventory } from "../buildings/service-hub/hub-upgrade-workflow";
export { getBuildingInputTargets } from "../buildings/building-input-targets";

// ---- Drones ----
export { getDroneDockOffset } from "../drones/dock/drone-dock-geometry";

// ---- Logistics ----
export { computeConnectedAssetIds } from "../logistics/connectivity";
export {
  areZonesTransportCompatible,
  getConveyorZone,
} from "../logistics/conveyor-zone";

// ---- Utils (cell key / direction) ----
export { cellKey } from "./utils/cell-key";
export { directionOffset } from "./utils/direction";
export {
  isPowerCableConductorType,
  isPowerPoleRangeType,
  getConnectedDemandPerPeriod,
} from "./helpers/energy-helpers";
export {
  devAssertInventoryNonNegative,
  manhattanDist,
} from "./helpers/misc-helpers";
export {
  getHubDrones,
  getDroneDockSlotIndex,
  getDroneStatusDetail,
  getDroneHomeDock,
  isDroneParkedAtHub,
  getParkedDrones,
  selectDroneTask,
  getBuildingInputCurrent,
  getInboundBuildingSupplyAmount,
  getRemainingBuildingInputDemand,
} from "./helpers/drone-helpers";

// ---- Utilities ----
export { makeId } from "./utils/make-id";

// ---- Types (all game state shapes) ----
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
  WorkbenchSource,
  GameState,
} from "./types";
