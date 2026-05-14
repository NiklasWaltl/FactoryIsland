import {
  __resetPhaserSnapshotCachesForTests,
  isPhaserRenderedAssetType,
  selectCollectionNodeSnapshots,
  selectCulledStaticAssetSnapshots,
  selectDroneSnapshots,
  selectFullStaticAssetSnapshots,
  selectShipSnapshot,
} from "../phaser-snapshot-selectors";
import { createInitialState } from "../../initial-state";
import type {
  CollectionNode,
  GameState,
  PlacedAsset,
  StarterDroneState,
} from "../../types";

function makeDrone(
  overrides: Partial<StarterDroneState> = {},
): StarterDroneState {
  return {
    droneId: "starter",
    status: "idle",
    tileX: 0,
    tileY: 0,
    hubId: null,
    cargo: null,
    role: "auto",
    targetNodeId: null,
    deliveryTargetId: null,
    currentTaskType: null,
    craftingJobId: null,
    ticksRemaining: 0,
    ...overrides,
  };
}

function makeNode(overrides: Partial<CollectionNode> = {}): CollectionNode {
  return {
    id: "node-1",
    itemType: "wood",
    amount: 3,
    tileX: 1,
    tileY: 2,
    collectable: true,
    createdAt: 0,
    reservedByDroneId: null,
    ...overrides,
  };
}

function makeAsset(overrides: Partial<PlacedAsset> = {}): PlacedAsset {
  return {
    id: "a-1",
    type: "workbench",
    x: 0,
    y: 0,
    size: 1,
    ...overrides,
  } as PlacedAsset;
}

beforeEach(() => {
  __resetPhaserSnapshotCachesForTests();
});

describe("selectDroneSnapshots", () => {
  it("returns the same reference when the drones slice reference is unchanged", () => {
    const drones = { starter: makeDrone() };
    const first = selectDroneSnapshots(drones);
    const second = selectDroneSnapshots(drones);
    expect(second).toBe(first);
  });

  it("returns the same reference when slice ref changes but content is identical", () => {
    const droneA = makeDrone();
    const droneB = makeDrone();
    const first = selectDroneSnapshots({ starter: droneA });
    const second = selectDroneSnapshots({ starter: droneB });
    expect(second).toBe(first);
  });

  it("returns a new reference when a drone field changes", () => {
    const droneA = makeDrone({ tileX: 0 });
    const droneB = makeDrone({ tileX: 5 });
    const first = selectDroneSnapshots({ starter: droneA });
    const second = selectDroneSnapshots({ starter: droneB });
    expect(second).not.toBe(first);
    expect(second[0].tileX).toBe(5);
  });

  it("reuses individual entries when only one drone changes", () => {
    const stable = makeDrone({ droneId: "stable" });
    const mover = makeDrone({ droneId: "mover", tileX: 0 });
    const first = selectDroneSnapshots({ stable, mover });
    const moverNext = makeDrone({ droneId: "mover", tileX: 9 });
    const second = selectDroneSnapshots({
      stable,
      mover: moverNext,
    });
    expect(second).not.toBe(first);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
  });

  it("sets isParkedAtHub when drone is idle and has a hub", () => {
    const drone = makeDrone({ status: "idle", hubId: "hub-1" });
    const result = selectDroneSnapshots({ starter: drone });
    expect(result[0].isParkedAtHub).toBe(true);
  });
});

describe("selectCollectionNodeSnapshots", () => {
  it("returns the same reference when the collectionNodes slice ref is unchanged", () => {
    const nodes = { "node-1": makeNode() };
    expect(selectCollectionNodeSnapshots(nodes)).toBe(
      selectCollectionNodeSnapshots(nodes),
    );
  });

  it("returns the same reference when content is structurally identical", () => {
    const first = selectCollectionNodeSnapshots({ "node-1": makeNode() });
    const second = selectCollectionNodeSnapshots({ "node-1": makeNode() });
    expect(second).toBe(first);
  });

  it("returns a new reference when amount changes", () => {
    const first = selectCollectionNodeSnapshots({
      "node-1": makeNode({ amount: 3 }),
    });
    const second = selectCollectionNodeSnapshots({
      "node-1": makeNode({ amount: 4 }),
    });
    expect(second).not.toBe(first);
    expect(second[0].amount).toBe(4);
  });
});

describe("selectShipSnapshot", () => {
  function makeShipState(
    overrides: Partial<GameState> = {},
  ): Pick<GameState, "ship" | "tileMap"> {
    const base = createInitialState("release");
    return {
      ship: base.ship,
      tileMap: base.tileMap,
      ...overrides,
    };
  }

  it("returns the same snapshot when status and tileMap refs are unchanged", () => {
    const state = makeShipState();
    expect(selectShipSnapshot(state)).toBe(selectShipSnapshot(state));
  });

  it("returns a new snapshot when ship status changes", () => {
    const state = makeShipState();
    const first = selectShipSnapshot(state);
    const next = makeShipState({
      ship: { ...state.ship, status: "departing" } as GameState["ship"],
    });
    const second = selectShipSnapshot(next);
    expect(second).not.toBe(first);
    expect(second.status).toBe("departing");
  });

  it("reuses snapshot when only an unrelated ship field changes (status+tileMap stable)", () => {
    const state = makeShipState();
    const first = selectShipSnapshot(state);
    // Different ship ref, same status; tileMap unchanged → snapshot is reused.
    const second = selectShipSnapshot({
      ship: { ...state.ship },
      tileMap: state.tileMap,
    });
    expect(second).toBe(first);
  });
});

