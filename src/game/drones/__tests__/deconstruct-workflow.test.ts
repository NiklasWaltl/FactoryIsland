import { cellKey, gameReducer } from "../../store/reducer";
import type {
  GameState,
  PlacedAsset,
  StarterDroneState,
} from "../../store/types";
import * as assetMutation from "../../store/asset-mutation";
import {
  createInitialState,
  placeServiceHub,
  TEST_SERVICE_HUB_POS,
} from "./test-utils";

function withPlacedAsset(
  state: GameState,
  asset: PlacedAsset,
  occupiedCells: Array<[number, number]>,
): GameState {
  const nextAssets = { ...state.assets, [asset.id]: asset };
  const nextCellMap = { ...state.cellMap };
  for (const [x, y] of occupiedCells) {
    nextCellMap[cellKey(x, y)] = asset.id;
  }

  const nextState: GameState = {
    ...state,
    assets: nextAssets,
    cellMap: nextCellMap,
  };

  if (asset.type === "conveyor") {
    return {
      ...nextState,
      conveyors: {
        ...nextState.conveyors,
        [asset.id]: { queue: [] },
      },
    };
  }

  return nextState;
}

function runDroneTicksUntil(
  state: GameState,
  predicate: (current: GameState) => boolean,
  maxTicks = 140,
): GameState {
  let current = state;
  for (let i = 0; i < maxTicks; i++) {
    if (predicate(current)) return current;
    current = gameReducer(current, { type: "DRONE_TICK" });
  }
  return current;
}

function runDroneTicks(state: GameState, tickCount: number): GameState {
  let current = state;
  for (let i = 0; i < tickCount; i++) {
    current = gameReducer(current, { type: "DRONE_TICK" });
  }
  return current;
}

