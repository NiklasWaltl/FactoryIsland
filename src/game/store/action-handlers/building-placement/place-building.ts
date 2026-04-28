import type { GameAction } from "../../actions";
import type {
  GameState,
  Inventory,
  StarterDroneState,
} from "../../types";
import { GRID_W, GRID_H } from "../../../constants/grid";
import {
  BUILDING_COSTS,
  BUILDING_LABELS,
  BUILDING_SIZES,
  BUILDINGS_WITH_DEFAULT_SOURCE,
  CONSTRUCTION_SITE_BUILDINGS,
  MAX_WAREHOUSES,
  REQUIRES_STONE_FLOOR,
  STACKABLE_BUILDINGS,
} from "../../constants/buildings";
import { createDefaultProtoHubTargetStock } from "../../constants/hub/hub-target-stock";
import { placeAsset } from "../../asset-mutation";
import {
  consumeBuildResources,
  costIsFullyCollectable,
  createEmptyInventory,
  fullCostAsRemaining,
  getEffectiveBuildInventory,
  hasResources,
} from "../../inventory-ops";
import { decideBuildingPlacementEligibility } from "../../build-placement-eligibility";
import { getNearestWarehouseId } from "../../../buildings/warehouse/warehouse-assignment";
import { createEmptyHubInventory } from "../../../buildings/service-hub/hub-upgrade-workflow";
import { getDroneDockOffset } from "../../../drones/drone-dock-geometry";
import { type BuildingPlacementIoDeps } from "./shared";
import {
  placeConveyorBranch,
  placeUndergroundInBranch,
  placeUndergroundOutBranch,
} from "./place-conveyors";
import {
  placeAutoMinerBranch,
  placeAutoSmelterBranch,
  placeAutoAssemblerBranch,
} from "./place-special-machines";
import {
  getBuildPlacementNotificationForDecision,
  finalizePlacement,
} from "./place-building-shared";

