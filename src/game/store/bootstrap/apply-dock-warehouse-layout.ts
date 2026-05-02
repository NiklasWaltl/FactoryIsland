import { getDockWarehousePos } from "../constants/map/map-layout";
import { createEmptyInventory } from "../inventory-ops";
import { cellKey } from "../utils/cell-key";
import type { GameState, PlacedAsset } from "../types";

export const DOCK_WAREHOUSE_ID = "dock-warehouse";
const DOCK_WAREHOUSE_SIZE_TILES = 2;

export function applyDockWarehouseLayout(state: GameState): GameState {
  const { x, y } = getDockWarehousePos(state.tileMap);
  const existingAsset = state.assets[DOCK_WAREHOUSE_ID];

  if (existingAsset) {
    if (
      existingAsset.x === x &&
      existingAsset.y === y &&
      (existingAsset.width ?? existingAsset.size) ===
        DOCK_WAREHOUSE_SIZE_TILES &&
      (existingAsset.height ?? existingAsset.size) === DOCK_WAREHOUSE_SIZE_TILES
    ) {
      return ensureDockWarehouseInventory(state);
    }

    const cellMap = putDockWarehouseCells(
      withoutDockWarehouseCells(state.cellMap),
      x,
      y,
    );

    return ensureDockWarehouseInventory({
      ...state,
      assets: {
        ...state.assets,
        [DOCK_WAREHOUSE_ID]: {
          ...existingAsset,
          x,
          y,
          size: DOCK_WAREHOUSE_SIZE_TILES,
          width: DOCK_WAREHOUSE_SIZE_TILES,
          height: DOCK_WAREHOUSE_SIZE_TILES,
          fixed: true,
          isDockWarehouse: true,
        },
      },
      cellMap,
    });
  }

  const cellMap = putDockWarehouseCells(state.cellMap, x, y);

  const asset: PlacedAsset = {
    id: DOCK_WAREHOUSE_ID,
    type: "dock_warehouse",
    x,
    y,
    size: DOCK_WAREHOUSE_SIZE_TILES,
    width: DOCK_WAREHOUSE_SIZE_TILES,
    height: DOCK_WAREHOUSE_SIZE_TILES,
    fixed: true,
    isDockWarehouse: true,
  };

  return {
    ...state,
    assets: { ...state.assets, [DOCK_WAREHOUSE_ID]: asset },
    cellMap,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: createEmptyInventory(),
    },
    warehousesPurchased: state.warehousesPurchased + 1,
    warehousesPlaced: state.warehousesPlaced + 1,
  };
}

function putDockWarehouseCells(
  cellMap: GameState["cellMap"],
  x: number,
  y: number,
): GameState["cellMap"] {
  const nextCellMap = { ...cellMap };
  forEachDockWarehouseCell(x, y, (cellX, cellY) => {
    const key = cellKey(cellX, cellY);
    if (nextCellMap[key]) {
      throw new Error(
        `DOCK_WAREHOUSE_POS (${x},${y}) conflicts with existing asset '${nextCellMap[key]}' at cell (${cellX},${cellY}).`,
      );
    }
    nextCellMap[key] = DOCK_WAREHOUSE_ID;
  });
  return nextCellMap;
}

function withoutDockWarehouseCells(
  cellMap: GameState["cellMap"],
): GameState["cellMap"] {
  const nextCellMap = { ...cellMap };
  for (const [key, assetId] of Object.entries(cellMap)) {
    if (assetId === DOCK_WAREHOUSE_ID) delete nextCellMap[key];
  }
  return nextCellMap;
}

function ensureDockWarehouseInventory(state: GameState): GameState {
  if (state.warehouseInventories[DOCK_WAREHOUSE_ID]) return state;
  return {
    ...state,
    warehouseInventories: {
      ...state.warehouseInventories,
      [DOCK_WAREHOUSE_ID]: createEmptyInventory(),
    },
  };
}

function forEachDockWarehouseCell(
  x: number,
  y: number,
  visit: (cellX: number, cellY: number) => void,
): void {
  for (let dx = 0; dx < DOCK_WAREHOUSE_SIZE_TILES; dx += 1) {
    for (let dy = 0; dy < DOCK_WAREHOUSE_SIZE_TILES; dy += 1) {
      visit(x + dx, y + dy);
    }
  }
}
