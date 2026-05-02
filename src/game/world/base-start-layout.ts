import { createEmptyHubInventory } from "../buildings/service-hub/hub-upgrade-workflow";
import { createDefaultProtoHubTargetStock } from "../store/constants/hub/hub-target-stock";
import { createEmptyInventory } from "../store/inventory-ops";
import type {
  AssetType,
  GameState,
  PlacedAsset,
  StarterDroneState,
} from "../store/types";
import { cellKey } from "../store/utils/cell-key";
import {
  getStartAreaAnchor,
  getStartAreaBounds,
  isBoundsInsideBounds,
  type TileBounds,
} from "./core-layout";
import type { TileType } from "./tile-types";

export const BASE_START_IDS = {
  mapShop: "map-shop",
  serviceHub: "service-hub-proto",
  warehouse: "warehouse-starter",
} as const;

const BASE_START_OBJECT_SIZE_TILES = 2;

const BASE_START_OFFSETS = {
  mapShop: { row: -1, col: -1 },
  serviceHub: { row: -1, col: 2 },
  warehouse: { row: -3, col: -1 },
} as const;

export interface BaseStartObjectDefinition {
  readonly id: string;
  readonly type: AssetType;
  readonly x: number;
  readonly y: number;
  readonly size: 1 | 2;
  readonly width: 1 | 2;
  readonly height: 1 | 2;
  readonly fixed?: boolean;
  readonly droneIds?: readonly string[];
}

export interface BaseStartLayout {
  readonly assets: readonly BaseStartObjectDefinition[];
  readonly starterDroneHubId: string;
}

export function createBaseStartLayout(tileMap: TileType[][]): BaseStartLayout {
  const anchor = getStartAreaAnchor(tileMap);
  const at = (offset: { readonly row: number; readonly col: number }) => ({
    x: anchor.col + offset.col,
    y: anchor.row + offset.row,
  });

  const mapShop = at(BASE_START_OFFSETS.mapShop);
  const hub = at(BASE_START_OFFSETS.serviceHub);
  const starterWarehouse = at(BASE_START_OFFSETS.warehouse);

  const layout: BaseStartLayout = {
    assets: [
      baseStartObject(BASE_START_IDS.mapShop, "map_shop", mapShop.x, mapShop.y, {
        fixed: true,
      }),
      baseStartObject(
        BASE_START_IDS.serviceHub,
        "service_hub",
        hub.x,
        hub.y,
        { fixed: true, droneIds: ["starter"] },
      ),
      baseStartObject(
        BASE_START_IDS.warehouse,
        "warehouse",
        starterWarehouse.x,
        starterWarehouse.y,
      ),
    ],
    starterDroneHubId: BASE_START_IDS.serviceHub,
  };

  assertBaseStartLayoutInsideStartArea(layout.assets, tileMap);
  return layout;
}

export function applyBaseStartLayout(state: GameState): GameState {
  if (hasRequiredBaseStartLayout(state)) return state;
  assertNoPartialBaseStartLayout(state);

  const layout = createBaseStartLayout(state.tileMap);
  const assets = { ...state.assets };
  const cellMap = { ...state.cellMap };

  for (const definition of layout.assets) {
    const asset = toPlacedAsset(definition);
    assertBaseStartCellsFree(state, cellMap, asset);
    assets[asset.id] = asset;
    forEachBaseStartCell(asset, (x, y) => {
      cellMap[cellKey(x, y)] = asset.id;
    });
  }

  const hubAsset = assets[layout.starterDroneHubId];
  if (!hubAsset) {
    throw new Error("Base start layout was resolved but not applied to initial runtime state.");
  }

  const starterDrone = createDockedStarterDrone(
    state.drones.starter ?? state.starterDrone,
    layout.starterDroneHubId,
    hubAsset.x,
    hubAsset.y,
  );

  const next: GameState = {
    ...state,
    assets,
    cellMap,
    warehouseInventories: {
      ...state.warehouseInventories,
      [BASE_START_IDS.warehouse]: createEmptyInventory(),
    },
    serviceHubs: {
      ...state.serviceHubs,
      [BASE_START_IDS.serviceHub]: {
        tier: 1,
        inventory: createEmptyHubInventory(),
        droneIds: [starterDrone.droneId],
        targetStock: createDefaultProtoHubTargetStock(),
      },
    },
    starterDrone,
    drones: {
      ...state.drones,
      [starterDrone.droneId]: starterDrone,
    },
  };

  const withWarehouseCounts = {
    ...next,
    warehousesPurchased: Object.values(next.assets).filter(
      (asset) => asset.type === "warehouse",
    ).length,
    warehousesPlaced: Object.values(next.assets).filter(
      (asset) => asset.type === "warehouse",
    ).length,
  };

  assertRequiredBaseStartLayout(withWarehouseCounts);
  return withWarehouseCounts;
}

