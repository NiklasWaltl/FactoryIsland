import type { GameAction } from "../game-actions";
import type { GameState } from "../types";
import { BUILDING_COSTS } from "../constants/buildings/index";
import { invalidateRoutingIndexCache } from "../helpers/routing-index-cache";
import { hasWarehouseAssetWithInventory } from "../utils/asset-guards";
import { isUnderConstruction } from "../helpers/asset-status";
import { computeConnectedAssetIds } from "../../logistics/connectivity";
import { runEnergyNetTick } from "../energy/energy-net-tick";
import { handlePlaceBuildingAction } from "../action-handlers/building-placement/place-building";
import { handleRemoveAssetAction } from "../action-handlers/building-placement/remove-asset";
import { type BuildingPlacementIoDeps } from "../action-handlers/building-placement";
import {
  type BuildingSiteActionDeps,
  handleBuildingSiteAction,
} from "../action-handlers/building-site";
import { addErrorNotification, addNotification } from "../utils/notifications";
import { makeId } from "../utils/make-id";
import { debugLog } from "../../debug/debugLogger";
import { fullCostAsRemaining } from "../inventory-ops";
import { addAutoDelivery, tickOneDrone } from "../helpers/reducer-helpers";
import {
  type DroneTickActionDeps,
  handleDroneTickAction,
} from "../action-handlers/drone-tick-actions";
import {
  type LogisticsTickIoDeps,
  handleLogisticsTickAction,
} from "../action-handlers/logistics-tick";
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

// Mirrors action-handlers/building-placement/remove-asset.ts:55-94. The
// deconstruct eligibility gate reads hotbarSlots, activeSlot and buildMode —
// all outside ConstructionContextState — so we replicate the gate in the
// live-switch wrapper rather than expanding the slice. Behaviour stays
// identical to the legacy handler.
function isDeconstructEligible(
  state: Pick<GameState, "buildMode" | "hotbarSlots" | "activeSlot" | "assets">,
  assetId: string,
): boolean {
  const activeHotbarSlot = state.hotbarSlots[state.activeSlot];
  const removeToolActive =
    state.buildMode || activeHotbarSlot?.toolKind === "building";
  if (!removeToolActive) return false;
  const targetAsset = state.assets[assetId];
  if (!targetAsset) return false;
  if (!(targetAsset.type in BUILDING_COSTS)) return false;
  if (targetAsset.fixed) return false;
  return true;
}

// Mirrors the connectivity/cache recompute in markAssetAsDeconstructing /
// clearAssetDeconstructingStatus from
// action-handlers/building-placement/request-deconstruct.ts:39-43,64-68.
// Pulled into the wrapper because computeConnectedAssetIds needs `cellMap`
// and `constructionSites` reads that are outside ConstructionContextState.
function recomputeConnectivityAndInvalidateCache(state: GameState): GameState {
  return invalidateRoutingIndexCache({
    ...state,
    connectedAssetIds: computeConnectedAssetIds(state),
  });
}

// Mirrors BUILDING_PLACEMENT_IO_DEPS in action-handler-deps.ts:177-181.
// Duplicated here as a frozen module-local constant so create-game-reducer.ts
// stays decoupled from the legacy action-handler-deps barrel — the same reason
// runEnergyNetTick is imported directly rather than going through the
// dispatcher's DI container.
const PLACEMENT_LIVE_DEPS: BuildingPlacementIoDeps = {
  makeId,
  addErrorNotification,
  debugLog,
};

// Mirrors BUILDING_SITE_ACTION_DEPS in action-handler-deps.ts:183-188.
// Same decoupling rationale as PLACEMENT_LIVE_DEPS — kept module-local so
// the live-switch does not pull in the legacy DI barrel.
const BUILDING_SITE_LIVE_DEPS: BuildingSiteActionDeps = {
  isUnderConstruction,
  addErrorNotification,
  fullCostAsRemaining,
  debugLog,
};

