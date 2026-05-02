import { isPlayableTile } from "./island-generator";
import type { TileType } from "./tile-types";

export interface TileBounds {
  readonly row: number;
  readonly col: number;
  readonly width: number;
  readonly height: number;
}

export interface TileCoord {
  readonly row: number;
  readonly col: number;
}

export const CORE_PLAYABLE_EDGE_INSET_TILES = 2;
export const START_AREA_WIDTH_TILES = 16;
export const START_AREA_HEIGHT_TILES = 10;
export const START_AREA_FIXED_RESOURCE_CLEARANCE_TILES = 4;

export function getCorePlayableBounds(tileMap: TileType[][]): TileBounds {
  const playableBounds = getPlayableTileBounds(tileMap);
  const bounds = insetBounds(playableBounds, CORE_PLAYABLE_EDGE_INSET_TILES);
  assertBoundsPlayable(tileMap, bounds, "Core playable bounds");
  return bounds;
}

export function getStartAreaBounds(tileMap: TileType[][]): TileBounds {
  const core = getCorePlayableBounds(tileMap);
  const width = Math.min(START_AREA_WIDTH_TILES, core.width);
  const height = Math.min(START_AREA_HEIGHT_TILES, core.height);
  const bounds: TileBounds = {
    row: core.row + Math.floor((core.height - height) / 2),
    col: core.col + Math.floor((core.width - width) / 2),
    width,
    height,
  };

  assertBoundsInside(bounds, core, "Start area bounds", "core playable bounds");
  assertBoundsPlayable(tileMap, bounds, "Start area bounds");
  return bounds;
}

export function getStartAreaAnchor(tileMap: TileType[][]): TileCoord {
  const startArea = getStartAreaBounds(tileMap);
  const anchor: TileCoord = {
    row: startArea.row + Math.floor(startArea.height / 2),
    col: startArea.col + Math.floor(startArea.width / 2),
  };

  if (!isInsideStartArea(anchor.row, anchor.col, tileMap)) {
    throw new Error(
      `Start area anchor resolved outside start area at row ${anchor.row} col ${anchor.col}`,
    );
  }
  return anchor;
}

export function isInsideCoreArea(
  row: number,
  col: number,
  tileMap: TileType[][],
): boolean {
  return isInsideBounds(row, col, getCorePlayableBounds(tileMap));
}

export function isInsideStartArea(
  row: number,
  col: number,
  tileMap: TileType[][],
): boolean {
  return isInsideBounds(row, col, getStartAreaBounds(tileMap));
}

export function isBoundsInsideBounds(
  inner: TileBounds,
  outer: TileBounds,
): boolean {
  return (
    inner.row >= outer.row &&
    inner.col >= outer.col &&
    inner.row + inner.height <= outer.row + outer.height &&
    inner.col + inner.width <= outer.col + outer.width
  );
}

export function assertBoundsInside(
  inner: TileBounds,
  outer: TileBounds,
  innerLabel: string,
  outerLabel: string,
): void {
  if (!isBoundsInsideBounds(inner, outer)) {
    throw new Error(`${innerLabel} must be inside ${outerLabel}.`);
  }
}

function getPlayableTileBounds(tileMap: TileType[][]): TileBounds {
  let minRow = Number.POSITIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;

  for (let row = 0; row < tileMap.length; row += 1) {
    const tiles = tileMap[row];
    for (let col = 0; col < tiles.length; col += 1) {
      if (!isPlayableTile(tiles[col])) continue;
      minRow = Math.min(minRow, row);
      minCol = Math.min(minCol, col);
      maxRow = Math.max(maxRow, row);
      maxCol = Math.max(maxCol, col);
    }
  }

  if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) {
    throw new Error("Tile map has no playable core tiles.");
  }

  return {
    row: minRow,
    col: minCol,
    width: maxCol - minCol + 1,
    height: maxRow - minRow + 1,
  };
}

function insetBounds(bounds: TileBounds, inset: number): TileBounds {
  const width = bounds.width - inset * 2;
  const height = bounds.height - inset * 2;
  if (width <= 0 || height <= 0) {
    throw new Error(
      `Playable core is too small for inset ${inset}: ${bounds.width}x${bounds.height}`,
    );
  }

  return {
    row: bounds.row + inset,
    col: bounds.col + inset,
    width,
    height,
  };
}

function assertBoundsPlayable(
  tileMap: TileType[][],
  bounds: TileBounds,
  label: string,
): void {
  for (let row = bounds.row; row < bounds.row + bounds.height; row += 1) {
    for (let col = bounds.col; col < bounds.col + bounds.width; col += 1) {
      const tile = tileMap[row]?.[col];
      if (!tile || !isPlayableTile(tile)) {
        throw new Error(
          `${label} overlaps non-playable terrain at row ${row} col ${col}`,
        );
      }
    }
  }
}

function isInsideBounds(row: number, col: number, bounds: TileBounds): boolean {
  return (
    row >= bounds.row &&
    row < bounds.row + bounds.height &&
    col >= bounds.col &&
    col < bounds.col + bounds.width
  );
}