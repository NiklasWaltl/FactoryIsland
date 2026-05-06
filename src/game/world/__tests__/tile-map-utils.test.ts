import { generateIslandTileMap } from "../island-generator";
import { sanitizeTileMap } from "../tile-map-utils";
import type { TileType } from "../tile-types";

describe("sanitizeTileMap", () => {
  const fallbackRows = 3;
  const fallbackCols = 4;
  const fallback = generateIslandTileMap(fallbackRows, fallbackCols);

  it("returns a valid rectangular tile map", () => {
    const raw: TileType[][] = [
      ["water", "water", "water", "water"],
      ["water", "sand", "sand", "water"],
      ["water", "water", "water", "water"],
    ];

    expect(sanitizeTileMap(raw, fallbackRows, fallbackCols)).toEqual(raw);
  });

  it("falls back when raw is not an array of rows", () => {
    expect(sanitizeTileMap(null, fallbackRows, fallbackCols)).toEqual(fallback);
    expect(sanitizeTileMap({ rows: [] }, fallbackRows, fallbackCols)).toEqual(
      fallback,
    );
  });

  it("falls back when row dimensions are ragged or unexpected", () => {
    expect(
      sanitizeTileMap(
        [
          ["grass", "grass", "grass", "grass"],
          ["grass", "grass"],
          ["grass", "grass", "grass", "grass"],
        ],
        fallbackRows,
        fallbackCols,
      ),
    ).toEqual(fallback);

    expect(sanitizeTileMap([["grass"]], fallbackRows, fallbackCols)).toEqual(
      fallback,
    );
  });

  it("falls back when a tile type is unknown", () => {
    expect(
      sanitizeTileMap(
        [
          ["grass", "grass", "grass", "grass"],
          ["grass", "lava", "grass", "grass"],
          ["grass", "grass", "grass", "grass"],
        ],
        fallbackRows,
        fallbackCols,
      ),
    ).toEqual(fallback);
  });
});
