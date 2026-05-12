import type { GameAction } from "../game-actions";
import type { GameState } from "../types";
import { autoAssemblerContext } from "./auto-assembler-context";
import { autoMinerContext } from "./auto-miner-context";
import { autoSmelterContext } from "./auto-smelter-context";
import { constructionContext } from "./construction-context";
import { conveyorContext } from "./conveyor-context";
import { craftingContext } from "./crafting-context";
import { dronesContext } from "./drones-context";
import { inventoryContext } from "./inventory-context";
import { moduleLabContext } from "./module-lab-context";
import { notificationsContext } from "./notifications-context";
import { powerContext } from "./power-context";
import { researchLabContext } from "./research-lab-context";
import { shipContext } from "./ship-context";
import { uiContext } from "./ui-context";
import { warehouseContext } from "./warehouse-context";
import { zoneContext } from "./zone-context";

export type ContextGameReducer = (
  state: GameState,
  action: GameAction,
) => GameState;

/**
 * Applies all implemented Bounded Context reducers to the given state.
 *
 * In Phase 3 this function is NOT wired into the live runtime reducer yet.
 * It is used for testing context composition and verifying slice isolation
 * before the bounded-context reducer becomes the primary implementation path.
 *
 * @param state - Current GameState.
 * @param action - The dispatched GameAction.
 * @returns Partially updated GameState for implemented context slices.
 */
export function applyContextReducers(
  state: GameState,
  action: GameAction,
): GameState {
  let next = state;

  const autoMiner = autoMinerContext.reduce(
    { autoMiners: next.autoMiners },
    action,
  );
  if (autoMiner !== null && autoMiner.autoMiners !== next.autoMiners) {
    next = { ...next, autoMiners: autoMiner.autoMiners };
  }

  const crafting = craftingContext.reduce(
    {
      crafting: next.crafting,
      keepStockByWorkbench: next.keepStockByWorkbench,
      recipeAutomationPolicies: next.recipeAutomationPolicies,
    },
    action,
  );
  if (
    crafting !== null &&
    (crafting.crafting !== next.crafting ||
      crafting.keepStockByWorkbench !== next.keepStockByWorkbench ||
      crafting.recipeAutomationPolicies !== next.recipeAutomationPolicies)
  ) {
    next = { ...next, ...crafting };
  }

  const drones = dronesContext.reduce({ drones: next.drones }, action);
  if (drones !== null && drones.drones !== next.drones) {
    next = { ...next, drones: drones.drones };
  }

  const inventory = inventoryContext.reduce(
    { inventory: next.inventory, network: next.network },
    action,
  );
  if (
    inventory !== null &&
    (inventory.inventory !== next.inventory ||
      inventory.network !== next.network)
  ) {
    next = { ...next, ...inventory };
  }

  const autoSmelter = autoSmelterContext.reduce(
    { autoSmelters: next.autoSmelters },
    action,
  );
  if (autoSmelter !== null && autoSmelter.autoSmelters !== next.autoSmelters) {
    next = { ...next, autoSmelters: autoSmelter.autoSmelters };
  }

  const autoAssembler = autoAssemblerContext.reduce(
    { autoAssemblers: next.autoAssemblers },
    action,
  );
  if (
    autoAssembler !== null &&
    autoAssembler.autoAssemblers !== next.autoAssemblers
  ) {
    next = { ...next, autoAssemblers: autoAssembler.autoAssemblers };
  }

  const researchLab = researchLabContext.reduce(
    { unlockedBuildings: next.unlockedBuildings },
    action,
  );
  if (
    researchLab !== null &&
    researchLab.unlockedBuildings !== next.unlockedBuildings
  ) {
    next = { ...next, unlockedBuildings: researchLab.unlockedBuildings };
  }

  const warehouse = warehouseContext.reduce(
    {
      warehousesPlaced: next.warehousesPlaced,
      warehouseInventories: next.warehouseInventories,
    },
    action,
  );
  if (
    warehouse !== null &&
    (warehouse.warehousesPlaced !== next.warehousesPlaced ||
      warehouse.warehouseInventories !== next.warehouseInventories)
  ) {
    next = { ...next, ...warehouse };
  }

  const power = powerContext.reduce(
    {
      battery: next.battery,
      generators: next.generators,
      poweredMachineIds: next.poweredMachineIds,
      machinePowerRatio: next.machinePowerRatio,
    },
    action,
  );
  if (
    power !== null &&
    (power.battery !== next.battery ||
      power.generators !== next.generators ||
      power.poweredMachineIds !== next.poweredMachineIds ||
      power.machinePowerRatio !== next.machinePowerRatio)
  ) {
    next = { ...next, ...power };
  }

  const moduleLab = moduleLabContext.reduce(
    {
      moduleLabJob: next.moduleLabJob,
      moduleFragments: next.moduleFragments,
      moduleInventory: next.moduleInventory,
    },
    action,
  );
  if (
    moduleLab !== null &&
    (moduleLab.moduleLabJob !== next.moduleLabJob ||
      moduleLab.moduleFragments !== next.moduleFragments ||
      moduleLab.moduleInventory !== next.moduleInventory)
  ) {
    next = { ...next, ...moduleLab };
  }

  const ship = shipContext.reduce({ ship: next.ship }, action);
  if (ship !== null && ship.ship !== next.ship) {
    next = { ...next, ship: ship.ship };
  }

  const notifications = notificationsContext.reduce(
    {
      notifications: next.notifications,
      lastTickError: next.lastTickError,
    },
    action,
  );
  if (
    notifications !== null &&
    (notifications.notifications !== next.notifications ||
      notifications.lastTickError !== next.lastTickError)
  ) {
    next = { ...next, ...notifications };
  }

  const construction = constructionContext.reduce(
    { constructionSites: next.constructionSites, assets: next.assets },
    action,
  );
  if (
    construction !== null &&
    (construction.constructionSites !== next.constructionSites ||
      construction.assets !== next.assets)
  ) {
    next = { ...next, ...construction };
  }

  const conveyor = conveyorContext.reduce(
    {
      conveyors: next.conveyors,
      splitterFilterState: next.splitterFilterState,
    },
    action,
  );
  if (
    conveyor !== null &&
    (conveyor.conveyors !== next.conveyors ||
      conveyor.splitterFilterState !== next.splitterFilterState)
  ) {
    next = { ...next, ...conveyor };
  }

  const zone = zoneContext.reduce(
    {
      productionZones: next.productionZones,
      buildingZoneIds: next.buildingZoneIds,
      buildingSourceWarehouseIds: next.buildingSourceWarehouseIds,
    },
    action,
  );
  if (
    zone !== null &&
    (zone.productionZones !== next.productionZones ||
      zone.buildingZoneIds !== next.buildingZoneIds ||
      zone.buildingSourceWarehouseIds !== next.buildingSourceWarehouseIds)
  ) {
    next = { ...next, ...zone };
  }

  const uiSliceIn = {
    selectedWarehouseId: next.selectedWarehouseId,
    selectedPowerPoleId: next.selectedPowerPoleId,
    selectedAutoMinerId: next.selectedAutoMinerId,
    selectedAutoSmelterId: next.selectedAutoSmelterId,
    selectedAutoAssemblerId: next.selectedAutoAssemblerId,
    selectedGeneratorId: next.selectedGeneratorId,
    selectedServiceHubId: next.selectedServiceHubId,
    selectedCraftingBuildingId: next.selectedCraftingBuildingId,
    selectedSplitterId: next.selectedSplitterId,
    openPanel: next.openPanel,
    notifications: next.notifications,
    buildMode: next.buildMode,
    selectedBuildingType: next.selectedBuildingType,
    selectedFloorTile: next.selectedFloorTile,
    hotbarSlots: next.hotbarSlots,
    activeSlot: next.activeSlot,
    energyDebugOverlay: next.energyDebugOverlay,
    lastTickError: next.lastTickError,
  };
  const ui = uiContext.reduce(uiSliceIn, action);
  if (ui !== null && ui !== uiSliceIn) {
    next = { ...next, ...ui };
  }

  return next;
}

