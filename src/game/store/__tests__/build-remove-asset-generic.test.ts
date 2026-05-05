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

describe("REQUEST_DECONSTRUCT_ASSET", () => {
  it("assigns a monotonic request sequence across multiple deconstruct requests", () => {
    const olderConveyor: PlacedAsset = {
      id: "conv-dec-order-old",
      type: "conveyor",
      x: 5,
      y: 5,
      size: 1,
      direction: "east",
    };
    const newerConveyor: PlacedAsset = {
      id: "conv-dec-order-new",
      type: "conveyor",
      x: 6,
      y: 5,
      size: 1,
      direction: "east",
    };

    let state = makeStateWithSingleAsset(olderConveyor, [[5, 5]], {
      conveyors: {
        "conv-dec-order-old": { queue: [] },
      },
    });
    state = {
      ...state,
      assets: {
        ...state.assets,
        [newerConveyor.id]: newerConveyor,
      },
      cellMap: {
        ...state.cellMap,
        [cellKey(6, 5)]: newerConveyor.id,
      },
      conveyors: {
        ...state.conveyors,
        [newerConveyor.id]: { queue: [] },
      },
    };

    const requestedOlder = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: olderConveyor.id,
    });
    const requestedBoth = gameReducer(requestedOlder, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: newerConveyor.id,
    });

    expect(requestedBoth.assets[olderConveyor.id]?.deconstructRequestSeq).toBe(1);
    expect(requestedBoth.assets[newerConveyor.id]?.deconstructRequestSeq).toBe(2);
  });

  it("marks a 1x1 building as deconstructing without immediate removal", () => {
    const conveyor: PlacedAsset = {
      id: "conv-dec-1",
      type: "conveyor",
      x: 7,
      y: 6,
      size: 1,
      direction: "east",
    };

    const state = makeStateWithSingleAsset(conveyor, [[7, 6]], {
      conveyors: {
        "conv-dec-1": { queue: [] },
      },
    });

    const after = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: "conv-dec-1",
    });

    expect(after.assets["conv-dec-1"]).toBeDefined();
    expect(after.assets["conv-dec-1"]?.status).toBe("deconstructing");
    expect(after.cellMap[cellKey(7, 6)]).toBe("conv-dec-1");
  });

  it("marks a 2x2 building as deconstructing and keeps all occupied cells", () => {
    const moduleLab: PlacedAsset = {
      id: "lab-dec-1",
      type: "module_lab",
      x: 20,
      y: 14,
      size: 2,
      width: 2,
      height: 2,
    };

    const state = makeStateWithSingleAsset(moduleLab, [
      [20, 14],
      [21, 14],
      [20, 15],
      [21, 15],
    ]);

    const after = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: "lab-dec-1",
    });

    expect(after.assets["lab-dec-1"]).toBeDefined();
    expect(after.assets["lab-dec-1"]?.status).toBe("deconstructing");
    expect(after.cellMap[cellKey(20, 14)]).toBe("lab-dec-1");
    expect(after.cellMap[cellKey(21, 14)]).toBe("lab-dec-1");
    expect(after.cellMap[cellKey(20, 15)]).toBe("lab-dec-1");
    expect(after.cellMap[cellKey(21, 15)]).toBe("lab-dec-1");
  });

  it("is a no-op on duplicate request for the same asset", () => {
    const conveyor: PlacedAsset = {
      id: "conv-dec-dupe",
      type: "conveyor",
      x: 11,
      y: 9,
      size: 1,
      direction: "east",
      status: "deconstructing",
    };

    const state = makeStateWithSingleAsset(conveyor, [[11, 9]], {
      conveyors: {
        "conv-dec-dupe": { queue: [] },
      },
    });

    const after = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: "conv-dec-dupe",
    });

    expect(after).toEqual(state);
  });
});

describe("CANCEL_DECONSTRUCT_ASSET", () => {
  it("returns a requested asset to normal status", () => {
    const conveyor: PlacedAsset = {
      id: "conv-dec-cancel",
      type: "conveyor",
      x: 14,
      y: 8,
      size: 1,
      direction: "east",
    };

    const state = makeStateWithSingleAsset(conveyor, [[14, 8]], {
      conveyors: {
        "conv-dec-cancel": { queue: [] },
      },
    });

    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: "conv-dec-cancel",
    });
    expect(requested.assets["conv-dec-cancel"]?.status).toBe("deconstructing");
    expect(requested.assets["conv-dec-cancel"]?.deconstructRequestSeq).toBe(1);

    const cancelled = gameReducer(requested, {
      type: "CANCEL_DECONSTRUCT_ASSET",
      assetId: "conv-dec-cancel",
    });

    expect(cancelled.assets["conv-dec-cancel"]).toBeDefined();
    expect(cancelled.assets["conv-dec-cancel"]?.status).toBeUndefined();
    expect(
      cancelled.assets["conv-dec-cancel"]?.deconstructRequestSeq,
    ).toBeUndefined();
    expect(cancelled.cellMap[cellKey(14, 8)]).toBe("conv-dec-cancel");
  });

  it("is a no-op when cancelling a non-marked asset", () => {
    const conveyor: PlacedAsset = {
      id: "conv-dec-cancel-noop",
      type: "conveyor",
      x: 16,
      y: 8,
      size: 1,
      direction: "east",
    };

    const state = makeStateWithSingleAsset(conveyor, [[16, 8]], {
      conveyors: {
        "conv-dec-cancel-noop": { queue: [] },
      },
    });

    const after = gameReducer(state, {
      type: "CANCEL_DECONSTRUCT_ASSET",
      assetId: "conv-dec-cancel-noop",
    });

    expect(after).toEqual(state);
  });
});
