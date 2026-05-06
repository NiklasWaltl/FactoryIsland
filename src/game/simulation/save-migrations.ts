import type {
  GameMode,
  PlacedAsset,
  Inventory,
  BuildingType,
  HotbarSlot,
  SmithyState,
  GeneratorState,
  BatteryState,
  AutoMinerEntry,
  ConveyorState,
  AutoAssemblerEntry,
  AutoSmelterEntry,
  ManualAssemblerState,
  ProductionZone,
  CollectionNode,
  StarterDroneState,
  ServiceHubEntry,
  ConstructionSite,
  KeepStockByWorkbench,
  HubTier,
  ModuleFragmentCount,
  ModuleLabJob,
} from "../store/types";
import type { ShipQuest, ShipState } from "../store/types/ship-types";
import type { Module } from "../modules/module.types";
import type { TileType } from "../world/tile-types";
import { normalizeModuleFragmentCount } from "../store/helpers/module-fragments";
import { SHIP_QUEST_HISTORY_SIZE } from "../ship/quest-registry";
import { GRID_H, GRID_W } from "../constants/grid";
import { sanitizeTileMap } from "../world/tile-map-utils";
import { createEmptyHubInventory } from "../buildings/service-hub/hub-upgrade-workflow";
import { GENERATOR_MAX_FUEL } from "../store/constants/buildings/index";
import { createDefaultHubTargetStock } from "../store/constants/hub/hub-target-stock";
import type { NetworkSlice } from "../inventory/reservationTypes";
import { createEmptyNetworkSlice } from "../inventory/reservationTypes";
import type { CraftingQueueState } from "../crafting/types";
import { createEmptyCraftingQueue } from "../crafting/types";
import { type RecipeAutomationPolicyMap } from "../crafting/policies";
import { debugLog } from "../debug/debugLogger";
import { STARTER_DRONE_ID } from "../store/selectors/drone-selectors";
import { migrateV0ToV1 } from "./save-legacy";

/** Current save format version. Bump when persisted shape changes. */
export const CURRENT_SAVE_VERSION = 31;

// ---- Save schema (V1 - initial versioned format) --------------------

export interface SaveGameV1 {
  version: 1;
  mode: GameMode;
  assets: Record<string, PlacedAsset>;
  cellMap: Record<string, string>;
  inventory: Inventory;
  purchasedBuildings: BuildingType[];
  placedBuildings: BuildingType[];
  warehousesPurchased: number;
  warehousesPlaced: number;
  warehouseInventories: Record<string, Inventory>;
  cablesPlaced: number;
  powerPolesPlaced: number;
  hotbarSlots: HotbarSlot[];
  activeSlot: number;
  smithy: SmithyState;
  generator: GeneratorState;
  battery: BatteryState;
  floorMap: Record<string, "stone_floor">;
  autoMiners: Record<string, AutoMinerEntry>;
  conveyors: Record<string, ConveyorState>;
  autoSmelters: Record<string, AutoSmelterEntry>;
  manualAssembler: ManualAssemblerState;
  machinePowerRatio: Record<string, number>;
  saplingGrowAt: Record<string, number>;
  buildingSourceWarehouseIds?: Record<string, string>;
  productionZones?: Record<string, ProductionZone>;
  buildingZoneIds?: Record<string, string>;
}

// ---- Save schema (V2 - per-instance generator state) ----------------

export interface SaveGameV2 {
  version: 2;
  mode: GameMode;
  assets: Record<string, PlacedAsset>;
  cellMap: Record<string, string>;
  inventory: Inventory;
  purchasedBuildings: BuildingType[];
  placedBuildings: BuildingType[];
  warehousesPurchased: number;
  warehousesPlaced: number;
  warehouseInventories: Record<string, Inventory>;
  cablesPlaced: number;
  powerPolesPlaced: number;
  hotbarSlots: HotbarSlot[];
  activeSlot: number;
  smithy: SmithyState;
  generators: Record<string, GeneratorState>;
  battery: BatteryState;
  floorMap: Record<string, "stone_floor">;
  autoMiners: Record<string, AutoMinerEntry>;
  conveyors: Record<string, ConveyorState>;
  autoSmelters: Record<string, AutoSmelterEntry>;
  manualAssembler: ManualAssemblerState;
  machinePowerRatio: Record<string, number>;
  saplingGrowAt: Record<string, number>;
  buildingSourceWarehouseIds?: Record<string, string>;
  productionZones?: Record<string, ProductionZone>;
  buildingZoneIds?: Record<string, string>;
}

