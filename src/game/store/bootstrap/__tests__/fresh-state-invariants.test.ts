import {
  FIXED_RESOURCE_FOOTPRINT_SIZE,
  FIXED_RESOURCE_LAYOUT,
} from "../../../world/fixed-resource-layout";
import {
  BASE_START_IDS,
  hasRequiredBaseStartLayout,
} from "../../../world/base-start-layout";
import {
  DOCK_WAREHOUSE_ID,
  applyDockWarehouseLayout,
} from "../apply-dock-warehouse-layout";
import {
  getDockBeachStartRow,
  getDockWarehousePos,
} from "../../constants/map/map-layout";
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

  it("places the dock warehouse at the bottom beach transition without base-start conflicts", () => {
    const dock = state.assets[DOCK_WAREHOUSE_ID];
    const beachStartRow = getDockBeachStartRow(state.tileMap);
    const dockPos = getDockWarehousePos(state.tileMap);

    expect(dock).toMatchObject(dockPos);
    expect(dockPos.x).toBe(Math.floor(state.tileMap[0].length / 2));
    expect(dockPos.y).toBe(beachStartRow - 1);
    expect(state.tileMap[dockPos.y]?.[dockPos.x]).toBe("grass");
    expect(state.tileMap[beachStartRow]?.[dockPos.x]).toBe("sand");

    const dockFootprint = footprintOf(dock);
    for (const asset of collectBaseStartAssets(state)) {
      expect(boundsOverlap(dockFootprint, footprintOf(asset))).toBe(false);
    }
  });

  it("realigns an existing dock warehouse to the canonical beach transition", () => {
    const dock = state.assets[DOCK_WAREHOUSE_ID];
    const legacyState = moveDockWarehouseForTest(state, dock.x, dock.y - 3);
    const realigned = applyDockWarehouseLayout(legacyState);
    const dockPos = getDockWarehousePos(realigned.tileMap);

    expect(realigned.assets[DOCK_WAREHOUSE_ID]).toMatchObject(dockPos);
    expect(
      realigned.cellMap[cellKeyForTest(dock.x, dock.y - 3)],
    ).toBeUndefined();
    expect(realigned.cellMap[cellKeyForTest(dockPos.x, dockPos.y)]).toBe(
      DOCK_WAREHOUSE_ID,
    );
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

function expectBoundsAllGrass(tileMap: TileType[][], bounds: TileBounds): void {
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

function boundsOverlap(left: TileBounds, right: TileBounds): boolean {
  return (
    left.col < right.col + right.width &&
    left.col + left.width > right.col &&
    left.row < right.row + right.height &&
    left.row + left.height > right.row
  );
}

function moveDockWarehouseForTest(
  state: GameState,
  x: number,
  y: number,
): GameState {
  const dock = state.assets[DOCK_WAREHOUSE_ID];
  const cellMap = { ...state.cellMap };
  for (const [key, assetId] of Object.entries(cellMap)) {
    if (assetId === DOCK_WAREHOUSE_ID) delete cellMap[key];
  }

  for (let dx = 0; dx < (dock.width ?? dock.size); dx += 1) {
    for (let dy = 0; dy < (dock.height ?? dock.size); dy += 1) {
      cellMap[cellKeyForTest(x + dx, y + dy)] = DOCK_WAREHOUSE_ID;
    }
  }

  return {
    ...state,
    assets: {
      ...state.assets,
      [DOCK_WAREHOUSE_ID]: { ...dock, x, y },
    },
    cellMap,
  };
}

function cellKeyForTest(x: number, y: number): string {
  return `${x},${y}`;
}
