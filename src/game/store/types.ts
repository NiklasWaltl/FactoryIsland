// ============================================================
// Factory Island — Core Type Declarations
// ------------------------------------------------------------
// Extracted from store/reducer.ts. Pure type/interface module.
// The reducer re-exports every symbol declared here so existing
// `from "../store/reducer"` imports keep working.
//
// IMPORTANT: This module is type-only at runtime. Any value
// imports here would create a real ESM cycle with reducer.ts.
// `import type` is fine (erased at compile time).
// ============================================================

import type {
  RecipeAutomationPolicyEntry,
  RecipeAutomationPolicyMap,
} from "../crafting/policies";
import type { ItemId } from "../items/types";
import type { TileType } from "../world/tile-types";
import type { Module, ModuleType } from "../modules/module.types";
import type { StarterDroneState } from "./types/drone-types";
import type { KeepStockByWorkbench } from "./types/crafting-types";
import type {
  ConveyorState,
  AutoSmelterEntry,
  AutoAssemblerEntry,
} from "./types/conveyor-types";
import type { ShipState } from "./types/ship-types";

export type { RecipeAutomationPolicyEntry, RecipeAutomationPolicyMap };
export type { ShipStatus, ShipQuest, ShipReward, ShipState } from "./types/ship-types";
export type {
  DroneRole,
  DroneStatus,
  DroneCargoItem,
  StarterDroneState,
  DroneTaskType,
} from "./types/drone-types";
export type {
  KeepStockTargetEntry,
  KeepStockByWorkbench,
  CraftingSource,
  WorkbenchSource,
} from "./types/crafting-types";
export type {
  ConveyorItem,
  ConveyorState,
  AutoSmelterStatus,
  AutoSmelterProcessing,
  AutoSmelterEntry,
  AutoAssemblerRecipeId,
  AutoAssemblerStatus,
  AutoAssemblerEntry,
} from "./types/conveyor-types";

export type GameMode = "release" | "debug";

export type ModuleFragmentCount = number;

export type AssetType =
  | "tree"
  | "stone"
  | "iron"
  | "copper"
  | "sapling"
  | "workbench"
  | "warehouse"
  | "smithy"
  | "generator"
  | "cable"
  | "battery"
  | "power_pole"
  | "map_shop"
  | "stone_deposit"
  | "iron_deposit"
  | "copper_deposit"
  | "auto_miner"
  | "conveyor"
  | "conveyor_corner"
  | "conveyor_merger"
  | "conveyor_splitter"
  | "conveyor_underground_in"
  | "conveyor_underground_out"
  | "manual_assembler"
  | "auto_smelter"
  | "auto_assembler"
  | "service_hub"
  | "dock_warehouse"
  | "module_lab";

export type BuildingType =
  | "workbench"
  | "warehouse"
  | "smithy"
  | "generator"
  | "cable"
  | "battery"
  | "power_pole"
  | "auto_miner"
  | "conveyor"
  | "conveyor_corner"
  | "conveyor_merger"
  | "conveyor_splitter"
  | "conveyor_underground_in"
  | "conveyor_underground_out"
  | "manual_assembler"
  | "auto_smelter"
  | "auto_assembler"
  | "service_hub"
  | "dock_warehouse"
  | "module_lab";

/** Floor tiles that can be placed on the ground layer */
export type FloorTileType = "stone_floor" | "grass_block";

export type MachinePriority = 1 | 2 | 3 | 4 | 5;

export interface PlacedAsset {
  id: string;
  type: AssetType;
  x: number;
  y: number;
  size: 1 | 2;
  width?: 1 | 2;
  height?: 1 | 2;
  fixed?: boolean;
  direction?: Direction;
  /** Energy scheduling priority (1 highest, 5 lowest) for consumer machines */
  priority?: MachinePriority;
  /**
   * Overclocking flag. Nur für auto_miner und auto_smelter unterstützt — die
   * SET_MACHINE_BOOST-Action erzwingt diesen Typ-Check. Andere Asset-Typen
   * ignorieren das Feld vollständig.
   */
  boosted?: boolean;
  /** Marks this warehouse as the ship's dock warehouse. Only one may exist. */
  isDockWarehouse?: boolean;
}

/**
 * Inventory shape — derived from `ItemId` so any new item id is
 * automatically required at every place that constructs an Inventory.
 *
 * RUNTIME FORM: identical to the previous hand-written interface — a
 * plain object with `coins` plus one numeric field per ItemId. JSON
 * persistence is unchanged; no save migration required.
 *
 * `coins` is intentionally NOT part of `ItemId` (coins are not a
 * placeable / craftable item). Adding new item ids belongs in
 * `items/types.ts`; new non-item numeric balances would extend the
 * left-hand `{ coins: number }` half here.
 */