describe("Drone deconstruct workflow", () => {
  it("assigns different deconstruct targets to two idle drones in the same tick", () => {
    const base = createInitialState("release");
    const { state: withHub } = placeServiceHub(
      base,
      TEST_SERVICE_HUB_POS.x,
      TEST_SERVICE_HUB_POS.y,
    );

    const firstConveyor: PlacedAsset = {
      id: "dec-dual-1",
      type: "conveyor",
      x: 52,
      y: 34,
      size: 1,
      direction: "east",
    };
    const secondConveyor: PlacedAsset = {
      id: "dec-dual-2",
      type: "conveyor",
      x: 53,
      y: 34,
      size: 1,
      direction: "east",
    };

    let state = withPlacedAsset(withHub, firstConveyor, [[52, 34]]);
    state = withPlacedAsset(state, secondConveyor, [[53, 34]]);
    state = {
      ...state,
      buildMode: true,
      collectionNodes: {},
      constructionSites: {},
    };

    const starter = {
      ...state.drones.starter,
      status: "idle",
      currentTaskType: null,
      targetNodeId: null,
      deliveryTargetId: null,
      craftingJobId: null,
      cargo: null,
      ticksRemaining: 0,
    } as StarterDroneState;
    const secondDrone: StarterDroneState = {
      ...state.drones.starter,
      droneId: "deconstruct-second-drone",
      tileX: starter.tileX + 1,
      tileY: starter.tileY,
    };
    state = {
      ...state,
      drones: {
        [starter.droneId]: starter,
        [secondDrone.droneId]: secondDrone,
      },
    };

    const requestedFirst = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: firstConveyor.id,
    });
    const requestedBoth = gameReducer(requestedFirst, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: secondConveyor.id,
    });

    const afterTick = gameReducer(requestedBoth, { type: "DRONE_TICK" });
    const assignedTargets = Object.values(afterTick.drones)
      .filter((drone) => drone.currentTaskType === "deconstruct")
      .map((drone) => drone.deliveryTargetId)
      .filter((targetId): targetId is string => typeof targetId === "string");

    expect(assignedTargets).toHaveLength(2);
    expect(new Set(assignedTargets).size).toBe(2);
    expect(assignedTargets).toEqual(
      expect.arrayContaining([firstConveyor.id, secondConveyor.id]),
    );
  });

  it("does not process a target after deconstruct request is cancelled", () => {
    const base = createInitialState("release");
    const { state: withHub } = placeServiceHub(
      base,
      TEST_SERVICE_HUB_POS.x,
      TEST_SERVICE_HUB_POS.y,
    );

    const conveyor: PlacedAsset = {
      id: "dec-cancel-drone",
      type: "conveyor",
      x: 54,
      y: 36,
      size: 1,
      direction: "east",
    };

    let state = withPlacedAsset(withHub, conveyor, [[54, 36]]);
    state = { ...state, buildMode: true };

    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: conveyor.id,
    });
    const cancelled = gameReducer(requested, {
      type: "CANCEL_DECONSTRUCT_ASSET",
      assetId: conveyor.id,
    });
    const afterTicks = runDroneTicks(cancelled, 20);

    expect(afterTicks.assets[conveyor.id]).toBeDefined();
    expect(afterTicks.assets[conveyor.id]?.status).toBeUndefined();
    expect(
      Object.values(afterTicks.drones).some(
        (drone) => drone.currentTaskType === "deconstruct",
      ),
    ).toBe(false);
  });

  it("removes a 2x2 target only after drone finalization and clears all occupied cells", () => {
    const removeSpy = jest.spyOn(assetMutation, "removeAsset");

    const base = createInitialState("release");
    const { state: withHub } = placeServiceHub(
      base,
      TEST_SERVICE_HUB_POS.x,
      TEST_SERVICE_HUB_POS.y,
    );

    const moduleLab: PlacedAsset = {
      id: "dec-lab-1",
      type: "module_lab",
      x: 56,
      y: 34,
      size: 2,
      width: 2,
      height: 2,
    };

    let state = withPlacedAsset(withHub, moduleLab, [
      [56, 34],
      [57, 34],
      [56, 35],
      [57, 35],
    ]);
    state = { ...state, buildMode: true };

    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: moduleLab.id,
    });

    expect(requested.assets[moduleLab.id]).toBeDefined();
    expect(requested.assets[moduleLab.id]?.status).toBe("deconstructing");

    const finalized = runDroneTicksUntil(
      requested,
      (current) => !current.assets[moduleLab.id],
    );

    expect(removeSpy).toHaveBeenCalled();
    expect(finalized.assets[moduleLab.id]).toBeUndefined();
    expect(finalized.cellMap[cellKey(56, 34)]).toBeUndefined();
    expect(finalized.cellMap[cellKey(57, 34)]).toBeUndefined();
    expect(finalized.cellMap[cellKey(56, 35)]).toBeUndefined();
    expect(finalized.cellMap[cellKey(57, 35)]).toBeUndefined();

    removeSpy.mockRestore();
  });

  it("deposits deconstruct refund into assigned hub inventory", () => {
    const base = createInitialState("release");
    const { state: withHub, hubId } = placeServiceHub(
      base,
      TEST_SERVICE_HUB_POS.x,
      TEST_SERVICE_HUB_POS.y,
    );

    const conveyor: PlacedAsset = {
      id: "dec-conv-hub",
      type: "conveyor",
      x: 58,
      y: 36,
      size: 1,
      direction: "east",
    };

    let state = withPlacedAsset(withHub, conveyor, [[58, 36]]);
    state = { ...state, buildMode: true };

    const globalIronBefore = state.inventory.iron;
    const hubIronBefore = state.serviceHubs[hubId].inventory.iron;

    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: conveyor.id,
    });
    const finalized = runDroneTicksUntil(
      requested,
      (current) =>
        current.serviceHubs[hubId].inventory.iron === hubIronBefore + 1,
    );

    expect(finalized.serviceHubs[hubId].inventory.iron).toBe(hubIronBefore + 1);
    expect(finalized.inventory.iron).toBe(globalIronBefore);
    expect(finalized.assets[conveyor.id]).toBeUndefined();
  });

  it("falls back to global inventory when drone has no hub assignment", () => {
    const base = createInitialState("release");
    const { state: withHub, hubId } = placeServiceHub(
      base,
      TEST_SERVICE_HUB_POS.x,
      TEST_SERVICE_HUB_POS.y,
    );

    const conveyor: PlacedAsset = {
      id: "dec-conv-global",
      type: "conveyor",
      x: 60,
      y: 36,
      size: 1,
      direction: "east",
    };

    let state = withPlacedAsset(withHub, conveyor, [[60, 36]]);
    const detachedStarter = { ...state.drones.starter, hubId: null };
    state = {
      ...state,
      buildMode: true,
      drones: {
        ...state.drones,
        [detachedStarter.droneId]: detachedStarter,
      },
    };

    const globalIronBefore = state.inventory.iron;
    const hubIronBefore = state.serviceHubs[hubId].inventory.iron;

    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: conveyor.id,
    });
    const finalized = runDroneTicksUntil(
      requested,
      (current) => current.inventory.iron === globalIronBefore + 1,
    );

    expect(finalized.inventory.iron).toBe(globalIronBefore + 1);
    expect(finalized.serviceHubs[hubId].inventory.iron).toBe(hubIronBefore);
    expect(finalized.assets[conveyor.id]).toBeUndefined();
  });
});