export interface SaveGameV3 extends Omit<SaveGameV2, "version"> {
  version: 3;
  collectionNodes: Record<string, CollectionNode>;
}

export interface SaveGameV4 extends Omit<SaveGameV3, "version"> {
  version: 4;
  starterDrone: StarterDroneState;
}

export interface SaveGameV5 extends Omit<SaveGameV4, "version"> {
  version: 5;
}

export interface SaveGameV6 extends Omit<SaveGameV5, "version"> {
  version: 6;
  serviceHubs: Record<string, ServiceHubEntry>;
}

export interface SaveGameV7 extends Omit<SaveGameV6, "version"> {
  version: 7;
  constructionSites: Record<string, ConstructionSite>;
}

export interface SaveGameV8 extends Omit<SaveGameV7, "version"> {
  version: 8;
}

export interface SaveGameV9 extends Omit<SaveGameV8, "version"> {
  version: 9;
}

export interface SaveGameV10 extends Omit<SaveGameV9, "version"> {
  version: 10;
}

export interface SaveGameV11 extends Omit<SaveGameV10, "version"> {
  version: 11;
}

export interface SaveGameV12 extends Omit<SaveGameV11, "version"> {
  version: 12;
  drones: Record<string, StarterDroneState>;
}

export interface SaveGameV13 extends Omit<SaveGameV12, "version"> {
  version: 13;
}

export interface SaveGameV14 extends Omit<SaveGameV13, "version"> {
  version: 14;
  network: NetworkSlice;
  crafting: CraftingQueueState;
}

export interface SaveGameV15 extends Omit<SaveGameV14, "version"> {
  version: 15;
  keepStockByWorkbench: KeepStockByWorkbench;
}

export interface SaveGameV16 extends Omit<SaveGameV15, "version"> {
  version: 16;
  recipeAutomationPolicies: RecipeAutomationPolicyMap;
}

export interface SaveGameV17 extends Omit<SaveGameV16, "version"> {
  version: 17;
  /** Bidirectional map of underground belt entrance ↔ exit asset IDs. */
  conveyorUndergroundPeers: Record<string, string>;
}

export interface SaveGameV18 extends Omit<SaveGameV17, "version"> {
  version: 18;
  /** Per-auto-assembler runtime state (belt-fed V1 recipes). */
  autoAssemblers: Record<string, AutoAssemblerEntry>;
}

export interface SaveGameV19 extends Omit<SaveGameV18, "version"> {
  version: 19;
  /** Per-splitter Round-Robin routing state (keyed by splitter asset ID). */
  splitterRouteState: Record<string, { lastSide: "left" | "right" }>;
}

export interface SaveGameV20 extends Omit<SaveGameV19, "version"> {
  version: 20;
  /**
   * Per-splitter pro-Output-Filter state (keyed by splitter asset ID).
   * Each side holds an optional ConveyorItem filter; null = no filter.
   */
  splitterFilterState: Record<
    string,
    {
      left: import("../store/types/conveyor-types").ConveyorItem | null;
      right: import("../store/types/conveyor-types").ConveyorItem | null;
    }
  >;
}

export interface SaveGameV21 extends Omit<SaveGameV20, "version"> {
  version: 21;
  /** Terrain layer, indexed as [row][col]. */
  tileMap: TileType[][];
}

export interface SaveGameV22 extends Omit<SaveGameV21, "version"> {
  version: 22;
  /** Ship quest loop state. */
  ship: ShipState;
}

export interface SaveGameV23 extends Omit<SaveGameV22, "version"> {
  version: 23;
  /** Owned module instances from the fragment trader. */
  moduleInventory: Module[];
}

export interface SaveGameV24 extends Omit<SaveGameV23, "version"> {
  version: 24;
  /** Legacy tier-bound module fragments from ship rewards. */
  moduleFragments: unknown;
}

