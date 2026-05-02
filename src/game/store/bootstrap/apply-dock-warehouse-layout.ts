import { getDockWarehousePos } from "../constants/map/map-layout";
import { createEmptyInventory } from "../inventory-ops";
import { cellKey } from "../utils/cell-key";
import type { GameState, PlacedAsset } from "../types";

export const DOCK_WAREHOUSE_ID = "dock-warehouse";

export function applyDockWarehouseLayout(state: GameState): GameState {
  if (state.assets[DOCK_WAREHOUSE_ID]) return state;

  const { x, y } = getDockWarehousePos(state.tileMap);

  for (let dx = 0; dx < 2; dx++) {
    for (let dy = 0; dy < 2; dy++) {
      const key = cellKey(x + dx, y + dy);
      if (state.cellMap[key]) {
        throw new Error(
          `DOCK_WAREHOUSE_POS (${x},${y}) conflicts with existing asset '${state.cellMap[key]}' at cell (${x + dx},${y + dy}).`,
        );
      }
    }
  }

  const asset: PlacedAsset = {
    id: DOCK_WAREHOUSE_ID,
    type: "dock_warehouse",
    x,
    y,
    size: 2,
    width: 2,
    height: 2,
    fixed: true,
    isDockWarehouse: true,
  };

  const cellMap = {
    ...state.cellMap,
    [cellKey(x, y)]: DOCK_WAREHOUSE_ID,
    [cellKey(x + 1, y)]: DOCK_WAREHOUSE_ID,
    [cellKey(x, y + 1)]: DOCK_WAREHOUSE_ID,
    [cellKey(x + 1, y + 1)]: DOCK_WAREHOUSE_ID,
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
