import { GRID_H } from "../../../constants/grid";
import {
  ISLAND_SAND_BORDER_TILES,
  ISLAND_WATER_BORDER_TILES,
} from "../../../world/island-generator";
import type { TileType } from "../../../world/tile-types";

const DOCK_WAREHOUSE_BEACH_OFFSET_TILES = 1;

export const BEACH_START_ROW =
  GRID_H - ISLAND_WATER_BORDER_TILES - ISLAND_SAND_BORDER_TILES;
export const WATER_START_ROW = BEACH_START_ROW + ISLAND_SAND_BORDER_TILES;

/**
 * Position of the dock warehouse: horizontal map center on the last grass row
 * before the bottom beach. Returns the top-left corner of the 2x2 building footprint.
 */
export function getDockWarehousePos(tileMap: TileType[][]): {
  x: number;
  y: number;
} {
  const x = Math.floor(getTileMapWidth(tileMap) / 2);
  const y = getDockBeachStartRow(tileMap) - DOCK_WAREHOUSE_BEACH_OFFSET_TILES;
  return { x, y };
}

export function getDockBeachStartRow(tileMap: TileType[][]): number {
  const centerX = Math.floor(getTileMapWidth(tileMap) / 2);

  for (let row = 1; row < tileMap.length; row += 1) {
    const previousTile = tileMap[row - 1]?.[centerX];
    const currentTile = tileMap[row]?.[centerX];
    if (previousTile === "grass" && currentTile === "sand") return row;
  }

  throw new Error(
    "Dock beach start row not found: expected a grass-to-sand transition at the horizontal map center.",
  );
}

/** Tile on the dock warehouse footprint used as the visible conveyor input marker. */
export function getInputTilePosition(dockWarehouse: { x: number; y: number }): {
  x: number;
  y: number;
} {
  return { x: dockWarehouse.x, y: dockWarehouse.y };
}

export function getDockWarehouseInputTile(tileMap: TileType[][]): {
  x: number;
  y: number;
} {
  const pos = getDockWarehousePos(tileMap);
  return getInputTilePosition(pos);
}

function getTileMapWidth(tileMap: TileType[][]): number {
  const width = tileMap[0]?.length ?? 0;
  if (width <= 0) {
    throw new Error("Tile map has no columns for dock warehouse layout.");
  }
  return width;
}