export interface SaveGameV25 extends Omit<
  SaveGameV24,
  "version" | "moduleFragments"
> {
  version: 25;
  /** Unspent module fragments collected by the player. */
  moduleFragments: ModuleFragmentCount;
}

export interface SaveGameV26 extends Omit<SaveGameV25, "version"> {
  version: 26;
  /** Single in-flight Module Lab crafting job. null = idle. */
  moduleLabJob: ModuleLabJob | null;
}

export interface SaveGameV27 extends Omit<SaveGameV26, "version"> {
  version: 27;
  /** Ship state with departureAt and Phase-5+ pityCounter fields. */
  ship: ShipState;
}

export interface SaveGameV28 extends Omit<SaveGameV27, "version"> {
  version: 28;
}

export interface SaveGameV29 extends Omit<SaveGameV28, "version"> {
  version: 29;
  /** Ship state normalized to canonical departureAt + questHistory. */
  ship: ShipState;
}

export interface SaveGameV30 extends Omit<
  SaveGameV29,
  "version" | "starterDrone"
> {
  version: 30;
}

export interface SaveGameV31 extends Omit<SaveGameV30, "version"> {
  version: 31;
  /** Buildings the player has unlocked. Persisted. */
  unlockedBuildings: BuildingType[];
}

export type SaveGameLatest = SaveGameV31;

/** All BuildingTypes that exist in the game. Used by v30->v31 migration to
 *  unlock everything for legacy saves so existing players keep their access. */
const ALL_BUILDING_TYPES_FOR_LEGACY_UNLOCK: readonly BuildingType[] = [
  "workbench",
  "warehouse",
  "smithy",
  "generator",
  "cable",
  "battery",
  "power_pole",
  "auto_miner",
  "conveyor",
  "conveyor_corner",
  "conveyor_merger",
  "conveyor_splitter",
  "conveyor_underground_in",
  "conveyor_underground_out",
  "manual_assembler",
  "auto_smelter",
  "auto_assembler",
  "service_hub",
  "dock_warehouse",
  "module_lab",
];

/**
 * Clamp each generator's local fuel buffer to GENERATOR_MAX_FUEL.
 * Pure and idempotent; applied on load.
 */
export function clampGeneratorFuel(
  generators: Record<string, GeneratorState>,
): Record<string, GeneratorState> {
  const out: Record<string, GeneratorState> = {};
  for (const [id, g] of Object.entries(generators)) {
    out[id] =
      g.fuel > GENERATOR_MAX_FUEL ? { ...g, fuel: GENERATOR_MAX_FUEL } : g;
  }
  return out;
}

type MigrationStep = {
  from: number;
  to: number;
  migrate: (save: unknown) => unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function step<TIn, TOut>(
  from: number,
  to: number,
  fn: (save: TIn) => TOut,
): MigrationStep {
  return {
    from,
    to,
    migrate: (save: unknown) => {
      if (!isPlainObject(save)) {
        throw new Error(
          `[save] Migration v${from}->v${to}: expected object, got ${typeof save}`,
        );
      }
      return fn(save as TIn);
    },
  };
}

function selectMigratedStarter(save: {
  readonly drones?: Record<string, StarterDroneState>;
  readonly starterDrone?: StarterDroneState;
}): StarterDroneState | undefined {
  return save.drones?.[STARTER_DRONE_ID] ?? save.starterDrone;
}

function requireMigratedStarter(save: {
  readonly drones?: Record<string, StarterDroneState>;
  readonly starterDrone?: StarterDroneState;
}): StarterDroneState {
  const starter = selectMigratedStarter(save);
  if (!starter) {
    throw new Error("[save] Migration expected a starter drone.");
  }
  return starter;
}

function normalizeNonNegativeInteger(raw: unknown, fallback = 0): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(0, Math.floor(raw))
    : fallback;
}

function normalizePositiveInteger(raw: unknown, fallback = 1): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(1, Math.floor(raw))
    : fallback;
}

