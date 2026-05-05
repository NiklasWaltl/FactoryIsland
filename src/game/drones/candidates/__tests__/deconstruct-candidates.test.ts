import { createInitialState } from "../../../store/initial-state";
import { gameReducer, selectDroneTask } from "../../../store/reducer";
import type { GameState, PlacedAsset } from "../../../store/types";
import { gatherDeconstructCandidates } from "../deconstruct-candidates";

function withAsset(state: GameState, asset: PlacedAsset): GameState {
  const nextState: GameState = {
    ...state,
    assets: {
      ...state.assets,
      [asset.id]: asset,
    },
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

describe("gatherDeconstructCandidates", () => {
  it("prefers the oldest deconstruct request (FIFO) even when it is farther away", () => {
    const base = createInitialState("release");
    const olderConveyor: PlacedAsset = {
      id: "dec-order-old",
      type: "conveyor",
      x: 32,
      y: 32,
      size: 1,
      direction: "east",
    };
    const newerConveyor: PlacedAsset = {
      id: "dec-order-new",
      type: "conveyor",
      x: base.starterDrone.tileX,
      y: base.starterDrone.tileY + 1,
      size: 1,
      direction: "east",
    };

    let state = withAsset({ ...base, buildMode: true }, olderConveyor);
    state = withAsset(state, newerConveyor);

    const requestedOlder = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: olderConveyor.id,
    });
    const requestedBoth = gameReducer(requestedOlder, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: newerConveyor.id,
    });

    const selectedTask = selectDroneTask(requestedBoth, requestedBoth.starterDrone);

    expect(selectedTask?.taskType).toBe("deconstruct");
    expect(selectedTask?.nodeId).toBe(olderConveyor.id);
    expect(requestedBoth.assets[olderConveyor.id]?.deconstructRequestSeq).toBe(1);
    expect(requestedBoth.assets[newerConveyor.id]?.deconstructRequestSeq).toBe(2);
  });

  it("excludes targets that are already assigned to another deconstruct drone", () => {
    const base = createInitialState("release");
    const conveyor: PlacedAsset = {
      id: "dec-candidate-assigned",
      type: "conveyor",
      x: 24,
      y: 18,
      size: 1,
      direction: "east",
      status: "deconstructing",
      deconstructRequestSeq: 1,
    };

    const withConveyor = withAsset({ ...base, buildMode: true }, conveyor);
    const assignedDrone = {
      ...withConveyor.starterDrone,
      droneId: "assigned-drone",
      status: "moving_to_collect" as const,
      currentTaskType: "deconstruct" as const,
      targetNodeId: conveyor.id,
      deliveryTargetId: conveyor.id,
      ticksRemaining: 3,
    };
    const state: GameState = {
      ...withConveyor,
      drones: {
        ...withConveyor.drones,
        [assignedDrone.droneId]: assignedDrone,
      },
    };

    const candidates = gatherDeconstructCandidates(
      state,
      state.starterDrone,
      { stickyBonus: 0 },
      {
        scoreDroneTask: () => 100,
      },
    );

    expect(candidates.some((candidate) => candidate.nodeId === conveyor.id)).toBe(
      false,
    );
  });

  it("excludes a target after deconstruct request is cancelled", () => {
    const base = createInitialState("release");
    const conveyor: PlacedAsset = {
      id: "dec-candidate-1",
      type: "conveyor",
      x: 24,
      y: 18,
      size: 1,
      direction: "east",
    };

    const state = withAsset({ ...base, buildMode: true }, conveyor);
    const requested = gameReducer(state, {
      type: "REQUEST_DECONSTRUCT_ASSET",
      assetId: conveyor.id,
    });

    const beforeCancel = gatherDeconstructCandidates(
      requested,
      requested.starterDrone,
      { stickyBonus: 0 },
      {
        scoreDroneTask: () => 100,
      },
    );
    expect(
      beforeCancel.some((candidate) => candidate.nodeId === conveyor.id),
    ).toBe(true);

    const cancelled = gameReducer(requested, {
      type: "CANCEL_DECONSTRUCT_ASSET",
      assetId: conveyor.id,
    });

    const afterCancel = gatherDeconstructCandidates(
      cancelled,
      cancelled.starterDrone,
      { stickyBonus: 0 },
      {
        scoreDroneTask: () => 100,
      },
    );
    expect(
      afterCancel.some((candidate) => candidate.nodeId === conveyor.id),
    ).toBe(false);
  });
});
