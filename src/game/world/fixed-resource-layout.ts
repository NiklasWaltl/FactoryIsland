import type { AssetType, PlacedAsset } from "../store/types";
import type { TileType } from "./tile-types";
import { isPlayableTile } from "./island-generator";

const FIXED_RESOURCE_TYPES = [
  "stone_deposit",
  "iron_deposit",
  "copper_deposit",
] as const satisfies readonly AssetType[];

export type FixedResourceAssetType = (typeof FIXED_RESOURCE_TYPES)[number];
export type FixedResourceOutput = "stone" | "iron" | "copper";

export interface FixedResourceOrigin {
  readonly id: string;
  readonly type: FixedResourceAssetType;
  readonly row: number;
  readonly col: number;
}

export interface FixedResourcePlacement {
  readonly assets: Record<string, PlacedAsset>;
  readonly cellMap: Record<string, string>;
}

export const FIXED_RESOURCE_FOOTPRINT_SIZE = 2;
export const FIXED_RESOURCE_SAFETY_MARGIN_TILES = 4;

export const DEPOSIT_TYPES: ReadonlySet<AssetType> = new Set<AssetType>(
  FIXED_RESOURCE_TYPES,
);

export const DEPOSIT_RESOURCE: Record<string, FixedResourceOutput> = {
  stone_deposit: "stone",
  iron_deposit: "iron",
  copper_deposit: "copper",
};

export const FIXED_RESOURCE_LAYOUT: readonly FixedResourceOrigin[] = [
  { id: "stone-deposit", type: "stone_deposit", row: 14, col: 20 },
  { id: "iron-deposit", type: "iron_deposit", row: 20, col: 60 },
  { id: "copper-deposit", type: "copper_deposit", row: 34, col: 30 },
];

export function isFixedResourceAssetType(
  type: string,
): type is FixedResourceAssetType {
  return DEPOSIT_TYPES.has(type as AssetType);
}

export function getFixedResourceOriginByType(
  type: FixedResourceAssetType,
): FixedResourceOrigin {
  const origin = FIXED_RESOURCE_LAYOUT.find((entry) => entry.type === type);
  if (!origin) {
    throw new Error(`Fixed resource layout is missing '${type}'.`);
  }
  return origin;
}

export function isValidFixedResourceOrigin(
  tileMap: TileType[][],
  row: number,
  col: number,
): boolean {
  return (
    isFixedResourceFootprintPlayable(tileMap, row, col) &&
    hasFixedResourceSafetyMargin(tileMap, row, col)
  );
}

export function assertValidFixedResourceOrigin(
  tileMap: TileType[][],
  row: number,
  col: number,
): void {
  if (!isFixedResourceFootprintPlayable(tileMap, row, col)) {
    throw new Error(
      `Fixed resource origin invalid: 2x2 footprint overlaps non-playable terrain at row ${row} col ${col}`,
    );
  }

  if (!hasFixedResourceSafetyMargin(tileMap, row, col)) {
    throw new Error(
      `Fixed resource origin invalid: safety margin overlaps non-playable terrain at row ${row} col ${col}`,
    );
  }
}

export function getPreferredFixedResourceOrigins(
  tileMap: TileType[][],
): readonly FixedResourceOrigin[] {
  assertNoFixedResourceOverlap(FIXED_RESOURCE_LAYOUT);
  for (const origin of FIXED_RESOURCE_LAYOUT) {
    assertValidFixedResourceOrigin(tileMap, origin.row, origin.col);
  }
  return FIXED_RESOURCE_LAYOUT;
}

export function createFixedResourcePlacement(
  tileMap: TileType[][],
): FixedResourcePlacement {
  const assets: Record<string, PlacedAsset> = {};
  const cellMap: Record<string, string> = {};

  for (const origin of getPreferredFixedResourceOrigins(tileMap)) {
    const asset: PlacedAsset = {
      id: origin.id,
      type: origin.type,
      x: origin.col,
      y: origin.row,
      size: FIXED_RESOURCE_FOOTPRINT_SIZE,
      width: FIXED_RESOURCE_FOOTPRINT_SIZE,
      height: FIXED_RESOURCE_FOOTPRINT_SIZE,
      fixed: true,
    };
    assets[origin.id] = asset;

    forFixedResourceFootprint(origin.row, origin.col, (row, col) => {
      const key = cellKey(col, row);
      const occupiedBy = cellMap[key];
      if (occupiedBy) {
        throw new Error(
          `Fixed resource origin invalid: '${origin.id}' overlaps '${occupiedBy}' at row ${row} col ${col}`,
        );
      }
      cellMap[key] = origin.id;
    });
  }

  return { assets, cellMap };
}

function isFixedResourceFootprintPlayable(
  tileMap: TileType[][],
  row: number,
  col: number,
): boolean {
  let playable = true;
  forFixedResourceFootprint(row, col, (footprintRow, footprintCol) => {
    if (!isPlayableCell(tileMap, footprintRow, footprintCol)) {
      playable = false;
    }
  });
  return playable;
}

function hasFixedResourceSafetyMargin(
  tileMap: TileType[][],
  row: number,
  col: number,
): boolean {
  const margin = FIXED_RESOURCE_SAFETY_MARGIN_TILES;
  const lastFootprintRow = row + FIXED_RESOURCE_FOOTPRINT_SIZE - 1;
  const lastFootprintCol = col + FIXED_RESOURCE_FOOTPRINT_SIZE - 1;

  for (
    let checkRow = row - margin;
    checkRow <= lastFootprintRow + margin;
    checkRow += 1
  ) {
    for (
      let checkCol = col - margin;
      checkCol <= lastFootprintCol + margin;
      checkCol += 1
    ) {
      if (!isPlayableCell(tileMap, checkRow, checkCol)) return false;
    }
  }
  return true;
}

function assertNoFixedResourceOverlap(
  origins: readonly FixedResourceOrigin[],
): void {
  const occupied = new Map<string, string>();
  for (const origin of origins) {
    forFixedResourceFootprint(origin.row, origin.col, (row, col) => {
      const key = cellKey(col, row);
      const occupiedBy = occupied.get(key);
      if (occupiedBy) {
        throw new Error(
          `Fixed resource origin invalid: '${origin.id}' overlaps '${occupiedBy}' at row ${row} col ${col}`,
        );
      }
      occupied.set(key, origin.id);
    });
  }
}

function forFixedResourceFootprint(
  row: number,
  col: number,
  visit: (row: number, col: number) => void,
): void {
  for (let dy = 0; dy < FIXED_RESOURCE_FOOTPRINT_SIZE; dy += 1) {
    for (let dx = 0; dx < FIXED_RESOURCE_FOOTPRINT_SIZE; dx += 1) {
      visit(row + dy, col + dx);
    }
  }
}

function isPlayableCell(
  tileMap: TileType[][],
  row: number,
  col: number,
): boolean {
  const tile = tileMap[row]?.[col];
  return !!tile && isPlayableTile(tile);
}

function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}