export function hasRequiredBaseStartLayout(state: GameState): boolean {
  return (
    state.assets[BASE_START_IDS.mapShop]?.type === "map_shop" &&
    state.assets[BASE_START_IDS.serviceHub]?.type === "service_hub" &&
    state.assets[BASE_START_IDS.warehouse]?.type === "warehouse" &&
    !!state.warehouseInventories[BASE_START_IDS.warehouse] &&
    !!state.serviceHubs[BASE_START_IDS.serviceHub] &&
    state.starterDrone.hubId === BASE_START_IDS.serviceHub &&
    state.drones.starter?.hubId === BASE_START_IDS.serviceHub
  );
}

export function assertRequiredBaseStartLayout(state: GameState): void {
  if (!hasRequiredBaseStartLayout(state)) {
    throw new Error("Fresh game state missing required base start layout objects.");
  }
}

function baseStartObject(
  id: string,
  type: AssetType,
  x: number,
  y: number,
  options: Pick<BaseStartObjectDefinition, "fixed" | "droneIds"> = {},
): BaseStartObjectDefinition {
  return {
    id,
    type,
    x,
    y,
    size: BASE_START_OBJECT_SIZE_TILES,
    width: BASE_START_OBJECT_SIZE_TILES,
    height: BASE_START_OBJECT_SIZE_TILES,
    ...options,
  };
}

function assertBaseStartLayoutInsideStartArea(
  assets: readonly BaseStartObjectDefinition[],
  tileMap: TileType[][],
): void {
  const startArea = getStartAreaBounds(tileMap);
  for (const definition of assets) {
    assertAssetFootprintInsideStartArea(definition, startArea);
  }
}

function assertAssetFootprintInsideStartArea(
  definition: BaseStartObjectDefinition,
  startArea: TileBounds,
): void {
  const footprint: TileBounds = {
    row: definition.y,
    col: definition.x,
    width: definition.width,
    height: definition.height,
  };

  if (isBoundsInsideBounds(footprint, startArea)) return;

  for (let row = footprint.row; row < footprint.row + footprint.height; row += 1) {
    for (let col = footprint.col; col < footprint.col + footprint.width; col += 1) {
      if (
        row < startArea.row ||
        row >= startArea.row + startArea.height ||
        col < startArea.col ||
        col >= startArea.col + startArea.width
      ) {
        throw new Error(
          `Starter layout object placed outside start area at row ${row} col ${col}`,
        );
      }
    }
  }
}

function assertNoPartialBaseStartLayout(state: GameState): void {
  const existingIds = Object.values(BASE_START_IDS).filter((id) => state.assets[id]);
  if (existingIds.length === 0) return;
  throw new Error(
    `Base start layout was resolved but not applied to initial runtime state: partial objects ${existingIds.join(", ")}`,
  );
}

function toPlacedAsset(definition: BaseStartObjectDefinition): PlacedAsset {
  return {
    id: definition.id,
    type: definition.type,
    x: definition.x,
    y: definition.y,
    size: definition.size,
    width: definition.width,
    height: definition.height,
    fixed: definition.fixed,
  };
}

function assertBaseStartCellsFree(
  state: GameState,
  cellMap: GameState["cellMap"],
  asset: PlacedAsset,
): void {
  forEachBaseStartCell(asset, (x, y) => {
    const occupiedBy = cellMap[cellKey(x, y)];
    if (!occupiedBy) return;
    throw new Error(
      `Base start layout object '${asset.id}' overlaps '${occupiedBy}' at row ${y} col ${x}.`,
    );
  });

  assertBaseStartLayoutInsideStartArea(
    [
      {
        id: asset.id,
        type: asset.type,
        x: asset.x,
        y: asset.y,
        size: asset.size,
        width: asset.width ?? asset.size,
        height: asset.height ?? asset.size,
        fixed: asset.fixed,
      },
    ],
    state.tileMap,
  );
}

function createDockedStarterDrone(
  starterDrone: StarterDroneState,
  hubId: string,
  tileX: number,
  tileY: number,
): StarterDroneState {
  return {
    ...starterDrone,
    hubId,
    tileX,
    tileY,
    status: "idle",
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
    droneId: starterDrone.droneId ?? "starter",
  };
}

function forEachBaseStartCell(
  asset: Pick<PlacedAsset, "x" | "y" | "size" | "width" | "height">,
  visit: (x: number, y: number) => void,
): void {
  const width = asset.width ?? asset.size;
  const height = asset.height ?? asset.size;
  for (let dx = 0; dx < width; dx += 1) {
    for (let dy = 0; dy < height; dy += 1) {
      visit(asset.x + dx, asset.y + dy);
    }
  }
}