export function applyLiveContextReducers(
  state: GameState,
  action: GameAction,
): GameState | null {
  const notifications = notificationsContext.reduce(
    {
      notifications: state.notifications,
      lastTickError: state.lastTickError,
    },
    action,
  );
  if (notifications !== null) {
    if (
      notifications.notifications === state.notifications &&
      notifications.lastTickError === state.lastTickError
    ) {
      return state;
    }
    return { ...state, ...notifications };
  }

  if (
    action.type === "SET_ACTIVE_SLOT" ||
    action.type === "TOGGLE_PANEL" ||
    action.type === "CLOSE_PANEL" ||
    action.type === "TOGGLE_ENERGY_DEBUG" ||
    action.type === "SELECT_BUILD_BUILDING" ||
    action.type === "SELECT_BUILD_FLOOR_TILE"
  ) {
    const uiSliceIn = {
      selectedWarehouseId: state.selectedWarehouseId,
      selectedPowerPoleId: state.selectedPowerPoleId,
      selectedAutoMinerId: state.selectedAutoMinerId,
      selectedAutoSmelterId: state.selectedAutoSmelterId,
      selectedAutoAssemblerId: state.selectedAutoAssemblerId,
      selectedGeneratorId: state.selectedGeneratorId,
      selectedServiceHubId: state.selectedServiceHubId,
      selectedCraftingBuildingId: state.selectedCraftingBuildingId,
      selectedSplitterId: state.selectedSplitterId,
      openPanel: state.openPanel,
      notifications: state.notifications,
      buildMode: state.buildMode,
      selectedBuildingType: state.selectedBuildingType,
      selectedFloorTile: state.selectedFloorTile,
      hotbarSlots: state.hotbarSlots,
      activeSlot: state.activeSlot,
      energyDebugOverlay: state.energyDebugOverlay,
      lastTickError: state.lastTickError,
    };
    const ui = uiContext.reduce(uiSliceIn, action);
    if (ui === null) return null;
    if (ui === uiSliceIn) return state;
    return { ...state, ...ui };
  }

  return null;
}

/**
 * Creates the Phase 3 bounded-context reducer facade.
 *
 * The returned reducer is intentionally not wired into the live store yet.
 */
export function createGameReducer(): ContextGameReducer {
  return applyContextReducers;
}