function normalizeTimestamp(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function normalizePendingMultiplier(raw: unknown): 0 | 1 | 2 | 3 {
  return raw === 0 || raw === 1 || raw === 2 || raw === 3 ? raw : 1;
}

function isLegacyQuestShape(raw: Record<string, unknown>): boolean {
  return (
    typeof raw.id === "string" &&
    typeof raw.type === "string" &&
    Array.isArray(raw.requiredItems)
  );
}

function normalizeShipQuest(
  raw: unknown,
  fallbackPhase: number,
  field: "activeQuest" | "nextQuest",
): ShipQuest | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object") {
    debugLog.general(
      `[save] Migration: ship.${field} is not an object; resetting to null.`,
    );
    return null;
  }

  const quest = raw as Record<string, unknown>;
  if (isLegacyQuestShape(quest)) {
    debugLog.general(
      `[save] Migration: ship.${field} uses legacy fields id/type/requiredItems; resetting to null.`,
    );
    return null;
  }

  const itemId = quest.itemId;
  const amount = quest.amount;
  const label = quest.label;
  const phase = normalizePositiveInteger(quest.phase, fallbackPhase);

  if (
    typeof itemId === "string" &&
    typeof amount === "number" &&
    Number.isFinite(amount) &&
    amount > 0 &&
    typeof label === "string" &&
    label.length > 0
  ) {
    return {
      itemId: itemId as ShipQuest["itemId"],
      amount: Math.max(1, Math.floor(amount)),
      label,
      phase,
    };
  }

  debugLog.general(
    `[save] Migration: ship.${field} failed structure validation; resetting to null.`,
  );
  return null;
}

function normalizeQuestHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const filtered = raw.filter((id): id is string => typeof id === "string");
  return filtered.slice(-SHIP_QUEST_HISTORY_SIZE);
}

function normalizeShipState(raw: unknown): ShipState {
  const ship =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const departureAt = normalizeTimestamp(ship.departureAt ?? ship.departsAt);
  const questPhase = normalizePositiveInteger(ship.questPhase, 1);
  const activeQuest = normalizeShipQuest(
    ship.activeQuest,
    questPhase,
    "activeQuest",
  );
  const nextQuest = normalizeShipQuest(ship.nextQuest, questPhase, "nextQuest");
  const shipsSinceLastFragment = normalizeNonNegativeInteger(
    ship.shipsSinceLastFragment,
  );
  const pityCounter = normalizeNonNegativeInteger(
    ship.pityCounter,
    shipsSinceLastFragment,
  );
  const questHistory = normalizeQuestHistory(ship.questHistory);
  const status =
    ship.status === "docked" ||
    ship.status === "departing" ||
    ship.status === "sailing"
      ? ship.status
      : "sailing";

  return {
    status,
    activeQuest,
    nextQuest,
    questHistory,
    dockedAt: normalizeTimestamp(ship.dockedAt),
    departureAt,
    returnsAt:
      "returnsAt" in ship
        ? normalizeTimestamp(ship.returnsAt)
        : Date.now() + 30_000,
    rewardPending: ship.rewardPending === true,
    lastReward: (ship.lastReward as ShipState["lastReward"]) ?? null,
    questPhase,
    shipsSinceLastFragment,
    pityCounter,
    pendingMultiplier: normalizePendingMultiplier(ship.pendingMultiplier),
  };
}

function migrateV1ToV2(save: SaveGameV1): SaveGameV2 {
  const oldGen: GeneratorState = save.generator ?? {
    fuel: 0,
    progress: 0,
    running: false,
  };
  const generators: Record<string, GeneratorState> = {};
  let first = true;
  for (const [id, asset] of Object.entries(save.assets ?? {})) {
    if ((asset as PlacedAsset).type === "generator") {
      generators[id] = first
        ? { ...oldGen }
        : { fuel: 0, progress: 0, running: false };
      first = false;
    }
  }
  const { generator: _dropped, ...rest } = save as any;
  return { ...rest, version: 2, generators } as SaveGameV2;
}

function migrateV2ToV3(save: SaveGameV2): SaveGameV3 {
  return { ...save, version: 3, collectionNodes: {} };
}