export type Inventory = { coins: number } & Record<ItemId, number>;

export type ToolKind =
  | "axe"
  | "wood_pickaxe"
  | "stone_pickaxe"
  | "sapling"
  | "building"
  | "empty";

export interface HotbarSlot {
  toolKind: ToolKind;
  buildingType?: BuildingType;
  amount: number;
  label: string;
  emoji: string;
}

export interface SmithyState {
  fuel: number;
  iron: number;
  copper: number;
  selectedRecipe: "iron" | "copper";
  processing: boolean;
  progress: number;
  outputIngots: number;
  outputCopperIngots: number;
  /** Asset ID of the smithy that started the current batch (for validation/output routing). */
  buildingId: string | null;
}

export interface ManualAssemblerState {
  processing: boolean;
  recipe: "metal_plate" | "gear" | null;
  progress: number;
  /** Asset ID of the building that started the current job (for output routing). */
  buildingId: string | null;
}

// ---- Directions ----
export type Direction = "north" | "east" | "south" | "west";

// ---- Auto-Miner ----
export interface AutoMinerEntry {
  depositId: string;
  resource: "stone" | "iron" | "copper";
  progress: number;
}

export type UIPanel =
  | "map_shop"
  | "warehouse"
  | "smithy"
  | "workbench"
  | "generator"
  | "battery"
  | "power_pole"
  | "auto_miner"
  | "auto_smelter"
  | "auto_assembler"
  | "manual_assembler"
  | "service_hub"
  | "conveyor_splitter"
  | "dock_warehouse"
  | "fragment_trader"
  | "module_lab"
  | null;

// ---- Battery ----
export interface BatteryState {
  stored: number;
  capacity: number;
}

// ---- Generator ----
export interface GeneratorState {
  /** Wood currently in the fuel slot (local input buffer, capped at GENERATOR_MAX_FUEL) */
  fuel: number;
  /** Fractional charge progress within the current wood unit (0–1) */
  progress: number;
  /** Whether the generator is actively burning */
  running: boolean;
  /**
   * Wood the player has explicitly requested but that has not yet been delivered.
   * Drones only refill the generator while this counter is positive (no auto-refill).
   * Decremented as wood is deposited; reset implicitly when the generator is rebuilt.
   * Optional for save backward compatibility (treated as 0 when absent).
   */
  requestedRefill?: number;
}

// ---- Energy Network ----
// NOTE: There is no central energy pool. Batteries are the sole energy storage.
// This interface is kept only as documentation of the removed concept.

export interface GameNotification {
  id: string;
  resource: string;
  displayName: string;
  amount: number;
  expiresAt: number;
  kind?: "success" | "error";
}

/**
 * A single entry in the auto-delivery log: records one batch of items
 * that an automatic device delivered into a warehouse.
 * `sourceType` is extendable for future auto-devices (e.g. "auto_smelter").
 */
export interface AutoDeliveryEntry {
  id: string;
  /** Type of the device that produced/delivered the item */
  sourceType: "auto_miner" | "conveyor" | "auto_smelter";
  /** Asset ID of the source device */
  sourceId: string;
  /** The resource key that was delivered */
  resource: string;
  /** Total amount batched into this entry */
  amount: number;
  /** ID of the warehouse that received the items */
  warehouseId: string;
  /** Timestamp of the latest item in this batch */
  timestamp: number;
}

// ---- Collection Node ----
/**
 * Resources dropped by manual harvesting (axe, pickaxe). Live in the world at
 * their tile until picked up by a drone / service hub.
 * They are NOT part of warehouse / central inventory bookkeeping.
 */
export type CollectableItemType = "wood" | "stone" | "iron" | "copper";

export interface CollectionNode {
  id: string;
  itemType: CollectableItemType;
  amount: number;
  tileX: number;
  tileY: number;
  /** Marker that this node is ready to be picked up. Always true in V1. */
  collectable: true;
  /** Creation timestamp (used for ordering / debugging). */
  createdAt: number;
  /**
   * ID of the drone that has claimed this node for pickup.
   * null = unclaimed (any drone may select it).
   * Reservation is released when the drone collects, aborts, or is reset.
   */
  reservedByDroneId: string | null;
}

// ---- Construction Sites ----

/** Tracks the outstanding resource debt for a building placed as a construction site. */
export interface ConstructionSite {
  buildingType: BuildingType;
  /** Resources still needed (only CollectableItemType keys). */
  remaining: Partial<Record<CollectableItemType, number>>;
}

// ---- Service Hub ----

/** Local inventory stored inside a service hub. Only collectable resource types. */
export type ServiceHubInventory = Record<CollectableItemType, number>;