// Mirrors DRONE_TICK_ACTION_DEPS in action-handler-deps.ts:225-227.
// Same decoupling rationale as PLACEMENT_LIVE_DEPS — the live switch
// keeps a module-local frozen deps object so create-game-reducer.ts
// does not import the legacy DI barrel. `tickOneDrone` is the
// reducer-helpers wrapper that bundles TICK_ONE_DRONE_IO_DEPS.
const DRONE_TICK_LIVE_DEPS: DroneTickActionDeps = {
  tickOneDrone,
};

// Mirrors LOGISTICS_TICK_IO_DEPS in action-handler-deps.ts:229-232.
// Same decoupling rationale as the other LIVE_DEPS constants above.
// Both helpers are pure (no captured state) — `addNotification` lives in
// utils/notifications, `addAutoDelivery` is the reducer-helpers function
// that wraps `makeId` + AUTO_DELIVERY_BATCH_WINDOW_MS / LOG_MAX.
const LOGISTICS_TICK_LIVE_DEPS: LogisticsTickIoDeps = {
  addNotification,
  addAutoDelivery,
};

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
      selectedGeneratorId: next.selectedGeneratorId,
      constructionSites: next.constructionSites,
      assets: next.assets,
      notifications: next.notifications,
      inventory: next.inventory,
      warehouseInventories: next.warehouseInventories,
      buildingZoneIds: next.buildingZoneIds,
      productionZones: next.productionZones,
      buildingSourceWarehouseIds: next.buildingSourceWarehouseIds,
      mode: next.mode,
    },
    action,
  );
  if (
    power !== null &&
    (power.battery !== next.battery ||
      power.generators !== next.generators ||
      power.poweredMachineIds !== next.poweredMachineIds ||
      power.machinePowerRatio !== next.machinePowerRatio ||
      power.notifications !== next.notifications ||
      power.inventory !== next.inventory ||
      power.warehouseInventories !== next.warehouseInventories ||
      power.assets !== next.assets)
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

  if (action.type === "ENERGY_NET_TICK") {
    // ENERGY_NET_TICK is a pure GameState→GameState transformation
    // (battery, poweredMachineIds, machinePowerRatio) that reads ~8 slices
    // (assets, cellMap, connectedAssetIds, autoSmelters, autoAssemblers,
    // constructionSites, generators, battery). Mirroring it through
    // PowerContextState would force the slice to widen beyond what any
    // other Power action needs. Strategy fixed 2026-05-16: live-wire it
    // as a direct wrapper here — the power context keeps a no-op stub.
    // Mirrors game-reducer-dispatch.ts:210-212 verbatim.
    return runEnergyNetTick(state);
  }

  if (
    action.type === "GENERATOR_START" ||
    action.type === "GENERATOR_STOP" ||
    action.type === "REMOVE_POWER_POLE" ||
    action.type === "GENERATOR_REQUEST_REFILL" ||
    action.type === "GENERATOR_TICK" ||
    action.type === "GENERATOR_ADD_FUEL" ||
    action.type === "SET_MACHINE_PRIORITY" ||
    action.type === "SET_MACHINE_BOOST"
  ) {
    // GENERATOR_START/STOP write only `generators` and read
    // `selectedGeneratorId` + `constructionSites` from PowerContextState.
    // REMOVE_POWER_POLE is a no-op in the legacy path too (pole removal
    // runs via BUILD_REMOVE_ASSET) — live-switching keeps the same
    // behaviour.
    // GENERATOR_REQUEST_REFILL writes `generators` (or `notifications` on
    // the empty-headroom path) and reads `selectedGeneratorId` +
    // `constructionSites`.
    // GENERATOR_TICK iterates `generators`, reading `assets[id].status`
    // (deconstructing) + `constructionSites[id]`.
    // GENERATOR_ADD_FUEL writes `generators` AND `inventory` OR
    // `warehouseInventories` (resolved via crafting-source helpers using
    // `buildingZoneIds`, `productionZones`, `buildingSourceWarehouseIds`,
    // `mode`).
    // SET_MACHINE_PRIORITY / SET_MACHINE_BOOST write `assets[id].priority`
    // resp. `assets[id].boosted`. Both read only `assets[id].type` for the
    // consumer/boost-eligibility gate — fully covered by PowerContextState.
    // Mirrors:
    //   action-handlers/machine-actions/phases/generator-toggle-phase.ts
    //   action-handlers/machine-actions/phases/generator-fuel-phase.ts
    //   action-handlers/machine-actions/phases/generator-tick-phase.ts
    //   action-handlers/maintenance-actions/phases/remove-power-pole-phase.ts
    //   action-handlers/machine-config.ts (SET_MACHINE_PRIORITY/BOOST cases)
    const powerSliceIn = {
      battery: state.battery,
      generators: state.generators,
      poweredMachineIds: state.poweredMachineIds,
      machinePowerRatio: state.machinePowerRatio,
      selectedGeneratorId: state.selectedGeneratorId,
      constructionSites: state.constructionSites,
      assets: state.assets,
      notifications: state.notifications,
      inventory: state.inventory,
      warehouseInventories: state.warehouseInventories,
      buildingZoneIds: state.buildingZoneIds,
      productionZones: state.productionZones,
      buildingSourceWarehouseIds: state.buildingSourceWarehouseIds,
      mode: state.mode,
    };
    const power = powerContext.reduce(powerSliceIn, action);
    if (power === null) return null;
    if (power === powerSliceIn) return state;
    return { ...state, ...power };
  }

  if (
    action.type === "REQUEST_DECONSTRUCT_ASSET" ||
    action.type === "CANCEL_DECONSTRUCT_ASSET"
  ) {
    // Cross-slice eligibility gate — mirrors decideRemoveAssetEligibility in
    // action-handlers/building-placement/remove-asset.ts:55-94. Reads
    // buildMode/hotbarSlots/activeSlot, which stay outside the construction
    // slice for the same reason assets stays out of ZoneContextState.
    if (!isDeconstructEligible(state, action.assetId)) return state;

    // CANCEL additionally requires the asset to already be deconstructing —
    // mirrors handleCancelDeconstructAssetAction:99-100. Catching this in the
    // wrapper avoids a no-op connectivity recompute below.
    if (action.type === "CANCEL_DECONSTRUCT_ASSET") {
      if (state.assets[action.assetId]?.status !== "deconstructing") {
        return state;
      }
    }

    const constructionSliceIn = {
      assets: state.assets,
      constructionSites: state.constructionSites,
    };
    const construction = constructionContext.reduce(
      constructionSliceIn,
      action,
    );
    if (construction === null) return null;
    if (construction === constructionSliceIn) return state;

    // Status flip on `assets` invalidates the energy network and the conveyor
    // routing index — mirrors markAssetAsDeconstructing /
    // clearAssetDeconstructingStatus side effects.
    return recomputeConnectivityAndInvalidateCache({
      ...state,
      ...construction,
    });
  }

  if (action.type === "BUILD_PLACE_BUILDING") {
    // BUILD_PLACE_BUILDING writes ~19 slices across 22 reads — far too wide
    // for any single bounded context to own without becoming a GameState
    // clone. Strategy fixed 2026-05-16 (Option B): live-wire the legacy
    // pure-on-GameState handler here. handlePlaceBuildingAction already
    // returns `state` unchanged on guard violations (place-building.ts:59,70)
    // or `state` with an appended error notification via the injected
    // addErrorNotification dep — no separate eligibility wrapper needed.
    // finalizePlacement (place-building-shared.ts:159-170) recomputes
    // connectedAssetIds and invalidates routingIndexCache before returning.
    // Same direct-delegation pattern as runEnergyNetTick.
    return handlePlaceBuildingAction(state, action, PLACEMENT_LIVE_DEPS);
  }

  if (action.type === "BUILD_REMOVE_ASSET") {
    // Mirror of BUILD_PLACE_BUILDING. handleRemoveAssetAction wraps
    // executeGenericRemoveAsset, which gates via decideRemoveAssetEligibility
    // (remove-asset.ts:55-94, reads buildMode/hotbarSlots/activeSlot/assets
    // internally) and short-circuits to the unmutated state when blocked.
    // Side effects identical to PLACE: invalidateRoutingIndexCache +
    // computeConnectedAssetIds are inlined in executeGenericRemoveAsset
    // (remove-asset.ts:482-485). Direct delegation suffices.
    return handleRemoveAssetAction(state, action, PLACEMENT_LIVE_DEPS);
  }

  if (action.type === "REMOVE_BUILDING") {
    // No-op marker — runRemoveBuildingPhase (maintenance-actions/phases/
    // remove-building-phase.ts) has been `state => state` since
    // BUILD_REMOVE_ASSET took over building removal in Build Mode.
    // Live-switched for migration completeness; behaviour is identical.
    return state;
  }

  if (action.type === "UPGRADE_HUB") {
    // Option B — direct wrapper analogous to BUILD_PLACE_BUILDING.
    // handleBuildingSiteAction's UPGRADE_HUB case (building-site.ts:105-179)
    // returns `state` (or `state` with an appended error notification via
    // deps.addErrorNotification) on every guard violation
    // (isUnderConstruction, tier !== 1, pendingUpgrade, insufficient
    // resources). The `?? state` is defensive against the switch's
    // `default: return null` branch — currently unreachable because the
    // live-switch only routes UPGRADE_HUB here, but kept to mirror the
    // wrapper-vs-cluster-handler contract used elsewhere in this file.
    return (
      handleBuildingSiteAction(state, action, BUILDING_SITE_LIVE_DEPS) ?? state
    );
  }

  if (action.type === "DRONE_TICK") {
    // Option B — direct wrapper analogous to BUILD_PLACE_BUILDING /
    // UPGRADE_HUB. handleDroneTickAction iterates state.drones and runs
    // tickOneDrone per entry. Pure (state, action, deps) → GameState; no
    // guards (no isPaused / isGameOver in this codebase), empty drones map
    // is handled implicitly by the zero-iteration loop in
    // runDroneTickPhase. Placed BEFORE the LOGISTICS_TICK wrapper to mirror
    // the dispatcher ordering (game-reducer-dispatch.ts:159 vs :177).
    // Shadow-diff suppressions for the cross-context writes (drones,
    // crafting, network, inventory, …) are pre-existing — see
    // shadow-diff.ts:67-85.
    // The `?? state` is defensive against the cluster's
    // `default: return null` branch, currently unreachable because the
    // live-switch only routes DRONE_TICK here.
    return handleDroneTickAction(state, action, DRONE_TICK_LIVE_DEPS) ?? state;
  }

  if (action.type === "LOGISTICS_TICK") {
    // Option B — direct wrapper. handleLogisticsTickAction is a pure
    // (state, deps) → GameState orchestrator over four phases
    // (auto-miner, conveyor, auto-smelter, auto-assembler). The handler
    // always returns at least { ...state, routingIndexCache } even when
    // no slice mutated, because getOrBuildRoutingIndex runs
    // unconditionally in Phase 0. No guards exist in the legacy path.
    // Mirrors game-reducer-dispatch.ts:177-181 verbatim.
    // Shadow-diff suppressions for cross-context writes (autoMiners,
    // autoSmelters, autoAssemblers, inventory) are pre-existing — see
    // shadow-diff.ts:65.
    return handleLogisticsTickAction(state, LOGISTICS_TICK_LIVE_DEPS);
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
