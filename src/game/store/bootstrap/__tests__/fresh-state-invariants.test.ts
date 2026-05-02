import {
  FIXED_RESOURCE_FOOTPRINT_SIZE,
  FIXED_RESOURCE_LAYOUT,
} from "../../../world/fixed-resource-layout";
import {
  BASE_START_IDS,
  hasRequiredBaseStartLayout,
} from "../../../world/base-start-layout";
import { DOCK_WAREHOUSE_ID } from "../apply-dock-warehouse-layout";
import { getInitialCameraFocusTile } from "../../../world/camera-focus";
import {
  getCorePlayableBounds,
  getStartAreaBounds,
  isBoundsInsideBounds,
  isInsideCoreArea,
  type TileBounds,
} from "../../../world/core-layout";
import type { TileType } from "../../../world/tile-types";
import { createInitialState } from "../../initial-state";
import type { GameState, PlacedAsset } from "../../types";

describe("fresh state world/bootstrap invariants", () => {
  const state = createInitialState("release");

  it("produces a non-empty rectangular tileMap", () => {
    expectRectangularTileMap(state.tileMap);
  });

  it("places the core area fully on grass", () => {
    expectBoundsAllGrass(state.tileMap, getCorePlayableBounds(state.tileMap));
  });

  it("places the start area inside the core area and fully on grass", () => {
    const core = getCorePlayableBounds(state.tileMap);
    const startArea = getStartAreaBounds(state.tileMap);

    expect(isBoundsInsideBounds(startArea, core)).toBe(true);
    expectBoundsAllGrass(state.tileMap, startArea);
  });

  it("places every base-start asset fully inside the start area", () => {
    const startArea = getStartAreaBounds(state.tileMap);
    const baseStartAssets = collectBaseStartAssets(state);

    expect(baseStartAssets).toHaveLength(Object.values(BASE_START_IDS).length);
    for (const asset of baseStartAssets) {
      expect(isBoundsInsideBounds(footprintOf(asset), startArea)).toBe(true);
    }
  });

  it("places every fixed deposit footprint on grass tiles", () => {
    for (const origin of FIXED_RESOURCE_LAYOUT) {
      const bounds: TileBounds = {
        row: origin.row,
        col: origin.col,
        width: FIXED_RESOURCE_FOOTPRINT_SIZE,
        height: FIXED_RESOURCE_FOOTPRINT_SIZE,
      };
      expectBoundsAllGrass(state.tileMap, bounds);
    }
  });

  it("materializes the starter buildup exactly once on a fresh state", () => {
    expect(hasRequiredBaseStartLayout(state)).toBe(true);

    for (const id of Object.values(BASE_START_IDS)) {
      const matches = Object.values(state.assets).filter(
        (asset) => asset.id === id,
      );
      expect(matches).toHaveLength(1);
    }

    expect(Object.keys(state.serviceHubs)).toEqual([BASE_START_IDS.serviceHub]);
    expect(Object.keys(state.warehouseInventories)).toEqual(
      expect.arrayContaining([BASE_START_IDS.warehouse, DOCK_WAREHOUSE_ID]),
    );
    expect(Object.keys(state.warehouseInventories)).toHaveLength(2);
    expect(state.warehousesPurchased).toBe(2);
    expect(state.warehousesPlaced).toBe(2);
  });

  it("anchors the initial camera focus inside the playable core", () => {
    const focus = getInitialCameraFocusTile(state.tileMap);
    expect(isInsideCoreArea(focus.row, focus.col, state.tileMap)).toBe(true);
  });
});

function expectRectangularTileMap(tileMap: TileType[][]): void {
  expect(tileMap.length).toBeGreaterThan(0);
  const width = tileMap[0].length;
  expect(width).toBeGreaterThan(0);
  for (const row of tileMap) {
    expect(row.length).toBe(width);
  }
}

function expectBoundsAllGrass(
  tileMap: TileType[][],
  bounds: TileBounds,
): void {
  for (let row = bounds.row; row < bounds.row + bounds.height; row += 1) {
    for (let col = bounds.col; col < bounds.col + bounds.width; col += 1) {
      expect(tileMap[row]?.[col]).toBe("grass");
    }
  }
}

function collectBaseStartAssets(state: GameState): readonly PlacedAsset[] {
  return Object.values(BASE_START_IDS)
    .map((id) => state.assets[id])
    .filter((asset): asset is PlacedAsset => !!asset);
}

function footprintOf(asset: PlacedAsset): TileBounds {
  return {
    row: asset.y,
    col: asset.x,
    width: asset.width ?? asset.size,
    height: asset.height ?? asset.size,
  };
}
