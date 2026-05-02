import type { TileType } from "../../../world/tile-types";
import { getCorePlayableBounds } from "../../../world/core-layout";

/**
 * Position of the dock warehouse — bottom-center of the core playable area.
 * Returns the top-left corner of the 2×2 building footprint.
 */
export function getDockWarehousePos(tileMap: TileType[][]): { x: number; y: number } {
  const core = getCorePlayableBounds(tileMap);
  const x = core.col + Math.floor((core.width - 2) / 2);
  const y = core.row + core.height - 2;
  return { x, y };
}

/** Tile directly to the left of the dock warehouse — used as the conveyor input tile. */
export function getDockWarehouseInputTile(tileMap: TileType[][]): { x: number; y: number } {
  const pos = getDockWarehousePos(tileMap);
  return { x: pos.x - 1, y: pos.y };
}
