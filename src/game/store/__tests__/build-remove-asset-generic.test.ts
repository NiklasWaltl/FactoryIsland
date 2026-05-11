import { getDeconstructRefundForBuildingType } from "../../constants/deconstruct-refund";
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

function makeConveyor(
  id: string,
  x: number,
  y: number,
  direction: "east" | "west" | "north" | "south" = "east",
): PlacedAsset {
  return {
    id,
    type: "conveyor",
    x,
    y,
    size: 1,
    direction,
  };
}

function makeModuleLab(id: string, x: number, y: number): PlacedAsset {
  return {
    id,
    type: "module_lab",
    x,
    y,
    size: 2,
    width: 2,
    height: 2,
  };
}

function countAssetsOfType(
  state: GameState,
  type: PlacedAsset["type"],
): number {
  return Object.values(state.assets).filter((asset) => asset.type === type)
    .length;
}

function forcePlayableTiles(
  state: GameState,
  cells: Array<[number, number]>,
): GameState {
  const tileMap = state.tileMap.map((row) => [...row]);
  for (const [x, y] of cells) {
    if (tileMap[y]?.[x]) tileMap[y][x] = "grass";
  }
  return { ...state, tileMap };
}

function withBuildPlacementContext(
  state: GameState,
  buildingType: Exclude<GameState["selectedBuildingType"], null>,
): GameState {
  return {
    ...state,
    buildMode: true,
    selectedBuildingType: buildingType,
    unlockedBuildings: [...new Set([...state.unlockedBuildings, buildingType])],
    inventory: {
      ...state.inventory,
      wood: Math.max(state.inventory.wood ?? 0, 999),
      stone: Math.max(state.inventory.stone ?? 0, 999),
      iron: Math.max(state.inventory.iron ?? 0, 999),
      copper: Math.max(state.inventory.copper ?? 0, 999),
    },
  };
}

function placeSelectedBuilding(
  state: GameState,
  x: number,
  y: number,
  direction: "east" | "west" | "north" | "south" = "east",
): GameState {
  return gameReducer(state, {
    type: "BUILD_PLACE_BUILDING",
    x,
    y,
    direction,
  });
}

describe("BUILD_REMOVE_ASSET generic removal", () => {
  it("frees a 1x1 cell for new placement and refunds salvage to inventory", () => {
    const conveyor = makeConveyor("conv-1", 10, 8);
    const state = forcePlayableTiles(
      makeStateWithSingleAsset(conveyor, [[10, 8]], {
        conveyors: {
          "conv-1": { queue: [] },
        },
      }),
      [[10, 8]],
    );

    const ironBefore = state.inventory.iron ?? 0;
    const refundIron =
      getDeconstructRefundForBuildingType("conveyor").iron ?? 0;

    const removed = gameReducer(state, {
      type: "BUILD_REMOVE_ASSET",
      assetId: "conv-1",
    });

    expect(removed.inventory.iron).toBe(ironBefore + refundIron);

    const placementReady = withBuildPlacementContext(removed, "conveyor");
    const conveyorCountBefore = countAssetsOfType(placementReady, "conveyor");
    const afterPlace = placeSelectedBuilding(placementReady, 10, 8);
    expect(countAssetsOfType(afterPlace, "conveyor")).toBe(
      conveyorCountBefore + 1,
    );
  });

  it("frees every 2x2 footprint cell and refunds salvage when removing module_lab", () => {
    const moduleLab = makeModuleLab("lab-1", 12, 10);
    const occupied: Array<[number, number]> = [
      [12, 10],
      [13, 10],
      [12, 11],
      [13, 11],
    ];

    const state = forcePlayableTiles(
      makeStateWithSingleAsset(moduleLab, occupied, {
        placedBuildings: ["module_lab"],
        purchasedBuildings: ["module_lab"],
      }),
      occupied,
    );

    const inventoryBefore = {
      wood: state.inventory.wood ?? 0,
      stone: state.inventory.stone ?? 0,
      iron: state.inventory.iron ?? 0,
    };
    const refund = getDeconstructRefundForBuildingType("module_lab");

    const removed = gameReducer(state, {
      type: "BUILD_REMOVE_ASSET",
      assetId: "lab-1",
    });

    expect(removed.inventory.wood).toBe(
      inventoryBefore.wood + (refund.wood ?? 0),
    );
    expect(removed.inventory.stone).toBe(
      inventoryBefore.stone + (refund.stone ?? 0),
    );
    expect(removed.inventory.iron).toBe(
      inventoryBefore.iron + (refund.iron ?? 0),
    );

    let placementState = withBuildPlacementContext(removed, "conveyor");
    for (const [x, y] of occupied) {
      const before = countAssetsOfType(placementState, "conveyor");
      placementState = placeSelectedBuilding(placementState, x, y);
      expect(countAssetsOfType(placementState, "conveyor")).toBe(before + 1);
    }
  });
});

