import type { GameAction } from "../game-actions";
import type { GameState } from "../types";
import { invalidateRoutingIndexCache } from "../helpers/routing-index-cache";
import { hasWarehouseAssetWithInventory } from "../utils/asset-guards";
import { isUnderConstruction } from "../helpers/asset-status";
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

function invalidateIfCraftingChanged(
  previousState: GameState,
  nextState: GameState,
): GameState {
  if (nextState.crafting === previousState.crafting) return nextState;
  return getRoutingRelevantCraftingSignature(nextState) ===
    getRoutingRelevantCraftingSignature(previousState)
    ? nextState
    : invalidateRoutingIndexCache(nextState);
}

function getRoutingRelevantCraftingSignature(state: GameState): string {
  return state.crafting.jobs
    .filter((job) => job.status !== "done" && job.status !== "cancelled")
    .map((job) => {
      const ingredients = job.ingredients
        .map((ingredient) => `${ingredient.itemId}:${ingredient.count}`)
        .join(",");
      return `${job.id}:${job.workbenchId}:${job.status}:${ingredients}`;
    })
    .join("|");
}

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
      assets: next.assets,
      crafting: next.crafting,
      keepStockByWorkbench: next.keepStockByWorkbench,
      recipeAutomationPolicies: next.recipeAutomationPolicies,
      network: next.network,
      notifications: next.notifications,
      constructionSites: next.constructionSites,
      buildingZoneIds: next.buildingZoneIds,
      productionZones: next.productionZones,
      buildingSourceWarehouseIds: next.buildingSourceWarehouseIds,
      warehouseInventories: next.warehouseInventories,
      serviceHubs: next.serviceHubs,
    },
    action,
  );
  if (
    crafting !== null &&
    (crafting.crafting !== next.crafting ||
      crafting.keepStockByWorkbench !== next.keepStockByWorkbench ||
      crafting.recipeAutomationPolicies !== next.recipeAutomationPolicies ||
      crafting.network !== next.network ||
      crafting.notifications !== next.notifications)
  ) {
    next = { ...next, ...crafting };
  }

  const drones = dronesContext.reduce({ drones: next.drones }, action);
  if (drones !== null && drones.drones !== next.drones) {
    next = { ...next, drones: drones.drones };
  }

  const inventory = inventoryContext.reduce(
    {
      inventory: next.inventory,
      network: next.network,
      warehouseInventories: next.warehouseInventories,
    },
    action,
  );
  if (
    inventory !== null &&
    (inventory.inventory !== next.inventory ||
      inventory.network !== next.network ||
      inventory.warehouseInventories !== next.warehouseInventories)
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
    {
      unlockedBuildings: next.unlockedBuildings,
      inventory: next.inventory,
      notifications: next.notifications,
    },
    action,
  );
  if (
    researchLab !== null &&
    (researchLab.unlockedBuildings !== next.unlockedBuildings ||
      researchLab.inventory !== next.inventory ||
      researchLab.notifications !== next.notifications)
  ) {
    next = { ...next, ...researchLab };
  }

  const warehouse = warehouseContext.reduce(
    {
      warehousesPlaced: next.warehousesPlaced,
      warehouseInventories: next.warehouseInventories,
      inventory: next.inventory,
      selectedWarehouseId: next.selectedWarehouseId,
      mode: next.mode,
      hotbarSlots: next.hotbarSlots,
      notifications: next.notifications,
    },
    action,
  );
  if (
    warehouse !== null &&
    (warehouse.warehousesPlaced !== next.warehousesPlaced ||
      warehouse.warehouseInventories !== next.warehouseInventories ||
      warehouse.inventory !== next.inventory ||
      warehouse.hotbarSlots !== next.hotbarSlots ||
      warehouse.notifications !== next.notifications)
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
      assets: next.assets,
      notifications: next.notifications,
    },
    action,
  );
  if (
    moduleLab !== null &&
    (moduleLab.moduleLabJob !== next.moduleLabJob ||
      moduleLab.moduleFragments !== next.moduleFragments ||
      moduleLab.moduleInventory !== next.moduleInventory ||
      moduleLab.assets !== next.assets ||
      moduleLab.notifications !== next.notifications)
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
    action.type === "CREATE_ZONE" ||
    action.type === "DELETE_ZONE" ||
    action.type === "SET_ZONE_NAME" ||
    action.type === "SET_ZONE_COLOR" ||
    action.type === "CLEAR_ALL_BUILDING_ZONES" ||
    action.type === "SET_BUILDING_ZONE" ||
    action.type === "SET_BUILDING_SOURCE"
  ) {
    // hasAsset guard lives outside ZoneContextState (the slice does not
    // include `assets`). Mirror the legacy zone-actions.ts:94 behaviour
    // here so SET_BUILDING_ZONE rejects unknown buildingIds before they
    // can be written into buildingZoneIds.
    if (
      action.type === "SET_BUILDING_ZONE" &&
      !state.assets[action.buildingId]
    ) {
      return state;
    }
    // Mirror legacy building-site.ts:67-98 guards for SET_BUILDING_SOURCE:
    // buildingId must exist, and when warehouseId is set, the warehouse
    // must exist with a live inventory. Both checks rely on `assets` /
    // `warehouseInventories`, which are not part of ZoneContextState.
    if (action.type === "SET_BUILDING_SOURCE") {
      if (!state.assets[action.buildingId]) return state;
      if (
        action.warehouseId !== null &&
        !hasWarehouseAssetWithInventory(state, action.warehouseId)
      ) {
        return state;
      }
    }
    const zoneSliceIn = {
      productionZones: state.productionZones,
      buildingZoneIds: state.buildingZoneIds,
      buildingSourceWarehouseIds: state.buildingSourceWarehouseIds,
      routingIndexCache: state.routingIndexCache,
    };
    const zone = zoneContext.reduce(zoneSliceIn, action);
    if (zone === null) return null;
    if (zone === zoneSliceIn) return state;
    return { ...state, ...zone };
  }

  if (
    action.type === "NETWORK_RESERVE_BATCH" ||
    action.type === "NETWORK_CANCEL_RESERVATION" ||
    action.type === "NETWORK_CANCEL_BY_OWNER" ||
    action.type === "NETWORK_COMMIT_RESERVATION" ||
    action.type === "NETWORK_COMMIT_BY_OWNER"
  ) {
    const inventorySliceIn = {
      inventory: state.inventory,
      network: state.network,
      warehouseInventories: state.warehouseInventories,
    };
    const inventory = inventoryContext.reduce(inventorySliceIn, action);
    if (inventory === null) return null;
    if (inventory === inventorySliceIn) return state;
    // invalidateIfCraftingChanged intentionally omitted: COMMIT_* does not
    // mutate state.crafting or state.routingIndexCache. Pre-condition
    // belegt durch shadow-diff.test.ts:
    // - "NETWORK_COMMIT_RESERVATION does not mutate crafting or routingIndexCache (legacy)"
    // - "NETWORK_COMMIT_BY_OWNER does not mutate crafting or routingIndexCache (legacy)"
    return { ...state, ...inventory };
  }

  if (
    action.type === "TRANSFER_TO_WAREHOUSE" ||
    action.type === "TRANSFER_FROM_WAREHOUSE" ||
    action.type === "EQUIP_FROM_WAREHOUSE" ||
    action.type === "EQUIP_BUILDING_FROM_WAREHOUSE" ||
    action.type === "REMOVE_FROM_HOTBAR"
  ) {
    // isUnderConstruction reads state.constructionSites, which is outside
    // WarehouseContextState. Mirror the legacy hotbar-transfer-phase guard
    // here (constructionSites stays out of the slice for the same reason
    // assets stays out of ZoneContextState). The guard is only applied to
    // TRANSFER_*: equip/remove legacy paths (hotbar-equip-phase.ts,
    // hotbar-remove-phase.ts) intentionally do NOT block under-construction
    // warehouses, so the live switch keeps that behaviour.
    if (
      action.type === "TRANSFER_TO_WAREHOUSE" ||
      action.type === "TRANSFER_FROM_WAREHOUSE"
    ) {
      const whId = state.selectedWarehouseId;
      if (whId && isUnderConstruction(state, whId)) return state;
    }
    const warehouseSliceIn = {
      warehousesPlaced: state.warehousesPlaced,
      warehouseInventories: state.warehouseInventories,
      inventory: state.inventory,
      selectedWarehouseId: state.selectedWarehouseId,
      mode: state.mode,
      hotbarSlots: state.hotbarSlots,
      notifications: state.notifications,
    };
    const warehouse = warehouseContext.reduce(warehouseSliceIn, action);
    if (warehouse === null) return null;
    if (warehouse === warehouseSliceIn) return state;
    return { ...state, ...warehouse };
  }

  if (
    action.type === "JOB_CANCEL" ||
    action.type === "JOB_PAUSE" ||
    action.type === "JOB_MOVE" ||
    action.type === "JOB_SET_PRIORITY" ||
    action.type === "JOB_ENQUEUE" ||
    action.type === "CRAFT_REQUEST_WITH_PREREQUISITES" ||
    action.type === "SET_KEEP_STOCK_TARGET" ||
    action.type === "SET_RECIPE_AUTOMATION_POLICY"
  ) {
    const craftingSliceIn = {
      assets: state.assets,
      crafting: state.crafting,
      keepStockByWorkbench: state.keepStockByWorkbench,
      recipeAutomationPolicies: state.recipeAutomationPolicies,
      network: state.network,
      notifications: state.notifications,
      constructionSites: state.constructionSites,
      buildingZoneIds: state.buildingZoneIds,
      productionZones: state.productionZones,
      buildingSourceWarehouseIds: state.buildingSourceWarehouseIds,
      warehouseInventories: state.warehouseInventories,
      serviceHubs: state.serviceHubs,
    };
    const crafting = craftingContext.reduce(craftingSliceIn, action);
    if (crafting === null) return null;
    if (crafting === craftingSliceIn) return state;
    const next = { ...state, ...crafting };
    if (
      action.type !== "JOB_CANCEL" &&
      action.type !== "JOB_PAUSE" &&
      action.type !== "JOB_ENQUEUE" &&
      action.type !== "CRAFT_REQUEST_WITH_PREREQUISITES"
    ) {
      return next;
    }
    return invalidateIfCraftingChanged(state, next);
  }

  if (
    action.type === "AUTO_SMELTER_SET_RECIPE" ||
    action.type === "AUTO_ASSEMBLER_SET_RECIPE"
  ) {
    // isUnderConstruction reads state.constructionSites, which is outside both
    // AutoSmelterContextState and AutoAssemblerContextState. Mirror the legacy
    // gate (auto-smelter-set-recipe-phase.ts:15 and auto-assembler-actions.ts:18)
    // here so the live switch keeps recipe changes blocked while the machine is
    // still a construction site.
    if (isUnderConstruction(state, action.assetId)) return state;

    if (action.type === "AUTO_SMELTER_SET_RECIPE") {
      const smelterSliceIn = { autoSmelters: state.autoSmelters };
      const smelter = autoSmelterContext.reduce(smelterSliceIn, action);
      if (smelter === null) return null;
      if (smelter === smelterSliceIn) return state;
      return { ...state, ...smelter };
    }

    const assemblerSliceIn = { autoAssemblers: state.autoAssemblers };
    const assembler = autoAssemblerContext.reduce(assemblerSliceIn, action);
    if (assembler === null) return null;
    if (assembler === assemblerSliceIn) return state;
    return { ...state, ...assembler };
  }

  if (action.type === "RESEARCH_BUILDING") {
    // All slices RESEARCH_BUILDING touches (inventory, unlockedBuildings,
    // notifications) are inside ResearchLabContextState — no cross-slice
    // wrapper needed. Mirrors action-handlers/research.ts:46-93.
    const researchSliceIn = {
      unlockedBuildings: state.unlockedBuildings,
      inventory: state.inventory,
      notifications: state.notifications,
    };
    const research = researchLabContext.reduce(researchSliceIn, action);
    if (research === null) return null;
    if (research === researchSliceIn) return state;
    return { ...state, ...research };
  }

  if (
    action.type === "START_MODULE_CRAFT" ||
    action.type === "MODULE_LAB_TICK" ||
    action.type === "COLLECT_MODULE" ||
    action.type === "PLACE_MODULE" ||
    action.type === "REMOVE_MODULE"
  ) {
    // All slices touched by these actions (moduleLabJob, moduleFragments,
    // moduleInventory, assets.moduleSlot, notifications) are inside
    // ModuleLabContextState — no cross-slice wrapper needed. Mirrors
    // action-handlers/module-lab-actions.ts.
    const moduleLabSliceIn = {
      moduleLabJob: state.moduleLabJob,
      moduleFragments: state.moduleFragments,
      moduleInventory: state.moduleInventory,
      assets: state.assets,
      notifications: state.notifications,
    };
    const moduleLab = moduleLabContext.reduce(moduleLabSliceIn, action);
    if (moduleLab === null) return null;
    if (moduleLab === moduleLabSliceIn) return state;
    return { ...state, ...moduleLab };
  }

  if (action.type === "SET_SPLITTER_FILTER") {
    // The asset-gate (state.assets[splitterId] must exist AND be a
    // conveyor_splitter) reads outside ConveyorContextState. Mirror the
    // legacy guard from machine-config.ts:86-87 here so the live switch
    // keeps the same behaviour: the context drops the gate (see
    // shadow-diff.test.ts:217-236), but the live wrapper restores it.
    const splitterAsset = state.assets[action.splitterId];
    if (!splitterAsset || splitterAsset.type !== "conveyor_splitter") {
      return state;
    }
    const conveyorSliceIn = {
      conveyors: state.conveyors,
      splitterFilterState: state.splitterFilterState,
    };
    const conveyor = conveyorContext.reduce(conveyorSliceIn, action);
    if (conveyor === null) return null;
    if (conveyor === conveyorSliceIn) return state;
    return { ...state, ...conveyor };
  }

  if (
    action.type === "SET_ACTIVE_SLOT" ||
    action.type === "TOGGLE_PANEL" ||
    action.type === "CLOSE_PANEL" ||
    action.type === "TOGGLE_ENERGY_DEBUG" ||
    action.type === "TOGGLE_BUILD_MODE" ||
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