function migrateV3ToV4(save: SaveGameV3): SaveGameV4 {
  const starterDrone: StarterDroneState = {
    status: "idle",
    tileX: 39, // standard 80×50 grid center — no layout context available at this migration version
    tileY: 24,
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    hubId: null,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
    droneId: "starter",
  };
  return { ...save, version: 4, starterDrone };
}

function migrateV4ToV5(save: SaveGameV4): SaveGameV5 {
  const starter = requireMigratedStarter(save);
  return {
    ...save,
    version: 5,
    starterDrone: { ...starter, hubId: null },
  };
}

function migrateV5ToV6(save: SaveGameV5): SaveGameV6 {
  const serviceHubs: Record<string, ServiceHubEntry> = {};
  for (const [id, asset] of Object.entries(save.assets)) {
    if (asset.type === "service_hub") {
      serviceHubs[id] = {
        inventory: createEmptyHubInventory(),
        targetStock: createDefaultHubTargetStock(),
        tier: 2,
        droneIds: [],
      };
    }
  }
  return {
    ...save,
    version: 6,
    serviceHubs,
  };
}

function migrateV6ToV7(save: SaveGameV6): SaveGameV7 {
  const starter = requireMigratedStarter(save);
  return {
    ...save,
    version: 7,
    constructionSites: {},
    starterDrone: {
      ...starter,
      currentTaskType: null,
      deliveryTargetId: null,
    },
  };
}

function migrateV7ToV8(save: SaveGameV7): SaveGameV8 {
  const starter = requireMigratedStarter(save);
  const clearedNodes: Record<string, CollectionNode> = {};
  for (const [id, node] of Object.entries(save.collectionNodes ?? {})) {
    clearedNodes[id] = { ...node, reservedByDroneId: null };
  }
  return {
    ...save,
    version: 8,
    collectionNodes: clearedNodes,
    starterDrone: {
      ...starter,
      droneId: "starter",
    },
  };
}

function migrateV8ToV9(save: SaveGameV8): SaveGameV9 {
  const migratedHubs: Record<string, ServiceHubEntry> = {};
  for (const [id, entry] of Object.entries(save.serviceHubs ?? {})) {
    migratedHubs[id] = {
      ...entry,
      targetStock: (entry as any).targetStock ?? createDefaultHubTargetStock(),
    };
  }
  return {
    ...save,
    version: 9,
    serviceHubs: migratedHubs,
  };
}

function migrateV9ToV10(save: SaveGameV9): SaveGameV10 {
  const migratedHubs: Record<string, ServiceHubEntry> = {};
  for (const [id, entry] of Object.entries(save.serviceHubs ?? {})) {
    migratedHubs[id] = {
      ...entry,
      tier: ((entry as any).tier as HubTier) ?? 2,
    };
  }
  return {
    ...save,
    version: 10,
    serviceHubs: migratedHubs,
  };
}

function migrateV10ToV11(save: SaveGameV10): SaveGameV11 {
  const droneHubId = selectMigratedStarter(save)?.hubId ?? null;
  const migratedHubs: Record<string, ServiceHubEntry> = {};
  for (const [id, entry] of Object.entries(save.serviceHubs ?? {})) {
    migratedHubs[id] = {
      ...entry,
      droneIds:
        (entry as any).droneIds ?? (droneHubId === id ? ["starter"] : []),
    };
  }
  return {
    ...save,
    version: 11,
    serviceHubs: migratedHubs,
  };
}

function migrateV11ToV12(save: SaveGameV11): SaveGameV12 {
  const drones: Record<string, StarterDroneState> = {};
  const starter = selectMigratedStarter(save);
  if (starter) {
    const droneId = (starter as any).droneId ?? STARTER_DRONE_ID;
    drones[droneId] = {
      ...starter,
      droneId,
      craftingJobId: (starter as any).craftingJobId ?? null,
    } as StarterDroneState;
    if (!drones[STARTER_DRONE_ID]) {
      drones[STARTER_DRONE_ID] = {
        ...drones[droneId],
        droneId: STARTER_DRONE_ID,
      };
    }
  } else {
    drones[STARTER_DRONE_ID] = {
      status: "idle",
      tileX: 39, // standard 80×50 grid center — no layout context available at this migration version
      tileY: 24,
      targetNodeId: null,
      cargo: null,
      ticksRemaining: 0,
      hubId: null,
      currentTaskType: null,
      deliveryTargetId: null,
      craftingJobId: null,
      droneId: STARTER_DRONE_ID,
    };
  }
  return {
    ...save,
    version: 12,
    drones,
  };
}

