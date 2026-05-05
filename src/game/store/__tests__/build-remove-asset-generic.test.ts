import { cellKey, createInitialState, gameReducer } from "../reducer";
import type { GameState, PlacedAsset } from "../types";

function makeStateWithSingleAsset(
  asset: PlacedAsset,
  occupiedCells: Array<[number, number]>,
  overrides: Partial<GameState> = {},
): GameState {
  const base = createInitialState("release");
  return {
    ...base,
    assets: { [asset.id]: asset },
    cellMap: Object.fromEntries(
      occupiedCells.map(([x, y]) => [cellKey(x, y), asset.id]),
    ),
    saplingGrowAt: {},
    buildMode: true,
    ...overrides,
  };
}

describe("BUILD_REMOVE_ASSET generic removal", () => {
  it("removes a 1x1 building from assets and cellMap", () => {
    const conveyor: PlacedAsset = {
      id: "conv-1",
      type: "conveyor",
      x: 10,
      y: 8,
      size: 1,
      direction: "east",
    };

    const state = makeStateWithSingleAsset(conveyor, [[10, 8]], {
      conveyors: {
        "conv-1": { queue: [] },
      },
    });

    const after = gameReducer(state, {
      type: "BUILD_REMOVE_ASSET",
      assetId: "conv-1",
    });

    expect(after.assets["conv-1"]).toBeUndefined();
    expect(after.cellMap[cellKey(10, 8)]).toBeUndefined();
    expect(after.conveyors["conv-1"]).toBeUndefined();
  });

  it("removes a 2x2 building and clears all occupied cells", () => {
    const moduleLab: PlacedAsset = {
      id: "lab-1",
      type: "module_lab",
      x: 12,
      y: 10,
      size: 2,
      width: 2,
      height: 2,
    };

    const state = makeStateWithSingleAsset(
      moduleLab,
      [
        [12, 10],
        [13, 10],
        [12, 11],
        [13, 11],
      ],
      {
        placedBuildings: ["module_lab"],
        purchasedBuildings: ["module_lab"],
      },
    );

    const after = gameReducer(state, {
      type: "BUILD_REMOVE_ASSET",
      assetId: "lab-1",
    });

    expect(after.assets["lab-1"]).toBeUndefined();
    expect(after.cellMap[cellKey(12, 10)]).toBeUndefined();
    expect(after.cellMap[cellKey(13, 10)]).toBeUndefined();
    expect(after.cellMap[cellKey(12, 11)]).toBeUndefined();
    expect(after.cellMap[cellKey(13, 11)]).toBeUndefined();
    expect(after.placedBuildings).not.toContain("module_lab");
    expect(after.purchasedBuildings).not.toContain("module_lab");
  });
});
