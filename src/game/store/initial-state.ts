// ============================================================
// INITIAL STATE
// ------------------------------------------------------------
// Fresh runtime state. Dev/test scenes are applied from src/game/dev via the
// entry bootstrap in DEV builds after this new-game baseline is created.
// ============================================================

import { createEmptyNetworkSlice } from "../inventory/reservationTypes";
import { createEmptyCraftingQueue } from "../crafting/queue";
import { GRID_H, GRID_W } from "../constants/grid";
import { generateIslandTileMap } from "../world/island-generator";
import { createFixedResourcePlacement } from "../world/fixed-resource-layout";
import { applyBaseStartLayout } from "./bootstrap/apply-base-start-layout";
import { applyDockWarehouseLayout } from "./bootstrap/apply-dock-warehouse-layout";
import { createInitialHotbar } from "./helpers/hotbar";
import type {
  GameMode,
  GameState,
  Inventory,
  StarterDroneState,
} from "./types";
import { createEmptyInventory } from "./inventory-ops";
import { BATTERY_CAPACITY } from "./constants/energy/battery";
import type { ShipState } from "./types/ship-types";

export function createInitialShipState(): ShipState {
  return {
    status: "sailing",
    activeQuest: null,
    nextQuest: null,
    dockedAt: null,
    departsAt: null,
    departureAt: null,
    returnsAt: Date.now() + 30_000,
    rewardPending: false,
    lastReward: null,
    questPhase: 1,
    shipsSinceLastFragment: 0,
    pityCounter: 0,
    pendingMultiplier: 1,
  };
}

export function createInitialState(mode: GameMode = "release"): GameState {
  const inventory: Inventory = {
    ...createEmptyInventory(),
    coins: 1000,
  };
  const tileMap = generateIslandTileMap(GRID_H, GRID_W);
  const fixedResources = createFixedResourcePlacement(tileMap);

  const starterDrone: StarterDroneState = {
    status: "idle",
    tileX: 0,
    tileY: 0,
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    hubId: null,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
    droneId: "starter",
  };

  const state: GameState = {
    mode,
    assets: fixedResources.assets,
    cellMap: fixedResources.cellMap,
    tileMap,
    inventory,
    moduleInventory: [],
    moduleFragments: 0,
    moduleLabJob: null,
    purchasedBuildings: [],
    placedBuildings: [],
    warehousesPurchased: 0,
    warehousesPlaced: 0,
    warehouseInventories: {},
    selectedWarehouseId: null,
    cablesPlaced: 0,
    powerPolesPlaced: 0,
    selectedPowerPoleId: null,
    hotbarSlots: createInitialHotbar(),
    activeSlot: 0,
    smithy: {
      fuel: 0,
      iron: 0,
      copper: 0,
      selectedRecipe: "iron",
      processing: false,
      progress: 0,
      outputIngots: 0,
      outputCopperIngots: 0,
      buildingId: null,
    },
    generators: {},
    battery: { stored: 0, capacity: BATTERY_CAPACITY },
    connectedAssetIds: [],
    poweredMachineIds: [],
    openPanel: null,
    notifications: [],
    saplingGrowAt: {},
    buildMode: false,
    selectedBuildingType: null,
    selectedFloorTile: null,
    floorMap: {},
    autoMiners: {},
    conveyors: {},
    conveyorUndergroundPeers: {},
    selectedAutoMinerId: null,
    autoSmelters: {},
    selectedAutoSmelterId: null,
    autoAssemblers: {},
    selectedAutoAssemblerId: null,
    selectedGeneratorId: null,
    selectedServiceHubId: null,
    manualAssembler: {
      processing: false,
      recipe: null,
      progress: 0,
      buildingId: null,
    },
    machinePowerRatio: {},
    energyDebugOverlay: false,
    autoDeliveryLog: [],
    buildingSourceWarehouseIds: {},
    productionZones: {},
    buildingZoneIds: {},
    selectedCraftingBuildingId: null,
    collectionNodes: {},
    starterDrone,
    drones: { starter: starterDrone },
    serviceHubs: {},
    constructionSites: {},
    network: createEmptyNetworkSlice(),
    crafting: createEmptyCraftingQueue(),
    keepStockByWorkbench: {},
    recipeAutomationPolicies: {},
    splitterRouteState: {},
    splitterFilterState: {},
    selectedSplitterId: null,
    ship: createInitialShipState(),
  };

  return applyDockWarehouseLayout(applyBaseStartLayout(state));
}