function migrateV12ToV13(save: SaveGameV12): SaveGameV13 {
  const drones: Record<string, StarterDroneState> = {};
  for (const [id, drone] of Object.entries(save.drones ?? {})) {
    drones[id] = {
      ...drone,
      droneId: (drone as any).droneId ?? id,
      craftingJobId: (drone as any).craftingJobId ?? null,
    } as StarterDroneState;
  }
  const selectedStarter = selectMigratedStarter(save);
  const starter = selectedStarter
    ? ({
        ...selectedStarter,
        craftingJobId: (selectedStarter as any).craftingJobId ?? null,
      } as StarterDroneState)
    : selectedStarter;
  if (!drones[STARTER_DRONE_ID] && starter) {
    drones[STARTER_DRONE_ID] = starter;
  }
  return {
    ...save,
    version: 13,
    drones,
  };
}

function migrateV13ToV14(save: SaveGameV13): SaveGameV14 {
  debugLog.general("Migration v13->v14: old save -> empty reservations/jobs");
  return {
    ...save,
    version: 14,
    network: createEmptyNetworkSlice(),
    crafting: createEmptyCraftingQueue(),
  };
}

function migrateV14ToV15(save: SaveGameV14): SaveGameV15 {
  return {
    ...save,
    version: 15,
    keepStockByWorkbench: {},
  };
}

function migrateV15ToV16(save: SaveGameV15): SaveGameV16 {
  return {
    ...save,
    version: 16,
    recipeAutomationPolicies: {},
  };
}

function migrateV16ToV17(save: SaveGameV16): SaveGameV17 {
  return {
    ...save,
    version: 17,
    conveyorUndergroundPeers: {},
  };
}

function migrateV17ToV18(save: SaveGameV17): SaveGameV18 {
  return {
    ...save,
    version: 18,
    autoAssemblers: {},
  };
}

function migrateV18ToV19(save: SaveGameV18): SaveGameV19 {
  const splitterRouteState: Record<string, { lastSide: "left" | "right" }> = {};
  for (const [id, asset] of Object.entries(save.assets ?? {})) {
    if ((asset as PlacedAsset).type === "conveyor_splitter") {
      splitterRouteState[id] = { lastSide: "left" };
    }
  }
  return {
    ...save,
    version: 19,
    splitterRouteState,
  };
}

function migrateV19ToV20(save: SaveGameV19): SaveGameV20 {
  return {
    ...save,
    version: 20,
    splitterFilterState: {},
  };
}

function migrateV20ToV21(save: SaveGameV20): SaveGameV21 {
  const existingTileMap = (save as Partial<Pick<SaveGameV21, "tileMap">>)
    .tileMap;
  return {
    ...save,
    version: 21,
    tileMap: sanitizeTileMap(existingTileMap, GRID_H, GRID_W),
  };
}

function migrateV21ToV22(save: SaveGameV21): SaveGameV22 {
  const existingShip = (save as unknown as Partial<SaveGameV22>).ship;
  const ship = normalizeShipState(existingShip);
  return { ...save, version: 22, ship };
}

function migrateV22ToV23(save: SaveGameV22): SaveGameV23 {
  const moduleInventory = Array.isArray(
    (save as unknown as Partial<SaveGameV23>).moduleInventory,
  )
    ? (save as unknown as Partial<SaveGameV23>).moduleInventory!
    : [];
  return { ...save, version: 23, moduleInventory };
}

function migrateV23ToV24(save: SaveGameV23): SaveGameV24 {
  const moduleFragments = normalizeModuleFragmentCount(
    (save as unknown as Partial<SaveGameV24>).moduleFragments,
  );
  return { ...save, version: 24, moduleFragments };
}

function migrateV24ToV25(save: SaveGameV24): SaveGameV25 {
  const moduleFragments = normalizeModuleFragmentCount(save.moduleFragments);
  return { ...save, version: 25, moduleFragments };
}

