import {
  ISLAND_SAND_BORDER_TILES,
  ISLAND_WATER_BORDER_TILES,
  generateIslandTileMap,
  isPlayableTile,
} from "../island-generator";

describe("generateIslandTileMap", () => {
  test("creates a deterministic rectangular island with water, sand, and grass", () => {
    const rows = 24;
    const cols = 26;
    const centerCol = Math.floor(cols / 2);
    const firstSandRow = ISLAND_WATER_BORDER_TILES;
    const lastSandRow =
      ISLAND_WATER_BORDER_TILES + ISLAND_SAND_BORDER_TILES - 1;
    const firstGrassRow = ISLAND_WATER_BORDER_TILES + ISLAND_SAND_BORDER_TILES;
    const tileMap = generateIslandTileMap(rows, cols);

    expect(tileMap).toHaveLength(rows);
    expect(tileMap.every((row) => row.length === cols)).toBe(true);
    expect(tileMap[0][0]).toBe("water");
    expect(tileMap[ISLAND_WATER_BORDER_TILES - 1][centerCol]).toBe("water");
    expect(tileMap[firstSandRow][centerCol]).toBe("sand");
    expect(tileMap[lastSandRow][centerCol]).toBe("sand");
    expect(tileMap[firstGrassRow][centerCol]).toBe("grass");
  });

  test("keeps an expected rectangular playable grass area", () => {
    const rows = 50;
    const cols = 80;
    const tileMap = generateIslandTileMap(rows, cols);
    const playableInset = ISLAND_WATER_BORDER_TILES + ISLAND_SAND_BORDER_TILES;

    expect(tileMap[playableInset][playableInset]).toBe("grass");
    expect(tileMap[rows - playableInset - 1][cols - playableInset - 1]).toBe(
      "grass",
    );
    expect(tileMap[playableInset - 1][playableInset]).toBe("sand");
    expect(tileMap[ISLAND_WATER_BORDER_TILES - 1][playableInset]).toBe("water");
  });

  test("only grass is playable", () => {
    expect(isPlayableTile("grass")).toBe(true);
    expect(isPlayableTile("sand")).toBe(false);
    expect(isPlayableTile("water")).toBe(false);
  });
});
