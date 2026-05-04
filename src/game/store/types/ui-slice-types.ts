import type { GameState } from "../types";

export type HotbarStateSlice = Pick<GameState, "hotbarSlots" | "activeSlot">;

export interface ShipStatusSlice {
  readonly ship: GameState["ship"];
  readonly dockInventory: GameState["warehouseInventories"][string] | undefined;
}

export interface MapShopStateSlice {
  readonly coins: GameState["inventory"]["coins"];
}

export interface HudStateSlice {
  mode: GameState["mode"];
  warehousesPlaced: GameState["warehousesPlaced"];
  inventory: GameState["inventory"];
  warehouseInventories: GameState["warehouseInventories"];
  serviceHubs: GameState["serviceHubs"];
  moduleFragments: GameState["moduleFragments"];
}

export interface BuildUIStateSlice {
  buildMode: GameState["buildMode"];
  selectedBuildingType: GameState["selectedBuildingType"];
  selectedFloorTile: GameState["selectedFloorTile"];
  placedBuildings: GameState["placedBuildings"];
  warehousesPlaced: GameState["warehousesPlaced"];
  energyDebugOverlay: GameState["energyDebugOverlay"];
  serviceHubs: GameState["serviceHubs"];
  collectionNodes: GameState["collectionNodes"];
  inventory: GameState["inventory"];
  warehouseInventories: GameState["warehouseInventories"];
}