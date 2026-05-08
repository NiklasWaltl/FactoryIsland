import type {
  GameState,
  GameMode,
  PlacedAsset,
  CollectionNode,
  StarterDroneState,
  ServiceHubEntry,
  ConstructionSite,
} from "../store/types";
import type { ShipState } from "../store/types/ship-types";
import { GRID_H, GRID_W } from "../constants/grid";
import { createEmptyHubInventory } from "../buildings/service-hub/hub-upgrade-workflow";
import { cleanBuildingSourceIds } from "../buildings/warehouse/warehouse-assignment";
import { getDroneHomeDock } from "../drones/dock/drone-dock";
import { computeConnectedAssetIds } from "../logistics/connectivity";
import { cleanBuildingZoneIds } from "../zones/production-zone-cleanup";
import { getStartModulePosition } from "../store/bootstrap/start-module-position";
import {
  createDefaultHubTargetStock,
  createDefaultProtoHubTargetStock,
} from "../store/constants/hub/hub-target-stock";
import { applyDockWarehouseLayout } from "../store/bootstrap/apply-dock-warehouse-layout";
import { cellKey } from "../store/utils/cell-key";
import { createInitialState } from "../store/initial-state";
import { sanitizeTileMap } from "../world/tile-map-utils";
import type { HubTier } from "../store/types";
import { debugLog } from "../debug/debugLogger";
import {
  CURRENT_SAVE_VERSION,
  type SaveGameLatest,
  clampGeneratorFuel,
  migrateSave,
} from "./save-migrations";
import {
  rebuildGlobalInventoryFromStorage,
  sanitizeNetworkSlice,
  sanitizeCraftingQueue,
  sanitizeKeepStockByWorkbench,
  sanitizeRecipeAutomationPolicies,
  sanitizeStarterDrone,
  sanitizeConveyorUndergroundPeers,
  normalizeModuleInventory,
} from "./save-normalizer";
import { isRuntimeGameStateSnapshot } from "./save-legacy";
import { normalizeModuleFragmentCount } from "../store/helpers/module-fragments";
import {
  STARTER_DRONE_ID,
  requireStarterDrone,
  selectStarterDrone,
} from "../store/selectors/drone-selectors";

