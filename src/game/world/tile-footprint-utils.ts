import type { TileBounds } from "./core-layout";
import { isPlayableTile } from "./island-generator";
import type { TileType } from "./tile-types";

export function forEachTileInBounds(
  bounds: TileBounds,
  callback: (row: number, col: number) => void,
): void {
  for (let row = bounds.row; row < bounds.row + bounds.height; row += 1) {
    for (let col = bounds.col; col < bounds.col + bounds.width; col += 1) {
      callback(row, col);
    }
  }
}

export function isTileFootprintPlayable(
  tileMap: TileType[][],
  bounds: TileBounds,
): boolean {
  let playable = true;
  forEachTileInBounds(bounds, (row, col) => {
    const tile = tileMap[row]?.[col];
    if (!tile || !isPlayableTile(tile)) playable = false;
  });
  return playable;
}