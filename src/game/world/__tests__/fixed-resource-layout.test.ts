import { GRID_H, GRID_W } from "../../constants/grid";
import {
  assertValidFixedResourceOrigin,
  createFixedResourcePlacement,
  FIXED_RESOURCE_FOOTPRINT_SIZE,
  FIXED_RESOURCE_LAYOUT,
  FIXED_RESOURCE_SAFETY_MARGIN_TILES,
  getPreferredFixedResourceOrigins,
  isValidFixedResourceOrigin,
} from "../fixed-resource-layout";
import { generateIslandTileMap, isPlayableTile } from "../island-generator";

describe("fixed resource layout", () => {
  const tileMap = generateIslandTileMap(GRID_H, GRID_W);

  it("uses deterministic central origins", () => {
    expect(
      getPreferredFixedResourceOrigins(tileMap).map((origin) => ({
        id: origin.id,
        type: origin.type,
        row: origin.row,
        col: origin.col,
      })),
    ).toEqual([
      { id: "stone-deposit", type: "stone_deposit", row: 14, col: 20 },
      { id: "iron-deposit", type: "iron_deposit", row: 20, col: 60 },
      { id: "copper-deposit", type: "copper_deposit", row: 34, col: 30 },
    ]);
  });

  it("keeps every 2x2 footprint and safety margin on grass", () => {
    for (const origin of FIXED_RESOURCE_LAYOUT) {
      expect(isValidFixedResourceOrigin(tileMap, origin.row, origin.col)).toBe(
        true,
      );

      for (let dy = 0; dy < FIXED_RESOURCE_FOOTPRINT_SIZE; dy += 1) {
        for (let dx = 0; dx < FIXED_RESOURCE_FOOTPRINT_SIZE; dx += 1) {
          expect(
            isPlayableTile(tileMap[origin.row + dy][origin.col + dx]),
          ).toBe(true);
        }
      }

      const lastRow = origin.row + FIXED_RESOURCE_FOOTPRINT_SIZE - 1;
      const lastCol = origin.col + FIXED_RESOURCE_FOOTPRINT_SIZE - 1;
      for (
        let row = origin.row - FIXED_RESOURCE_SAFETY_MARGIN_TILES;
        row <= lastRow + FIXED_RESOURCE_SAFETY_MARGIN_TILES;
        row += 1
      ) {
        for (
          let col = origin.col - FIXED_RESOURCE_SAFETY_MARGIN_TILES;
          col <= lastCol + FIXED_RESOURCE_SAFETY_MARGIN_TILES;
          col += 1
        ) {
          expect(isPlayableTile(tileMap[row][col])).toBe(true);
        }
      }
    }
  });

  it("creates non-overlapping 2x2 placement cells", () => {
    const placement = createFixedResourcePlacement(tileMap);
    const occupiedCells = Object.keys(placement.cellMap);

    expect(Object.keys(placement.assets)).toHaveLength(
      FIXED_RESOURCE_LAYOUT.length,
    );
    expect(occupiedCells).toHaveLength(
      FIXED_RESOURCE_LAYOUT.length *
        FIXED_RESOURCE_FOOTPRINT_SIZE *
        FIXED_RESOURCE_FOOTPRINT_SIZE,
    );
    expect(new Set(occupiedCells).size).toBe(occupiedCells.length);

    for (const origin of FIXED_RESOURCE_LAYOUT) {
      expect(placement.assets[origin.id]).toMatchObject({
        type: origin.type,
        x: origin.col,
        y: origin.row,
        size: FIXED_RESOURCE_FOOTPRINT_SIZE,
        fixed: true,
      });
    }
  });

  it("rejects origins whose 2x2 footprint touches non-playable terrain", () => {
    expect(isValidFixedResourceOrigin(tileMap, 4, 20)).toBe(false);
    expect(() => assertValidFixedResourceOrigin(tileMap, 4, 20)).toThrow(
      /2x2 footprint overlaps non-playable terrain/,
    );
  });

  it("rejects origins without the configured safety margin", () => {
    expect(isValidFixedResourceOrigin(tileMap, 10, 20)).toBe(false);
    expect(() => assertValidFixedResourceOrigin(tileMap, 10, 20)).toThrow(
      /safety margin overlaps non-playable terrain/,
    );
  });
});