function createFallbackShipState(): ShipState {
  return {
    status: "sailing",
    activeQuest: null,
    nextQuest: null,
    questHistory: [],
    dockedAt: null,
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

function sanitizeShipSnapshot(raw: unknown): ShipState {
  const fallback = createFallbackShipState();
  if (!raw || typeof raw !== "object") return fallback;

  const ship = raw as Record<string, unknown>;
  const departureAt =
    typeof ship.departureAt === "number" && Number.isFinite(ship.departureAt)
      ? ship.departureAt
      : typeof ship.departsAt === "number" && Number.isFinite(ship.departsAt)
        ? ship.departsAt
        : null;
  const questHistory = Array.isArray(ship.questHistory)
    ? ship.questHistory.filter((id): id is string => typeof id === "string")
    : [];

  return {
    ...fallback,
    ...(ship as Partial<ShipState>),
    departureAt,
    questHistory,
  };
}

/**
 * Extract the persistable subset of runtime GameState and stamp it
 * with the current save version.
 */
export function serializeState(state: GameState): SaveGameLatest {
  const ship = sanitizeShipSnapshot((state as Partial<GameState>).ship);
  debugLog.general(
    `Save: ${state.network.reservations.length} reservations, ${state.crafting.jobs.length} jobs`,
  );
  // Runtime-only Map/Set caches are intentionally omitted from save data.
  return {
    version: CURRENT_SAVE_VERSION,
    mode: state.mode,
    assets: state.assets,
    cellMap: state.cellMap,
    tileMap: state.tileMap,
    inventory: state.inventory,
    moduleInventory: state.moduleInventory ?? [],
    moduleFragments: normalizeModuleFragmentCount(state.moduleFragments),
    moduleLabJob: state.moduleLabJob ?? null,
    purchasedBuildings: state.purchasedBuildings,
    placedBuildings: state.placedBuildings,
    unlockedBuildings: state.unlockedBuildings,
    warehousesPurchased: state.warehousesPurchased,
    warehousesPlaced: state.warehousesPlaced,
    warehouseInventories: state.warehouseInventories,
    cablesPlaced: state.cablesPlaced,
    powerPolesPlaced: state.powerPolesPlaced,
    hotbarSlots: state.hotbarSlots,
    activeSlot: state.activeSlot,
    smithy: state.smithy,
    generators: state.generators,
    battery: state.battery,
    floorMap: state.floorMap,
    autoMiners: state.autoMiners,
    conveyors: state.conveyors,
    conveyorUndergroundPeers: state.conveyorUndergroundPeers,
    autoSmelters: state.autoSmelters,
    autoAssemblers: state.autoAssemblers,
    manualAssembler: state.manualAssembler,
    machinePowerRatio: state.machinePowerRatio,
    saplingGrowAt: state.saplingGrowAt,
    buildingSourceWarehouseIds: state.buildingSourceWarehouseIds,
    productionZones: state.productionZones,
    buildingZoneIds: state.buildingZoneIds,
    collectionNodes: state.collectionNodes,
    serviceHubs: state.serviceHubs,
    constructionSites: state.constructionSites,
    drones: state.drones,
    network: state.network,
    crafting: state.crafting,
    keepStockByWorkbench: state.keepStockByWorkbench ?? {},
    recipeAutomationPolicies: state.recipeAutomationPolicies ?? {},
    splitterRouteState: state.splitterRouteState ?? {},
    splitterFilterState: state.splitterFilterState ?? {},
    ship,
  };
}

/**
 * Hydrate a migrated save into a full GameState by re-deriving
 * runtime-only fields (connectivity, powered machines, UI defaults).
 */
export function deserializeState(save: SaveGameLatest): GameState {
  const base = createInitialState(save.mode);

  const partial: GameState = {
    ...base,
    mode: save.mode,
    assets: save.assets,
    cellMap: save.cellMap,
    tileMap: sanitizeTileMap(save.tileMap, GRID_H, GRID_W),
    inventory: save.inventory,
    // SAVE GUARD: moduleInventory sanitization
    moduleInventory: normalizeModuleInventory(save.moduleInventory),
    moduleFragments: normalizeModuleFragmentCount(save.moduleFragments),
    moduleLabJob: save.moduleLabJob ?? null,
    purchasedBuildings: save.purchasedBuildings,
    placedBuildings: save.placedBuildings,
    unlockedBuildings: save.unlockedBuildings,
    warehousesPurchased: save.warehousesPurchased,
    warehousesPlaced: save.warehousesPlaced,
    warehouseInventories: save.warehouseInventories,
    cablesPlaced: save.cablesPlaced,
    powerPolesPlaced: save.powerPolesPlaced,
    hotbarSlots: save.hotbarSlots,
    activeSlot: save.activeSlot,
    smithy: {
      ...base.smithy,
      ...save.smithy,
      buildingId: save.smithy?.buildingId ?? null,
    },
    generators: clampGeneratorFuel(save.generators ?? {}),
    battery: save.battery,
    floorMap: save.floorMap,
    autoMiners: save.autoMiners,
    conveyors: save.conveyors,
    conveyorUndergroundPeers: sanitizeConveyorUndergroundPeers(
      save.conveyorUndergroundPeers,
      save.assets,
    ),
    autoSmelters: save.autoSmelters,
    autoAssemblers: save.autoAssemblers ?? {},
    manualAssembler: {
      ...save.manualAssembler,
      buildingId: save.manualAssembler?.buildingId ?? null,
    },
    machinePowerRatio: save.machinePowerRatio,
    saplingGrowAt: save.saplingGrowAt,

    buildingSourceWarehouseIds: cleanBuildingSourceIds(
      save.buildingSourceWarehouseIds ?? {},
      new Set(Object.keys(save.warehouseInventories)),
    ),

    collectionNodes: (() => {
      const raw = save.collectionNodes ?? {};
      const cleaned: Record<string, CollectionNode> = {};
      for (const [id, node] of Object.entries(raw)) {
        cleaned[id] = { ...node, reservedByDroneId: null };
      }
      return cleaned;
    })(),

    drones: (() => {
      const raw = save.drones ?? {};
      const cleaned: Record<string, StarterDroneState> = {};
      for (const [id, rawDrone] of Object.entries(raw)) {
        let d = sanitizeStarterDrone(rawDrone, save.tileMap);
        if (d.hubId && !save.assets[d.hubId]) d = { ...d, hubId: null };
        if (d.deliveryTargetId && !save.assets[d.deliveryTargetId]) {
          d = {
            ...d,
            deliveryTargetId: null,
            currentTaskType: null,
            deconstructRefund: null,
          };
        }
        if (!d.hubId) {
          const existingHubId =
            Object.keys(save.assets).find(
              (aid) => save.assets[aid]?.type === "service_hub",
            ) ?? null;
          if (existingHubId) d = { ...d, hubId: existingHubId };
        }
        if (d.status === "idle" && d.hubId && save.assets[d.hubId]) {
          d = {
            ...d,
            tileX: save.assets[d.hubId].x,
            tileY: save.assets[d.hubId].y,
          };
        }
        cleaned[id] = d;
      }
      return cleaned;
    })(),

    serviceHubs: (() => {
      const raw = save.serviceHubs ?? {};
      const cleaned: Record<string, ServiceHubEntry> = {};
      for (const [id, entry] of Object.entries(raw)) {
        if (save.assets[id]?.type === "service_hub") {
          const tier: HubTier = (entry as any).tier === 1 ? 1 : 2;
          const rawPending = (entry as any).pendingUpgrade;
          const pendingUpgrade =
            rawPending && typeof rawPending === "object" && tier === 1
              ? { ...rawPending }
              : undefined;
          cleaned[id] = {
            inventory: { ...createEmptyHubInventory(), ...entry.inventory },
            targetStock:
              entry.targetStock ??
              (tier === 1
                ? createDefaultProtoHubTargetStock()
                : createDefaultHubTargetStock()),
            tier,
            droneIds: Array.isArray((entry as any).droneIds)
              ? (entry as any).droneIds
              : [],
            ...(pendingUpgrade ? { pendingUpgrade } : {}),
          };
        }
      }
      return cleaned;
    })(),

    constructionSites: (() => {
      const raw = save.constructionSites ?? {};
      const cleaned: Record<string, ConstructionSite> = {};
      for (const [id, site] of Object.entries(raw)) {
        if (save.assets[id]) {
          cleaned[id] = site;
        }
      }
      return cleaned;
    })(),

    productionZones: save.productionZones ?? {},
    buildingZoneIds: cleanBuildingZoneIds(
      save.buildingZoneIds ?? {},
      new Set(Object.keys(save.assets)),
      new Set(Object.keys(save.productionZones ?? {})),
    ),
    keepStockByWorkbench: sanitizeKeepStockByWorkbench(
      save.keepStockByWorkbench,
      save.assets,
    ),
    recipeAutomationPolicies: sanitizeRecipeAutomationPolicies(
      save.recipeAutomationPolicies,
    ),
    splitterRouteState: save.splitterRouteState ?? {},
    splitterFilterState: save.splitterFilterState ?? {},
    ship: sanitizeShipSnapshot(
      (save as any).ship ?? (base as Partial<GameState>).ship,
    ),

    connectedAssetIds: [],
    poweredMachineIds: [],
    openPanel: null,
    notifications: [],
    buildMode: false,
    selectedBuildingType: null,
    selectedFloorTile: null,
    selectedWarehouseId: null,
    selectedPowerPoleId: null,
    selectedAutoMinerId: null,
    selectedAutoSmelterId: null,
    selectedAutoAssemblerId: null,
    selectedGeneratorId: null,
    selectedServiceHubId: null,
    selectedSplitterId: null,
    energyDebugOverlay: false,
    autoDeliveryLog: [],
    routingIndexCache: null,
    selectedCraftingBuildingId: null,
  };

  requireStarterDrone(partial);

  const hasAnyHub = Object.values(partial.assets).some(
    (a) => a.type === "service_hub",
  );
  if (!hasAnyHub) {
    const starter = requireStarterDrone(partial);
    // center of standard 80×50 grid — used as spatial search origin, not as drone home position
    const HUB_SEARCH_CENTER = { x: 39, y: 24 } as const;
    const candidates: { x: number; y: number; dist: number }[] = [];
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const wx = HUB_SEARCH_CENTER.x + dx;
        const wy = HUB_SEARCH_CENTER.y + dy;
        if (wx < 0 || wy < 0 || wx + 2 > GRID_W || wy + 2 > GRID_H) continue;
        candidates.push({ x: wx, y: wy, dist: Math.abs(dx) + Math.abs(dy) });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);
    for (const { x, y } of candidates) {
      const k00 = cellKey(x, y);
      const k10 = cellKey(x + 1, y);
      const k01 = cellKey(x, y + 1);
      const k11 = cellKey(x + 1, y + 1);
      if (
        !partial.cellMap[k00] &&
        !partial.cellMap[k10] &&
        !partial.cellMap[k01] &&
        !partial.cellMap[k11]
      ) {
        const hubId = `proto-hub-${Date.now()}`;
        const hubAsset: PlacedAsset = {
          id: hubId,
          type: "service_hub",
          x,
          y,
          size: 2,
          fixed: true,
        } as PlacedAsset;
        partial.assets = { ...partial.assets, [hubId]: hubAsset };
        partial.cellMap = {
          ...partial.cellMap,
          [k00]: hubId,
          [k10]: hubId,
          [k01]: hubId,
          [k11]: hubId,
        };
        partial.serviceHubs = {
          ...partial.serviceHubs,
          [hubId]: {
            inventory: createEmptyHubInventory(),
            targetStock: createDefaultProtoHubTargetStock(),
            tier: 1,
            droneIds: [starter.droneId],
          },
        };
        const assignedStarter = {
          ...starter,
          hubId,
          tileX: x,
          tileY: y,
        };
        partial.drones = {
          ...partial.drones,
          [STARTER_DRONE_ID]: assignedStarter,
        };
        break;
      }
    }
  }

  const starter = selectStarterDrone(partial);
  if (starter?.hubId) {
    const dHub = partial.serviceHubs[starter.hubId];
    if (dHub && !dHub.droneIds.includes(starter.droneId)) {
      partial.serviceHubs = {
        ...partial.serviceHubs,
        [starter.hubId]: {
          ...dHub,
          droneIds: [...dHub.droneIds, starter.droneId],
        },
      };
    }
  }

  const snapIdleDroneToDock = (drone: StarterDroneState): StarterDroneState => {
    if (drone.status !== "idle") return drone;
    const dock = getDroneHomeDock(drone, partial);
    if (dock) {
      return { ...drone, tileX: dock.x, tileY: dock.y };
    }
    if (!drone.hubId) {
      const fallback = getStartModulePosition({
        assets: partial.assets,
        tileMap: partial.tileMap,
      });
      return { ...drone, tileX: fallback.x, tileY: fallback.y };
    }
    return drone;
  };

  partial.drones = Object.fromEntries(
    Object.entries(partial.drones).map(([id, drone]) => [
      id,
      snapIdleDroneToDock(drone),
    ]),
  );
  requireStarterDrone(partial);

  partial.inventory = rebuildGlobalInventoryFromStorage(partial);
  partial.connectedAssetIds = computeConnectedAssetIds(partial);

  const liveAssetIds = new Set(Object.keys(partial.assets));
  const craftingResult = sanitizeCraftingQueue(
    (save as any).crafting,
    liveAssetIds,
  );
  partial.crafting = craftingResult.queue;
  const liveJobIds = new Set(craftingResult.queue.jobs.map((j) => j.id));
  partial.network = sanitizeNetworkSlice((save as any).network, liveJobIds);

  debugLog.general(
    `Load: restored ${partial.network.reservations.length} reservations, ${partial.crafting.jobs.length} jobs`,
  );
  if (craftingResult.cancelled > 0) {
    debugLog.general(
      `Load validation: ${craftingResult.cancelled} invalid jobs cancelled`,
    );
  }

  const finalState = applyDockWarehouseLayout(partial);

  return finalState;
}

/**
 * One-stop helper for loading: parse -> migrate -> hydrate.
 * Returns a fresh initial state if anything goes wrong.
 */
export function loadAndHydrate(raw: unknown, mode: GameMode): GameState {
  const normalizedRaw = isRuntimeGameStateSnapshot(raw)
    ? serializeState(raw)
    : raw;
  const migrated = migrateSave(normalizedRaw);
  if (!migrated) return createInitialState(mode);

  if (migrated.mode !== mode) return createInitialState(mode);

  return deserializeState(migrated);
}
