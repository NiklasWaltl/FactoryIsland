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
  ModuleFragmentCount,
  ModuleLabJob,
} from "../../store/types";
import type { ShipState } from "../../store/types/ship-types";
import type { Module } from "../../modules/module.types";
import type { TileType } from "../../world/tile-types";
import type { NetworkSlice } from "../../inventory/reservationTypes";
import type { CraftingQueueState } from "../../crafting/types";
import { type RecipeAutomationPolicyMap } from "../../crafting/policies";

/** Current save format version. Bump when persisted shape changes. */
export const CURRENT_SAVE_VERSION = 32;

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
      left: import("../../store/types/conveyor-types").ConveyorItem | null;
      right: import("../../store/types/conveyor-types").ConveyorItem | null;
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

export interface SaveGameV32 extends Omit<SaveGameV31, "version"> {
  version: 32;
}

export type SaveGameLatest = SaveGameV32;

export type MigrationStep = {
  from: number;
  to: number;
  migrate: (save: unknown) => unknown;
};