export function handlePlaceBuildingAction(
  state: GameState,
  action: Extract<GameAction, { type: "BUILD_PLACE_BUILDING" }>,
  deps: BuildingPlacementIoDeps,
): GameState {
  const { makeId, addErrorNotification, debugLog } = deps;

  const activeHotbarSlot = state.hotbarSlots[state.activeSlot];
  const hotbarBuildingType =
    activeHotbarSlot?.toolKind === "building"
      ? activeHotbarSlot.buildingType ?? null
      : null;
  const bType = state.buildMode ? state.selectedBuildingType : hotbarBuildingType;
  if (!bType) return state;
  const { x, y } = action;
  if (x < 0 || y < 0 || x >= GRID_W || y >= GRID_H) return state;

  // Cost + generic placement eligibility check
  const costs = BUILDING_COSTS[bType];
  // Construction site eligibility: building supports it AND a service hub exists.
  // Eligible buildings ALWAYS go through construction-site flow (drone supplies resources).
  const hasActiveHub = Object.values(state.assets).some((a) => a.type === "service_hub");
  const useConstructionSite = CONSTRUCTION_SITE_BUILDINGS.has(bType) && hasActiveHub
    && costIsFullyCollectable(costs);

  const applyCostOrConstructionSite = (
    partial: GameState,
    placedAssetId: string,
  ): GameState => {
    if (useConstructionSite) {
      return {
        ...partial,
        constructionSites: {
          ...state.constructionSites,
          [placedAssetId]: {
            buildingType: bType,
            remaining: fullCostAsRemaining(costs),
          },
        },
      };
    }

    const consumed = consumeBuildResources(
      state,
      costs as Partial<Record<keyof Inventory, number>>,
    );
    return {
      ...partial,
      inventory: consumed.inventory,
      warehouseInventories: consumed.warehouseInventories,
      serviceHubs: consumed.serviceHubs,
    };
  };

  const bSize = BUILDING_SIZES[bType] ?? 2;
  const runStandardPlacementChecks =
    bType !== "auto_miner" &&
    bType !== "conveyor" &&
    bType !== "conveyor_corner" &&
    bType !== "conveyor_merger" &&
    bType !== "conveyor_splitter" &&
    bType !== "conveyor_underground_in" &&
    bType !== "conveyor_underground_out" &&
    bType !== "auto_smelter" &&
    bType !== "auto_assembler";
  const eligibilityDecision = decideBuildingPlacementEligibility({
    buildingType: bType,
    hasEnoughResources:
      useConstructionSite ||
      hasResources(getEffectiveBuildInventory(state), costs as Partial<Record<keyof Inventory, number>>),
    hasWorkbenchPlaced: Object.values(state.assets).some((a) => a.type === "workbench"),
    isStackableBuilding: STACKABLE_BUILDINGS.has(bType),
    placedBuildingCountOfType: state.placedBuildings.filter((b) => b === bType).length,
    nonStackableLimit: import.meta.env.DEV ? 100 : 1,
    warehousesPlaced: state.warehousesPlaced,
    warehouseLimit: import.meta.env.DEV ? 100 : MAX_WAREHOUSES,
    requiresStoneFloor: REQUIRES_STONE_FLOOR.has(bType),
    runStandardPlacementChecks,
    x,
    y,
    footprintSize: bSize,
    gridWidth: GRID_W,
    gridHeight: GRID_H,
    cellMap: state.cellMap,
    floorMap: state.floorMap,
  });
  if (eligibilityDecision.kind === "blocked") {
    const notification = getBuildPlacementNotificationForDecision(
      eligibilityDecision.blockReason,
      BUILDING_LABELS[bType],
    );
    if (!notification) return state;
    return {
      ...state,
      notifications: addErrorNotification(state.notifications, notification),
    };
  }

  // ---- SPECIAL: Auto-Miner placement on deposit ----
  const machineCtx = { state, bType: bType as "auto_miner" | "auto_smelter" | "auto_assembler", useConstructionSite, applyCostOrConstructionSite, makeId, addErrorNotification, debugLog };
  if (bType === "auto_miner") return placeAutoMinerBranch(machineCtx, x, y, action.direction ?? "east");

  // ---- SPECIAL: Conveyor placement with direction ----
  const conveyorCtx = { state, bType, useConstructionSite, applyCostOrConstructionSite, addErrorNotification, debugLog };
  if (bType === "conveyor_underground_in") {
    return placeUndergroundInBranch(conveyorCtx, x, y, action.direction ?? "east");
  }
  if (bType === "conveyor_underground_out") {
    return placeUndergroundOutBranch(conveyorCtx, x, y, action.direction ?? "east");
  }
  if (
    bType === "conveyor" ||
    bType === "conveyor_corner" ||
    bType === "conveyor_merger" ||
    bType === "conveyor_splitter"
  ) {
    return placeConveyorBranch(conveyorCtx, x, y, action.direction ?? "east");
  }

  // ---- SPECIAL: Auto Smelter / Auto Assembler placement with directional 2x1 footprint ----
  if (bType === "auto_smelter") return placeAutoSmelterBranch(machineCtx, x, y, action.direction ?? "east");
  if (bType === "auto_assembler") return placeAutoAssemblerBranch(machineCtx, x, y, action.direction ?? "east");

  const placed = placeAsset(state.assets, state.cellMap, bType, x, y, bSize);
  if (!placed) return state;

  const applyDefaultPlacementCosts = (): Pick<
    GameState,
    "inventory" | "warehouseInventories" | "serviceHubs"
  > => {
    const consumed = consumeBuildResources(
      state,
      costs as Partial<Record<keyof Inventory, number>>,
    );
    return {
      inventory: consumed.inventory,
      warehouseInventories: consumed.warehouseInventories,
      serviceHubs: consumed.serviceHubs,
    };
  };

  // Deduct costs — construction site: drone delivers everything; otherwise consume immediately
  let newInvB = state.inventory;
  let newHubsB = state.serviceHubs;
  let newWarehousesB = state.warehouseInventories;
  let newConstructionSites = state.constructionSites;
  if (useConstructionSite) {
    newConstructionSites = {
      ...state.constructionSites,
      [placed.id]: { buildingType: bType, remaining: fullCostAsRemaining(costs) },
    };
    debugLog.building(`[BuildMode] Placed ${BUILDING_LABELS[bType]} at (${x},${y}) as construction site`);
  } else {
    const consumedB = applyDefaultPlacementCosts();
    newInvB = consumedB.inventory;
    newHubsB = consumedB.serviceHubs;
    newWarehousesB = consumedB.warehouseInventories;
    debugLog.building(`[BuildMode] Placed ${BUILDING_LABELS[bType]} at (${x},${y})`);
  }

  const createDefaultPartialBuild = (input: {
    buildingType: typeof bType;
    inventoryAfterCosts: Inventory;
  }): GameState => {
    const { buildingType, inventoryAfterCosts } = input;
    return buildingType === "warehouse"
      ? {
        ...state,
        assets: {
          ...placed.assets,
          [placed.id]: {
            ...placed.assets[placed.id],
            direction: action.direction ?? "south",
          },
        },
        cellMap: placed.cellMap,
        inventory: inventoryAfterCosts,
        warehousesPlaced: state.warehousesPlaced + 1,
        warehousesPurchased: state.warehousesPurchased + 1,
        warehouseInventories: {
          ...state.warehouseInventories,
          [placed.id]: createEmptyInventory(),
        },
      }
      : buildingType === "cable"
        ? { ...state, assets: placed.assets, cellMap: placed.cellMap, inventory: inventoryAfterCosts, cablesPlaced: state.cablesPlaced + 1 }
        : buildingType === "power_pole"
          ? { ...state, assets: placed.assets, cellMap: placed.cellMap, inventory: inventoryAfterCosts, powerPolesPlaced: state.powerPolesPlaced + 1 }
          : buildingType === "generator"
            ? { ...state, assets: placed.assets, cellMap: placed.cellMap, inventory: inventoryAfterCosts, generators: { ...state.generators, [placed.id]: { fuel: 0, progress: 0, running: false } } }
            : {
              ...state,
              assets: placed.assets,
              cellMap: placed.cellMap,
              inventory: inventoryAfterCosts,
              placedBuildings: [...state.placedBuildings, buildingType],
              purchasedBuildings: [...state.purchasedBuildings, buildingType],
            };
  };

  let partialBuild: GameState = createDefaultPartialBuild({
    buildingType: bType,
    inventoryAfterCosts: newInvB,
  });

  // Apply construction site if created
  if (newConstructionSites !== state.constructionSites) {
    partialBuild = { ...partialBuild, constructionSites: newConstructionSites };
  }

  // Apply updated hub inventories (resources consumed from hubs for building)
  if (newHubsB !== state.serviceHubs) {
    partialBuild = { ...partialBuild, serviceHubs: newHubsB };
  }
  // Apply updated warehouse inventories (resources consumed from warehouses for building)
  if (newWarehousesB !== state.warehouseInventories) {
    partialBuild = { ...partialBuild, warehouseInventories: { ...newWarehousesB, ...(partialBuild.warehouseInventories ?? {}) } };
    // Note: spread order preserves any in-place additions (e.g. new warehouse asset above)
    // by overlaying them on top of the consumed map.
  }

  // Auto-assign nearest warehouse source for newly placed crafting buildings
  if (BUILDINGS_WITH_DEFAULT_SOURCE.has(bType)) {
    const nearestWhId = getNearestWarehouseId(partialBuild, x, y);
    if (nearestWhId) {
      partialBuild = {
        ...partialBuild,
        buildingSourceWarehouseIds: { ...partialBuild.buildingSourceWarehouseIds, [placed.id]: nearestWhId },
      };
    }
  }

  // Drohnen-Hub: place as Tier 1 (Proto-Hub).
  // When placed via construction site (drone delivers resources): start with droneIds: []
  // and spawn the first drone when construction completes (in tickOneDrone depositing case).
  // When placed directly (no existing hub): spawn 1 drone immediately.
  if (bType === "service_hub") {
    if (!useConstructionSite) {
      // Direct placement — spawn 1 idle drone for the new hub immediately.
      const newDroneId = `drone-${makeId()}`;
      const hubAssetPos = placed.assets[placed.id];
      const offset = getDroneDockOffset(0);
      const spawnedDrone: StarterDroneState = {
        status: "idle",
        tileX: hubAssetPos.x + offset.dx,
        tileY: hubAssetPos.y + offset.dy,
        targetNodeId: null,
        cargo: null,
        ticksRemaining: 0,
        hubId: placed.id,
        currentTaskType: null,
        deliveryTargetId: null,
        craftingJobId: null,
        droneId: newDroneId,
      };
      partialBuild = {
        ...partialBuild,
        drones: { ...partialBuild.drones, [newDroneId]: spawnedDrone },
        serviceHubs: {
          ...partialBuild.serviceHubs,
          [placed.id]: { inventory: createEmptyHubInventory(), targetStock: createDefaultProtoHubTargetStock(), tier: 1, droneIds: [newDroneId] },
        },
      };
      debugLog.building(`[BuildMode] Proto-Hub direkt platziert — Drohne ${newDroneId} auto-gespawnt (hubId: ${placed.id}).`);
    } else {
      // Construction site — drone spawns after Bauabschluss via tickOneDrone.
      partialBuild = {
        ...partialBuild,
        serviceHubs: {
          ...partialBuild.serviceHubs,
          [placed.id]: { inventory: createEmptyHubInventory(), targetStock: createDefaultProtoHubTargetStock(), tier: 1, droneIds: [] },
        },
      };
      debugLog.building(`[BuildMode] Proto-Hub als Baustelle platziert — Drohne spawnt nach Fertigstellung (hubId: ${placed.id}).`);
    }
  }

  return finalizePlacement(partialBuild, action.type, debugLog);
}
