import { GRID_H, GRID_W } from "../../constants/grid";
import { getStartAreaAnchor, getStartAreaBounds } from "../core-layout";
import { generateIslandTileMap } from "../island-generator";
import { BASE_START_IDS, createBaseStartLayout } from "../base-start-layout";

describe("createBaseStartLayout", () => {
  const tileMap = generateIslandTileMap(GRID_H, GRID_W);

  it("derives starter assets from the central start anchor", () => {
    const anchor = getStartAreaAnchor(tileMap);
    const layout = createBaseStartLayout(tileMap);

    expect(layout.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: BASE_START_IDS.mapShop,
          type: "map_shop",
          x: anchor.col - 1,
          y: anchor.row - 1,
          fixed: true,
        }),
        expect.objectContaining({
          id: BASE_START_IDS.serviceHub,
          type: "service_hub",
          x: anchor.col + 2,
          y: anchor.row - 1,
          fixed: true,
          droneIds: ["starter"],
        }),
        expect.objectContaining({
          id: BASE_START_IDS.warehouse,
          type: "warehouse",
          x: anchor.col - 1,
          y: anchor.row - 3,
        }),
      ]),
    );
    expect(layout.starterHubId).toBe(BASE_START_IDS.serviceHub);
  });

  it("keeps every starter asset footprint inside the start area", () => {
    const startArea = getStartAreaBounds(tileMap);
    const layout = createBaseStartLayout(tileMap);

    for (const asset of layout.assets) {
      expect(asset.y).toBeGreaterThanOrEqual(startArea.row);
      expect(asset.x).toBeGreaterThanOrEqual(startArea.col);
      expect(asset.y + asset.height).toBeLessThanOrEqual(
        startArea.row + startArea.height,
      );
      expect(asset.x + asset.width).toBeLessThanOrEqual(
        startArea.col + startArea.width,
      );
    }
  });

  it("rejects maps too small for the starter layout guard", () => {
    const tinyPlayableMap = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => "grass" as const),
    );

    expect(() => createBaseStartLayout(tinyPlayableMap)).toThrow(
      /Starter layout object placed outside start area/,
    );
  });
});