/** Hub progression tier. Tier 1 = Proto-Hub (starter), Tier 2 = Service-Hub (upgraded). */
export type HubTier = 1 | 2;

/** Per-hub runtime state. Keyed by asset ID in GameState.serviceHubs. */
export interface ServiceHubEntry {
  /** Current stock per resource at this hub. */
  inventory: ServiceHubInventory;
  /** Player-configured desired stock level per resource. */
  targetStock: Record<CollectableItemType, number>;
  /** Progression tier: 1 = Proto-Hub, 2 = Service-Hub. */
  tier: HubTier;
  /** IDs of drones assigned to this hub, capped by getMaxDrones(tier). */
  droneIds: string[];
  /**
   * Marker for an in-flight Tier-2 upgrade.
   * Undefined = no upgrade in progress.
   *
   * Runtime fulfillment uses the shared construction-site delivery flow:
   * resources are picked up from valid physical sources and delivered by
   * drones; the tier flip happens after that demand is fully delivered.
   */
  pendingUpgrade?: Partial<Record<CollectableItemType, number>>;
}

/** A production zone groups warehouses and crafting buildings into a shared local resource pool. */
export interface ProductionZone {
  id: string;
  name: string;
}

// ---- Module Lab ----

/**
 * The single in-flight module crafting job at the Module Lab.
 * Only one job may exist at a time across all labs (the lab is non-stackable).
 * Time is tracked in wall-clock ms (Date.now), not engine ticks, mirroring
 * how the smithy/manual-assembler progress fields work today.
 */
export interface ModuleLabJob {
  /** Recipe id from MODULE_FRAGMENT_RECIPES. */
  recipeId: string;
  /** Output module type. */
  moduleType: ModuleType;
  /** Output tier. */
  tier: 1 | 2 | 3;
  /** Fragments consumed up-front when the job started (3 / 5 / 8). */
  fragmentsRequired: number;
  /** Date.now() at job start. */
  startedAt: number;
  /** Total job duration in ms. */
  durationMs: number;
  /**
   * Lifecycle state:
   *  - "crafting": still ticking down
   *  - "done":     ready to be collected via COLLECT_MODULE
   */
  status: "crafting" | "done";
}