function migrateV25ToV26(save: SaveGameV25): SaveGameV26 {
  return { ...save, version: 26, moduleLabJob: null };
}

function migrateV26ToV27(save: SaveGameV26): SaveGameV27 {
  return { ...save, version: 27, ship: normalizeShipState(save.ship) };
}

function migrateV27ToV28(save: SaveGameV27): SaveGameV28 {
  const assets: Record<string, PlacedAsset> = {};
  for (const [id, asset] of Object.entries(save.assets ?? {})) {
    assets[id] = { ...asset, moduleSlot: asset.moduleSlot ?? null };
  }

  return { ...save, version: 28, assets };
}

function migrateV28ToV29(save: SaveGameV28): SaveGameV29 {
  return {
    ...save,
    version: 29,
    ship: normalizeShipState((save as Partial<SaveGameV28>).ship),
  };
}

function migrateV29ToV30(save: SaveGameV29): SaveGameV30 {
  const state = { ...save, version: 30 } as Omit<SaveGameV29, "version"> & {
    version: 30;
  };
  if (state.starterDrone !== undefined) {
    delete (state as any).starterDrone;
  }
  return state as SaveGameV30;
}

function migrateV30ToV31(save: SaveGameV30): SaveGameV31 {
  // Strategy A: existing saves keep access to every building they had before
  // the unlock system existed. Fresh games start gated via TIER_0_UNLOCKED_BUILDINGS.
  return {
    ...save,
    version: 31,
    unlockedBuildings: [...ALL_BUILDING_TYPES_FOR_LEGACY_UNLOCK],
  };
}

const MIGRATIONS: MigrationStep[] = [
  step(0, 1, migrateV0ToV1),
  step(1, 2, migrateV1ToV2),
  step(2, 3, migrateV2ToV3),
  step(3, 4, migrateV3ToV4),
  step(4, 5, migrateV4ToV5),
  step(5, 6, migrateV5ToV6),
  step(6, 7, migrateV6ToV7),
  step(7, 8, migrateV7ToV8),
  step(8, 9, migrateV8ToV9),
  step(9, 10, migrateV9ToV10),
  step(10, 11, migrateV10ToV11),
  step(11, 12, migrateV11ToV12),
  step(12, 13, migrateV12ToV13),
  step(13, 14, migrateV13ToV14),
  step(14, 15, migrateV14ToV15),
  step(15, 16, migrateV15ToV16),
  step(16, 17, migrateV16ToV17),
  step(17, 18, migrateV17ToV18),
  step(18, 19, migrateV18ToV19),
  step(19, 20, migrateV19ToV20),
  step(20, 21, migrateV20ToV21),
  step(21, 22, migrateV21ToV22),
  step(22, 23, migrateV22ToV23),
  step(23, 24, migrateV23ToV24),
  step(24, 25, migrateV24ToV25),
  step(25, 26, migrateV25ToV26),
  step(26, 27, migrateV26ToV27),
  step(27, 28, migrateV27ToV28),
  step(28, 29, migrateV28ToV29),
  step(29, 30, migrateV29ToV30),
  step(30, 31, migrateV30ToV31),
];

export function migrateSave(raw: unknown): SaveGameLatest | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;
  let version: number =
    typeof data.version === "number" && Number.isFinite(data.version)
      ? data.version
      : 0;

  if (version > CURRENT_SAVE_VERSION) {
    // eslint-disable-next-line no-console -- load-time save incompatibility diagnostics should reach DEV consoles.
    console.warn(
      `[save] Save version ${version} is newer than code version ${CURRENT_SAVE_VERSION}. Ignoring save.`,
    );
    return null;
  }

  let save: unknown = data;
  for (const step of MIGRATIONS) {
    if (version === step.from) {
      save = step.migrate(save);
      version = step.to;
    }
  }

  if (version !== CURRENT_SAVE_VERSION) {
    // eslint-disable-next-line no-console -- load-time save corruption diagnostics should reach DEV consoles.
    console.warn(
      `[save] Migration ended at v${version}, expected v${CURRENT_SAVE_VERSION}. Save may be corrupted.`,
    );
    return null;
  }

  return save as SaveGameLatest;
}