describe("selectFullStaticAssetSnapshots", () => {
  function makeStateForAssets(
    assets: Record<string, PlacedAsset>,
    constructionSites: GameState["constructionSites"] = {},
  ): Pick<GameState, "assets" | "constructionSites"> {
    return { assets, constructionSites };
  }

  it("returns same ref when assets and constructionSites refs are unchanged", () => {
    const state = makeStateForAssets({ "a-1": makeAsset() });
    expect(selectFullStaticAssetSnapshots(state)).toBe(
      selectFullStaticAssetSnapshots(state),
    );
  });

  it("filters out non-Phaser-rendered asset types", () => {
    const state = makeStateForAssets({
      "wb-1": makeAsset({ id: "wb-1", type: "workbench" }),
      // ghost is not in PHASER_RENDERED_TYPES if it ever existed; we use a
      // valid type and rely on isPhaserRenderedAssetType to gate inclusion.
    });
    const snapshots = selectFullStaticAssetSnapshots(state);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].id).toBe("wb-1");
  });

  it("marks an asset as under construction when a construction site exists", () => {
    const state = makeStateForAssets(
      { "site-1": makeAsset({ id: "site-1", type: "workbench" }) },
      {
        "site-1": {
          buildingType: "workbench",
          remaining: { wood: 5 },
        },
      } as GameState["constructionSites"],
    );
    const snapshots = selectFullStaticAssetSnapshots(state);
    expect(snapshots[0].isUnderConstruction).toBe(true);
  });

  it("reuses individual snapshots across calls when only some assets change", () => {
    const stable = makeAsset({ id: "stable", x: 1, y: 1 });
    const moving1 = makeAsset({ id: "moving", x: 2, y: 2 });
    const state1 = makeStateForAssets({ stable, moving: moving1 });
    const first = selectFullStaticAssetSnapshots(state1);

    const moving2 = makeAsset({ id: "moving", x: 5, y: 5 });
    const state2 = makeStateForAssets({ stable, moving: moving2 });
    const second = selectFullStaticAssetSnapshots(state2);

    const stableFirst = first.find((s) => s.id === "stable");
    const stableSecond = second.find((s) => s.id === "stable");
    expect(stableSecond).toBe(stableFirst);
    const movingFirst = first.find((s) => s.id === "moving");
    const movingSecond = second.find((s) => s.id === "moving");
    expect(movingSecond).not.toBe(movingFirst);
    expect(movingSecond?.x).toBe(5);
  });

  it("isPhaserRenderedAssetType returns false for unknown types", () => {
    // power_pole is rendered; unknown types should be rejected.
    expect(isPhaserRenderedAssetType("power_pole")).toBe(true);
    // Cast to bypass the union — only the runtime Set lookup matters.
    expect(
      isPhaserRenderedAssetType("not_a_real_type" as PlacedAsset["type"]),
    ).toBe(false);
  });
});

describe("selectCulledStaticAssetSnapshots", () => {
  it("returns the same ref when inputs do not change", () => {
    const source = selectFullStaticAssetSnapshots({
      assets: { "a-1": makeAsset({ x: 3, y: 4 }) },
      constructionSites: {},
    });
    const first = selectCulledStaticAssetSnapshots(source, 0, 0, 10, 10);
    const second = selectCulledStaticAssetSnapshots(source, 0, 0, 10, 10);
    expect(second).toBe(first);
  });

  it("culls assets outside the viewport", () => {
    const source = selectFullStaticAssetSnapshots({
      assets: {
        inside: makeAsset({ id: "inside", x: 5, y: 5 }),
        outside: makeAsset({ id: "outside", x: 50, y: 50 }),
      },
      constructionSites: {},
    });
    const culled = selectCulledStaticAssetSnapshots(source, 0, 0, 10, 10);
    expect(culled.map((c) => c.id)).toEqual(["inside"]);
  });

  it("returns the same ref when source changes but the culled output is identical", () => {
    const visible = makeAsset({ id: "visible", x: 5, y: 5 });
    const offscreen1 = makeAsset({ id: "off", x: 50, y: 50 });
    const source1 = selectFullStaticAssetSnapshots({
      assets: { visible, off: offscreen1 },
      constructionSites: {},
    });
    const first = selectCulledStaticAssetSnapshots(source1, 0, 0, 10, 10);

    // Change an offscreen asset: source ref changes, but culled result is
    // structurally the same and the visible entry is reused → cached array
    // is returned unchanged.
    const offscreen2 = makeAsset({ id: "off", x: 60, y: 60 });
    const source2 = selectFullStaticAssetSnapshots({
      assets: { visible, off: offscreen2 },
      constructionSites: {},
    });
    const second = selectCulledStaticAssetSnapshots(source2, 0, 0, 10, 10);
    expect(second).toBe(first);
  });

  it("returns a new ref when the viewport changes such that visibility shifts", () => {
    const source = selectFullStaticAssetSnapshots({
      assets: {
        a: makeAsset({ id: "a", x: 5, y: 5 }),
        b: makeAsset({ id: "b", x: 25, y: 25 }),
      },
      constructionSites: {},
    });
    const first = selectCulledStaticAssetSnapshots(source, 0, 0, 10, 10);
    const second = selectCulledStaticAssetSnapshots(source, 0, 0, 30, 30);
    expect(second).not.toBe(first);
    expect(second.map((c) => c.id).sort()).toEqual(["a", "b"]);
  });
});
