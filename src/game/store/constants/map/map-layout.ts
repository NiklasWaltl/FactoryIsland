import type { TileType } from "../../../world/tile-types";

const DOCK_WAREHOUSE_BEACH_OFFSET_TILES = 1;

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

/** Tile directly to the left of the dock warehouse — used as the conveyor input tile. */
export function getDockWarehouseInputTile(tileMap: TileType[][]): {
  x: number;
  y: number;
} {
  const pos = getDockWarehousePos(tileMap);
  return { x: pos.x - 1, y: pos.y };
}

function getTileMapWidth(tileMap: TileType[][]): number {
  const width = tileMap[0]?.length ?? 0;
  if (width <= 0) {
    throw new Error("Tile map has no columns for dock warehouse layout.");
  }
  return width;
}
