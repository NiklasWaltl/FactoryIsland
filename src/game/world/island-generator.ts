import type { TileType } from "./tile-types";

export const ISLAND_WATER_BORDER_TILES = 7;
export const ISLAND_SAND_BORDER_TILES = 2;

export function generateIslandTileMap(
  rows: number,
  cols: number,
): TileType[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      const distanceToEdge = Math.min(row, col, rows - row - 1, cols - col - 1);
      if (distanceToEdge < ISLAND_WATER_BORDER_TILES) return "water";
      if (
        distanceToEdge <
        ISLAND_WATER_BORDER_TILES + ISLAND_SAND_BORDER_TILES
      ) {
        return "sand";
      }
      return "grass";
    }),
  );
}

export function isPlayableTile(tile: TileType): boolean {
  return tile === "grass";
}
