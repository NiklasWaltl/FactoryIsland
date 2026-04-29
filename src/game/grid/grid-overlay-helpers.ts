import { GRID_H, GRID_W } from "../constants/grid";
import { cellKey } from "../store/cell-key";
import { getWarehouseInputCell, isValidWarehouseInput } from "../store/warehouse-input";
import type { GameState } from "../store/types";

export interface WarehouseMarkerData {
  id: string;
  x: number;
  y: number;
  hasFeedingBelt: boolean;
}

interface CollectWarehouseMarkersParams {
  state: GameState;
  minCellX: number;
  minCellY: number;
  maxCellX: number;
  maxCellY: number;
}

export function collectWarehouseMarkers({
  state,
  minCellX,
  minCellY,
  maxCellX,
  maxCellY,
}: CollectWarehouseMarkersParams): WarehouseMarkerData[] {
  const warehouseMarkers: WarehouseMarkerData[] = [];

  for (const asset of Object.values(state.assets)) {
    if (asset.type !== "warehouse") continue;
    const { x: inputX, y: inputY } = getWarehouseInputCell(asset);
    if (inputX >= GRID_W || inputY >= GRID_H) continue;
    if (inputX < minCellX || inputX > maxCellX || inputY < minCellY || inputY > maxCellY) continue;

    const tileAssetId = state.cellMap[cellKey(inputX, inputY)];
    const tileAsset = tileAssetId ? state.assets[tileAssetId] : null;
    const hasFeedingBelt =
      tileAsset?.type === "conveyor" &&
      isValidWarehouseInput(tileAsset.x, tileAsset.y, tileAsset.direction ?? "east", asset);

    warehouseMarkers.push({
      id: asset.id,
      x: inputX,
      y: inputY,
      hasFeedingBelt,
    });
  }

  return warehouseMarkers;
}
