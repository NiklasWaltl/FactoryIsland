import { generateIslandTileMap } from "./island-generator";
import type { TileType } from "./tile-types";

const VALID_TILE_TYPES = new Set<TileType>(["grass", "water", "sand"]);

export function sanitizeTileMap(
  raw: unknown,
  fallbackRows: number,
  fallbackCols: number,
): TileType[][] {
  const fallback = generateIslandTileMap(fallbackRows, fallbackCols);
  if (!Array.isArray(raw) || raw.length !== fallbackRows) return fallback;

  const sanitized: TileType[][] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length !== fallbackCols) return fallback;

    const sanitizedRow: TileType[] = [];
    for (const tile of row) {
      if (!VALID_TILE_TYPES.has(tile as TileType)) return fallback;
      sanitizedRow.push(tile as TileType);
    }
    sanitized.push(sanitizedRow);
  }

  return sanitized;
}