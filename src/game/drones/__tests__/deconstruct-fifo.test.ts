import { createInitialState } from "../../store/initial-state";
import type { GameState, PlacedAsset, StarterDroneState } from "../../store/types";
import { gatherDeconstructCandidates } from "../candidates/deconstruct-candidates";

function withAssets(state: GameState, assets: PlacedAsset[]): GameState {
  const nextAssets: GameState["assets"] = { ...state.assets };
  const nextConveyors: GameState["conveyors"] = { ...state.conveyors };

  for (const asset of assets) {
    nextAssets[asset.id] = asset;
    if (asset.type === "conveyor") {
      nextConveyors[asset.id] = { queue: [] };
    }
  }

  return {
    ...state,
    assets: nextAssets,
    conveyors: nextConveyors,
  };
}

function makeDeconstructAsset(
  id: string,
  x: number,
  y: number,
  seq: number,
): PlacedAsset {
  return {
    id,
    type: "conveyor",
    x,
    y,
    size: 1,
    direction: "east",
    status: "deconstructing",
    deconstructRequestSeq: seq,
  };
}

function gatherFor(
  state: Pick<GameState, "assets" | "drones">,
  drone: Pick<StarterDroneState, "droneId" | "tileX" | "tileY" | "deliveryTargetId">,
) {
  return gatherDeconstructCandidates(
    state,
    drone,
    { stickyBonus: 0 },
    {
      scoreDroneTask: () => 0,
    },
  );
}

describe("deconstruct FIFO candidate queue", () => {
  it("returns deconstruct candidates in FIFO order (seq 1 -> 2 -> 3)", () => {
    const base = createInitialState("release");
    const first = makeDeconstructAsset("fifo-1", 20, 20, 1);
    const second = makeDeconstructAsset("fifo-2", 21, 20, 2);
    const third = makeDeconstructAsset("fifo-3", 22, 20, 3);

    const state = withAssets(base, [first, second, third]);
    const candidates = gatherFor(state, state.starterDrone);

    expect(candidates.map((candidate) => candidate.deconstructRequestSeq)).toEqual([
      1,
      2,
      3,
    ]);
  });

  it("does not return a candidate when target is already reserved by another deconstruct drone", () => {
    const base = createInitialState("release");
    const target = makeDeconstructAsset("reserved-1", 24, 20, 1);
    const withTarget = withAssets(base, [target]);

    const assignedDrone: StarterDroneState = {
      ...withTarget.starterDrone,
      droneId: "assigned-drone",
      status: "moving_to_collect",
      currentTaskType: "deconstruct",
      targetNodeId: target.id,
      deliveryTargetId: target.id,
      ticksRemaining: 3,
    };
    const otherDrone: StarterDroneState = {
      ...withTarget.starterDrone,
      droneId: "other-drone",
      status: "idle",
      currentTaskType: null,
      targetNodeId: null,
      deliveryTargetId: null,
      ticksRemaining: 0,
    };

    const state: GameState = {
      ...withTarget,
      drones: {
        ...withTarget.drones,
        [assignedDrone.droneId]: assignedDrone,
        [otherDrone.droneId]: otherDrone,
      },
    };

    const candidates = gatherFor(state, otherDrone);
    expect(candidates).toHaveLength(0);
  });

  it("keeps FIFO order when middle request is cancelled (1 -> 3)", () => {
    const base = createInitialState("release");
    const first = makeDeconstructAsset("cancel-1", 30, 20, 1);
    const middle = makeDeconstructAsset("cancel-2", 31, 20, 2);
    const third = makeDeconstructAsset("cancel-3", 32, 20, 3);
    const withThree = withAssets(base, [first, middle, third]);

    const {
      status: _removedStatus,
      deconstructRequestSeq: _removedSeq,
      ...cancelledMiddle
    } = withThree.assets[middle.id];

    const cancelledState: GameState = {
      ...withThree,
      assets: {
        ...withThree.assets,
        [middle.id]: cancelledMiddle,
      },
    };

    const candidates = gatherFor(cancelledState, cancelledState.starterDrone);

    expect(candidates.map((candidate) => candidate.deconstructRequestSeq)).toEqual([
      1,
      3,
    ]);
    expect(candidates.some((candidate) => candidate.deconstructRequestSeq === 2)).toBe(
      false,
    );
  });

  it("returns an empty array when no asset is deconstructing", () => {
    const base = createInitialState("release");
    const candidates = gatherFor(base, base.starterDrone);

    expect(candidates).toEqual([]);
  });
});