describe("REQUEST_DECONSTRUCT_ASSET", () => {
  it("assigns the older request first when the drone picks a deconstruct target", () => {
    const olderConveyor = makeConveyor("conv-dec-order-old", 5, 5);
    const newerConveyor = makeConveyor("conv-dec-order-new", 6, 5);

    const state = makeStateWithSingleAsset(olderConveyor, [[5, 5]], {
      assets: {
        [olderConveyor.id]: olderConveyor,
        [newerConveyor.id]: newerConveyor,
      },
      cellMap: {
        [cellKey(5, 5)]: olderConveyor.id,
        [cellKey(6, 5)]: newerConveyor.id,
      },
      conveyors: {
        [olderConveyor.id]: { queue: [] },
        [newerConveyor.id]: { queue: [] },
      },
      collectionNodes: {},
      constructionSites: {},
      drones: {
        starter: {
          ...createInitialState("release").drones.starter,
          status: "idle",
          currentTaskType: null,
          targetNodeId: null,
          deliveryTargetId: null,
          cargo: null,
          ticksRemaining: 0,
        },
      },
    });

    const requestedOlder = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: olderConveyor.id,
    });
    const requestedBoth = gameReducer(requestedOlder, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: newerConveyor.id,
    });
    const afterDroneTick = gameReducer(requestedBoth, { type: "DRONE_TICK" });

    expect(afterDroneTick.drones.starter.currentTaskType).toBe("deconstruct");
    expect(afterDroneTick.drones.starter.deliveryTargetId).toBe(
      olderConveyor.id,
    );
  });

  it("keeps a 1x1 building in-place after request and excludes it from logistics tick", () => {
    const source = makeConveyor("conv-dec-1", 7, 6, "east");
    const target = makeConveyor("conv-dec-1-next", 8, 6, "east");

    const state = forcePlayableTiles(
      makeStateWithSingleAsset(source, [[7, 6]], {
        assets: {
          [source.id]: source,
          [target.id]: target,
        },
        cellMap: {
          [cellKey(7, 6)]: source.id,
          [cellKey(8, 6)]: target.id,
        },
        conveyors: {
          [source.id]: { queue: ["iron"] },
          [target.id]: { queue: [] },
        },
        connectedAssetIds: [source.id, target.id],
        poweredMachineIds: [source.id, target.id],
      }),
      [[7, 6]],
    );

    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: source.id,
    });
    const afterLogisticsTick = gameReducer(requested, {
      type: "LOGISTICS_TICK",
    });

    expect(afterLogisticsTick.conveyors[source.id].queue).toEqual(["iron"]);
    expect(afterLogisticsTick.conveyors[target.id].queue).toEqual([]);

    const placementReady = withBuildPlacementContext(
      afterLogisticsTick,
      "conveyor",
    );
    const before = countAssetsOfType(placementReady, "conveyor");
    const placeAttempt = placeSelectedBuilding(placementReady, 7, 6);
    expect(countAssetsOfType(placeAttempt, "conveyor")).toBe(before);
  });

  it("keeps a 2x2 building footprint blocked while deconstruction is pending", () => {
    const moduleLab = makeModuleLab("lab-dec-1", 20, 14);
    const occupied: Array<[number, number]> = [
      [20, 14],
      [21, 14],
      [20, 15],
      [21, 15],
    ];

    const state = forcePlayableTiles(
      makeStateWithSingleAsset(moduleLab, occupied),
      occupied,
    );

    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: moduleLab.id,
    });

    let placementState = withBuildPlacementContext(requested, "conveyor");
    for (const [x, y] of occupied) {
      const before = countAssetsOfType(placementState, "conveyor");
      placementState = placeSelectedBuilding(placementState, x, y);
      expect(countAssetsOfType(placementState, "conveyor")).toBe(before);
    }
  });

  it("is a no-op on duplicate request for the same asset", () => {
    const source = makeConveyor("conv-dec-dupe", 11, 9, "east");
    const target = makeConveyor("conv-dec-dupe-next", 12, 9, "east");

    const state = makeStateWithSingleAsset(source, [[11, 9]], {
      assets: {
        [source.id]: source,
        [target.id]: target,
      },
      cellMap: {
        [cellKey(11, 9)]: source.id,
        [cellKey(12, 9)]: target.id,
      },
      conveyors: {
        [source.id]: { queue: ["iron"] },
        [target.id]: { queue: [] },
      },
      connectedAssetIds: [source.id, target.id],
      poweredMachineIds: [source.id, target.id],
    });

    const requestedOnce = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: source.id,
    });
    const requestedTwice = gameReducer(requestedOnce, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: source.id,
    });
    const cancelled = gameReducer(requestedTwice, {
      type: "CANCEL_DECONSTRUCT_ASSET",
      assetId: source.id,
    });
    const afterDroneTick = gameReducer(cancelled, { type: "DRONE_TICK" });

    expect(afterDroneTick.drones.starter.currentTaskType).not.toBe(
      "deconstruct",
    );

    const placementReady = withBuildPlacementContext(
      forcePlayableTiles(afterDroneTick, [[11, 9]]),
      "conveyor",
    );
    const before = countAssetsOfType(placementReady, "conveyor");
    const placeAttempt = placeSelectedBuilding(placementReady, 11, 9);
    expect(countAssetsOfType(placeAttempt, "conveyor")).toBe(before);
  });
});

