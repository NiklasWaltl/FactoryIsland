import type { GameAction } from "../game-actions";
import type { GameState } from "../types";

/**
 * Contract for a Bounded Context reducer slice.
 * Each context owns a specific subset of GameState and handles
 * only the GameAction types relevant to its domain.
 */
export interface BoundedContext<State> {
  /**
   * Applies the action to the context's state slice.
   * Returns the new state if this context handles the action,
   * or null if the action is not relevant to this context.
   */
  reduce(state: State, action: GameAction): State | null;

  /** The GameAction type strings this context explicitly handles. */
  readonly handledActionTypes: readonly string[];
}

// Single-field contexts
export type AutoMinerContextState = Pick<GameState, "autoMiners">;
export type AutoSmelterContextState = Pick<GameState, "autoSmelters">;
export type AutoAssemblerContextState = Pick<GameState, "autoAssemblers">;
export type ResearchLabContextState = Pick<GameState, "unlockedBuildings">;

// Multi-field contexts
export type CraftingContextState = Pick<
  GameState,
  "crafting" | "keepStockByWorkbench" | "recipeAutomationPolicies"
>;

export type DroneContextState = Pick<GameState, "drones">;

export type InventoryContextState = Pick<GameState, "inventory" | "network">;

export type WarehouseContextState = Pick<
  GameState,
  "warehousesPlaced" | "warehouseInventories"
>;

export type PowerContextState = Pick<
  GameState,
  "battery" | "generators" | "poweredMachineIds" | "machinePowerRatio"
>;

export type ConstructionContextState = Pick<
  GameState,
  "constructionSites" | "assets"
>;

// TODO: GameState has no "modules" field; "moduleInventory" is the
// current module collection field.
export type ModuleLabContextState = Pick<
  GameState,
  "moduleLabJob" | "moduleFragments" | "moduleInventory"
>;

export type ConveyorContextState = Pick<
  GameState,
  "conveyors" | "splitterFilterState"
>;

export type ZoneContextState = Pick<
  GameState,
  "productionZones" | "buildingZoneIds" | "buildingSourceWarehouseIds"
>;

export type ShipContextState = Pick<GameState, "ship">;

// TODO: GameState has no "selectedAssetId", "hotbar", or "debugMode" fields.
// Current UI state uses selected panel IDs, hotbarSlots/activeSlot, and
// debug-facing overlays/errors.
export type UiContextState = Pick<
  GameState,
  | "selectedWarehouseId"
  | "selectedPowerPoleId"
  | "selectedAutoMinerId"
  | "selectedAutoSmelterId"
  | "selectedAutoAssemblerId"
  | "selectedGeneratorId"
  | "selectedServiceHubId"
  | "selectedCraftingBuildingId"
  | "selectedSplitterId"
  | "openPanel"
  | "notifications"
  | "buildMode"
  | "hotbarSlots"
  | "activeSlot"
  | "energyDebugOverlay"
  | "lastTickError"
>;

export interface ContextRegistry {
  crafting: BoundedContext<CraftingContextState>;
  drones: BoundedContext<DroneContextState>;
  inventory: BoundedContext<InventoryContextState>;
  warehouse: BoundedContext<WarehouseContextState>;
  power: BoundedContext<PowerContextState>;
  construction: BoundedContext<ConstructionContextState>;
  autoMiner: BoundedContext<AutoMinerContextState>;
  autoSmelter: BoundedContext<AutoSmelterContextState>;
  autoAssembler: BoundedContext<AutoAssemblerContextState>;
  moduleLab: BoundedContext<ModuleLabContextState>;
  researchLab: BoundedContext<ResearchLabContextState>;
  conveyor: BoundedContext<ConveyorContextState>;
  zone: BoundedContext<ZoneContextState>;
  ship: BoundedContext<ShipContextState>;
  ui: BoundedContext<UiContextState>;
}
