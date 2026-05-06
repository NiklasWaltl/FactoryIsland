import type { TileType } from "../tile-types";
import {
  forEachTileInBounds,
  isTileFootprintPlayable,
} from "../tile-footprint-utils";

describe("tile footprint utils", () => {
  const tileMap: TileType[][] = [
    ["grass", "grass", "grass"],
    ["grass", "water", "grass"],
    ["grass", "grass", "sand"],
  ];

  it("visits every tile in row-major order", () => {
    const visited: string[] = [];

    forEachTileInBounds({ row: 1, col: 0, width: 2, height: 2 }, (row, col) => {
      visited.push(`${row},${col}`);
    });

    expect(visited).toEqual(["1,0", "1,1", "2,0", "2,1"]);
  });

  it("accepts footprints made only of playable grass", () => {
    expect(
      isTileFootprintPlayable(tileMap, { row: 0, col: 0, width: 2, height: 1 }),
    ).toBe(true);
  });

  it("rejects footprints containing water or sand", () => {
    expect(
      isTileFootprintPlayable(tileMap, { row: 0, col: 0, width: 2, height: 2 }),
    ).toBe(false);
    expect(
      isTileFootprintPlayable(tileMap, { row: 2, col: 2, width: 1, height: 1 }),
    ).toBe(false);
  });

  it("rejects footprints outside the tile map", () => {
    expect(
      isTileFootprintPlayable(tileMap, { row: 2, col: 0, width: 1, height: 2 }),
    ).toBe(false);
    expect(
      isTileFootprintPlayable(tileMap, {
        row: -1,
        col: 0,
        width: 1,
        height: 1,
      }),
    ).toBe(false);
  });
});
