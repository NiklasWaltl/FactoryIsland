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

// ---- Selectors / view-models ----
export type { ConveyorZoneStatus } from "./selectors/conveyor-zone-status";
export type { FallbackReason, SourceStatusInfo } from "./selectors/source-status";
export { hasStaleWarehouseAssignment, getSourceStatusInfo } from "./selectors/source-status";

// ---- Helpers ----
export { isBoostSupportedType } from "./helpers/machine-priority";
export {
  selectBuildMenuInventoryView,
  selectGlobalInventoryView,
} from "./helpers/inventory-queries";
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