export interface GameState {
  mode: GameMode;
  assets: Record<string, PlacedAsset>;
  cellMap: Record<string, string>;
  /** Terrain layer, indexed as [row][col]. */
  tileMap: TileType[][];
  /** Global logistics buffer — passive fallback pool used when no warehouse or zone is assigned
   *  to a building. Receives manual harvest and auto-delivery output when no more specific
   *  target is configured. Use getCapacityPerResource(state) for the per-resource cap. */
  inventory: Inventory;
  /** Owned module instances from the fragment trader. Persisted. */
  moduleInventory: Module[];
  /** Unspent module fragments collected by the player. Persisted. */
  moduleFragments: ModuleFragmentCount;
  /** Single in-flight Module Lab crafting job (max 1 across all labs). Persisted. */
  moduleLabJob: ModuleLabJob | null;
  purchasedBuildings: BuildingType[];
  placedBuildings: BuildingType[];
  warehousesPurchased: number;
  warehousesPlaced: number;
  /** Per-warehouse storage (keyed by warehouse asset ID).
   *  Auto-delivery (conveyors, auto-miners) writes resources here.
   *  Also stores tools/equippable items that can be moved to/from the Hotbar.
   *  V1: Crafting, shop, build costs still use the global `inventory` pool. */
  warehouseInventories: Record<string, Inventory>;
  /** ID of the warehouse whose panel is currently open */
  selectedWarehouseId: string | null;
  cablesPlaced: number;
  powerPolesPlaced: number;
  /** ID of the power pole whose panel is currently open */
  selectedPowerPoleId: string | null;
  hotbarSlots: HotbarSlot[];
  activeSlot: number;
  smithy: SmithyState;
  generators: Record<string, GeneratorState>;
  battery: BatteryState;
  /** Asset IDs currently reachable from a generator via cables */
  connectedAssetIds: string[];
  /** Connected consumer machine IDs that actually received energy in the latest net tick */
  poweredMachineIds: string[];
  openPanel: UIPanel;
  notifications: GameNotification[];
  saplingGrowAt: Record<string, number>;
  /** Whether the Build Mode overlay is active */
  buildMode: boolean;
  /** Building type currently selected in the build menu (ghost preview) */
  selectedBuildingType: BuildingType | null;
  /** Floor tile currently selected in the build menu */
  selectedFloorTile: FloorTileType | null;
  /** Cells with stone floor: key → "stone_floor" */
  floorMap: Record<string, "stone_floor">;
  /** Per-auto-miner production state (keyed by asset ID) */
  autoMiners: Record<string, AutoMinerEntry>;
  /** Per-conveyor item state (keyed by asset ID) */
  conveyors: Record<string, ConveyorState>;
  /**
   * Underground belt tunnel endpoints: each entrance/exit asset ID maps to its peer.
   * Always bidirectional (A→B and B→A). Empty when no tunnels exist.
   */
  conveyorUndergroundPeers: Record<string, string>;
  /** ID of the auto-miner whose panel is currently open */
  selectedAutoMinerId: string | null;
  /** Per-auto-smelter processing state (keyed by asset ID) */
  autoSmelters: Record<string, AutoSmelterEntry>;
  /** ID of the auto-smelter whose panel is currently open */
  selectedAutoSmelterId: string | null;
  /** Per-auto-assembler processing state (keyed by asset ID) */
  autoAssemblers: Record<string, AutoAssemblerEntry>;
  /** ID of the auto-assembler whose panel is currently open */
  selectedAutoAssemblerId: string | null;
  /** ID of the generator whose panel is currently open */
  selectedGeneratorId: string | null;
  /** ID of the service hub whose panel is currently open */
  selectedServiceHubId: string | null;
  /** Manual assembler production state */
  manualAssembler: ManualAssemblerState;
  /** Per-machine power ratio in [0,1] from the latest ENERGY_NET_TICK */
  machinePowerRatio: Record<string, number>;
  /** Whether the energy debug overlay is visible */
  energyDebugOverlay: boolean;
  /** Log of items automatically delivered into warehouses by auto-devices (auto_miner, conveyor, …) */
  autoDeliveryLog: AutoDeliveryEntry[];
  /** Per-building warehouse source assignment (buildingId → warehouseId). Missing key = global. Persisted.
   *  Legacy: superseded by zone assignments when a building has a zone. */
  buildingSourceWarehouseIds: Record<string, string>;
  /** Production zones: zoneId → zone metadata. Persisted. */
  productionZones: Record<string, ProductionZone>;
  /** Per-building zone assignment: buildingId → zoneId. Includes warehouses and crafting buildings. Persisted. */
  buildingZoneIds: Record<string, string>;
  /** ID of the workbench / smithy / assembler whose panel is currently open. Transient. */
  selectedCraftingBuildingId: string | null;
  /**
   * World-bound drops from manual harvesting (Axt / Spitzhacke). Persisted.
   * Keyed by node ID. NOT a warehouse pool — drones address and remove these.
   */
  collectionNodes: Record<string, CollectionNode>;
  /** The single starter drone (future: hub drone). Persisted. */
  starterDrone: StarterDroneState;
  /** All drones keyed by droneId. Persisted. Kept in sync with starterDrone for backward compat. */
  drones: Record<string, StarterDroneState>;
  /** Per-service-hub state (keyed by asset ID). Persisted. */
  serviceHubs: Record<string, ServiceHubEntry>;
  /** Outstanding resource debts for buildings under construction (keyed by asset ID). Persisted. */
  constructionSites: Record<string, ConstructionSite>;
  /**
   * Inventory-network reservation slice (Step 2 of the new crafting/inventory
   * architecture). Tracks logical holds on top of the physical warehouse
   * inventories. The physical inventories remain the source of truth for
   * stored amounts; this slice tracks `reserved` and exposes `free`.
   */
  network: import("../inventory/reservationTypes").NetworkSlice;
  /**
   * Crafting job queue (Step 3). Holds all CraftingJobs across all
   * workbenches. The tick scheduler advances jobs through their state
   * machine; reservations live in `network`.
   */
  crafting: import("../crafting/types").CraftingQueueState;
  /**
   * Optional keep-in-stock targets for workbench recipes.
   * Kept optional so older tests/manual state literals remain valid.
   */
  keepStockByWorkbench?: KeepStockByWorkbench;
  /**
   * Optional per-recipe automation policy overrides.
   * Missing entry means default behavior (auto-craft + keep-in-stock allowed).
   */
  recipeAutomationPolicies?: RecipeAutomationPolicyMap;
  /**
   * Per-splitter Round-Robin routing state (keyed by splitter asset ID). Persisted.
   * Tracks which output side (left/right) was last used for Round-Robin routing.
   */
  splitterRouteState: Record<string, { lastSide: "left" | "right" }>;
  /**
   * Per-splitter pro-Output-Filter state (keyed by splitter asset ID). Persisted.
   * Each output side may carry an optional ConveyorItem filter; null = no filter.
   * When set, the routing layer skips the side if the head item does not match.
   */
  splitterFilterState: import("./slices/splitter-filter-state").SplitterFilterState;
  /** ID of the conveyor_splitter whose panel is currently open. Transient. */
  selectedSplitterId: string | null;
  /** Ship quest loop state. Persisted. */
  ship: ShipState;
}