describe("CANCEL_DECONSTRUCT_ASSET", () => {
  it("returns a requested asset to normal gameplay behavior", () => {
    const source = makeConveyor("conv-dec-cancel", 14, 8, "east");
    const target = makeConveyor("conv-dec-cancel-next", 15, 8, "east");

    const state = forcePlayableTiles(
      makeStateWithSingleAsset(source, [[14, 8]], {
        assets: {
          [source.id]: source,
          [target.id]: target,
        },
        cellMap: {
          [cellKey(14, 8)]: source.id,
          [cellKey(15, 8)]: target.id,
        },
        conveyors: {
          [source.id]: { queue: ["iron"] },
          [target.id]: { queue: [] },
        },
        connectedAssetIds: [source.id, target.id],
        poweredMachineIds: [source.id, target.id],
      }),
      [[14, 8]],
    );

    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: source.id,
    });
    const cancelled = gameReducer(requested, {
      type: "CANCEL_DECONSTRUCT_ASSET",
      assetId: source.id,
    });
    const afterCancelledDroneTick = gameReducer(cancelled, {
      type: "DRONE_TICK",
    });
    expect(afterCancelledDroneTick.drones.starter.currentTaskType).not.toBe(
      "deconstruct",
    );

    const placementReady = withBuildPlacementContext(
      forcePlayableTiles(cancelled, [[14, 8]]),
      "conveyor",
    );
    const before = countAssetsOfType(placementReady, "conveyor");
    const placeAttempt = placeSelectedBuilding(placementReady, 14, 8);
    expect(countAssetsOfType(placeAttempt, "conveyor")).toBe(before);

    const requestedAgain = gameReducer(cancelled, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: source.id,
    });
    const afterReRequestDroneTick = gameReducer(requestedAgain, {
      type: "DRONE_TICK",
    });
    expect(afterReRequestDroneTick.drones.starter.currentTaskType).toBe(
      "deconstruct",
    );
    expect(afterReRequestDroneTick.drones.starter.deliveryTargetId).toBe(
      source.id,
    );
  });

  it("is a no-op when cancelling a non-marked asset", () => {
    const source = makeConveyor("conv-dec-cancel-noop", 16, 8, "east");
    const target = makeConveyor("conv-dec-cancel-noop-next", 17, 8, "east");

    const state = makeStateWithSingleAsset(source, [[16, 8]], {
      assets: {
        [source.id]: source,
        [target.id]: target,
      },
      cellMap: {
        [cellKey(16, 8)]: source.id,
        [cellKey(17, 8)]: target.id,
      },
      conveyors: {
        [source.id]: { queue: ["iron"] },
        [target.id]: { queue: [] },
      },
      connectedAssetIds: [source.id, target.id],
      poweredMachineIds: [source.id, target.id],
    });

    const cancelled = gameReducer(state, {
      type: "CANCEL_DECONSTRUCT_ASSET",
      assetId: source.id,
    });
    const afterTick = gameReducer(cancelled, { type: "LOGISTICS_TICK" });

    expect(afterTick.conveyors[source.id].queue).toEqual([]);
    expect(afterTick.conveyors[target.id].queue).toEqual(["iron"]);
  });
});
