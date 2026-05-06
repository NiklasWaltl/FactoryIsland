import {
  addNode,
  createInitialState,
  DRONE_COLLECT_TICKS,
  droneTick,
  placeServiceHub,
  TEST_SERVICE_HUB_POS,
  withDrone,
} from "./test-utils";
import type { GameState } from "./test-utils";

describe("DRONE_TICK – idle", () => {
  let base: GameState;

  beforeEach(() => {
    base = createInitialState("release");
  });

  it("stays idle when no collection nodes exist", () => {
    const next = droneTick(base);
    expect(next).toBe(base); // no change, same reference
  });

  it("transitions to moving_to_collect when a node exists", () => {
    const state = addNode(base, "wood", 5, 5, 3);
    const next = droneTick(state);
    expect(next.drones.starter.status).toBe("moving_to_collect");
    expect(next.drones.starter.targetNodeId).toBeTruthy();
    expect(next.drones.starter.ticksRemaining).toBeGreaterThanOrEqual(1);
  });

  it("picks the nearest node by Chebyshev distance", () => {
    // Drone starts at grid center {x:39,y:24}; place two nodes: one closer, one farther.
    const close = { x: 41, y: 24 };
    const far = { x: 49, y: 24 };
    let state = addNode(base, "stone", close.x, close.y, 1);
    const nodeIds1 = Object.keys(state.collectionNodes);
    state = addNode(state, "iron", far.x, far.y, 1);
    const next = droneTick(state);
    expect(next.drones.starter.targetNodeId).toBe(nodeIds1[0]);
  });
});

describe("DRONE_TICK – moving_to_collect", () => {
  let base: GameState;
  let nodeId: string;

  beforeEach(() => {
    base = createInitialState("release");
    base = addNode(base, "wood", 3, 3, 2);
    nodeId = Object.keys(base.collectionNodes)[0];
    // Manually set drone into moving_to_collect with 2 ticks left
    base = withDrone(base, {
      status: "moving_to_collect",
      targetNodeId: nodeId,
      ticksRemaining: 2,
    });
  });

  it("decrements ticksRemaining while > 1", () => {
    const next = droneTick(base);
    expect(next.drones.starter.status).toBe("moving_to_collect");
    expect(next.drones.starter.ticksRemaining).toBe(1);
  });

  it("transitions to collecting when ticksRemaining reaches 0", () => {
    // Tick it down to 1 first
    let state = droneTick(base);
    state = droneTick(state);
    expect(state.drones.starter.status).toBe("collecting");
    expect(state.drones.starter.ticksRemaining).toBe(DRONE_COLLECT_TICKS);
  });

  it("falls back to idle if target node was removed", () => {
    // Remove the node
    const { [nodeId]: _removed, ...rest } = base.collectionNodes;
    const state = withDrone(
      { ...base, collectionNodes: rest },
      {
        status: "moving_to_collect",
        targetNodeId: nodeId,
        ticksRemaining: 1,
      },
    );
    const next = droneTick(state);
    expect(next.drones.starter.status).toBe("idle");
    expect(next.drones.starter.targetNodeId).toBeNull();
  });
});

describe("Claim layer – node reservation on task start", () => {
  let base: GameState;

  beforeEach(() => {
    base = createInitialState("release");
  });

  it("claims the target node when drone transitions to moving_to_collect", () => {
    let state = addNode(base, "wood", 5, 5, 3);
    const nodeId = Object.keys(state.collectionNodes)[0];
    expect(state.collectionNodes[nodeId].reservedByDroneId).toBeNull();
    state = droneTick(state); // idle → moving_to_collect
    expect(state.drones.starter.status).toBe("moving_to_collect");
    expect(state.collectionNodes[nodeId].reservedByDroneId).toBe(
      state.drones.starter.droneId,
    );
  });

  it("skips a node reserved by another drone", () => {
    // Simulate a foreign drone owning the only node
    let state = addNode(base, "wood", 5, 5, 3);
    const nodeId = Object.keys(state.collectionNodes)[0];
    state = {
      ...state,
      collectionNodes: {
        ...state.collectionNodes,
        [nodeId]: {
          ...state.collectionNodes[nodeId],
          reservedByDroneId: "other-drone",
        },
      },
    };
    // Add a second unclaimed node
    state = addNode(state, "stone", 7, 7, 2);
    state = droneTick(state); // idle → moving_to_collect
    expect(state.drones.starter.status).toBe("moving_to_collect");
    // Must have targeted the unclaimed node, not the wood one
    expect(state.drones.starter.targetNodeId).not.toBe(nodeId);
  });

  it("stays idle if all nodes are claimed by other drones", () => {
    let state = addNode(base, "wood", 5, 5, 3);
    const nodeId = Object.keys(state.collectionNodes)[0];
    state = {
      ...state,
      collectionNodes: {
        ...state.collectionNodes,
        [nodeId]: {
          ...state.collectionNodes[nodeId],
          reservedByDroneId: "other-drone",
        },
      },
    };
    const next = droneTick(state);
    expect(next).toBe(state); // no-op
  });
});

describe("Claim layer – reservation released on collection", () => {
  let base: GameState;

  beforeEach(() => {
    base = createInitialState("release");
  });

  it("releases claim after successful pickup (node partially remains)", () => {
    let state = addNode(base, "wood", 4, 4, 10);
    const nodeId = Object.keys(state.collectionNodes)[0];
    // Drone in collecting phase, node claimed
    state = {
      ...state,
      collectionNodes: {
        ...state.collectionNodes,
        [nodeId]: {
          ...state.collectionNodes[nodeId],
          reservedByDroneId: "starter",
        },
      },
    };
    state = withDrone(state, {
      status: "collecting",
      targetNodeId: nodeId,
      tileX: 4,
      tileY: 4,
      ticksRemaining: 1,
      currentTaskType: "hub_restock",
      deliveryTargetId: null,
    });
    state = droneTick(state); // collecting → moving_to_dropoff
    expect(state.drones.starter.status).toBe("moving_to_dropoff");
    // Node still exists (10 - DRONE_CAPACITY remain)
    const remaining = state.collectionNodes[nodeId];
    expect(remaining).toBeDefined();
    // Reservation must be cleared
    expect(remaining.reservedByDroneId).toBeNull();
  });

  it("releases claim when node disappears during moving_to_collect", () => {
    let state = addNode(base, "wood", 4, 4, 3);
    const nodeId = Object.keys(state.collectionNodes)[0];
    state = withDrone(state, {
      status: "moving_to_collect",
      targetNodeId: nodeId,
      ticksRemaining: 1,
      currentTaskType: "hub_restock",
      deliveryTargetId: null,
    });
    // Remove node while drone is en route
    const { [nodeId]: _removed, ...restNodes } = state.collectionNodes;
    state = { ...state, collectionNodes: restNodes };
    const next = droneTick(state);
    expect(next.drones.starter.status).toBe("idle");
    // Node is gone; no stale reservation
    expect(
      Object.values(next.collectionNodes).some(
        (node) => node.reservedByDroneId === "starter",
      ),
    ).toBe(false);
  });

  it("drone that claimed a node can still select it again after re-evaluation", () => {
    let state = addNode(base, "wood", 5, 5, 3);
    const nodeId = Object.keys(state.collectionNodes)[0];
    // Mark node as claimed by this drone (same droneId)
    state = {
      ...state,
      collectionNodes: {
        ...state.collectionNodes,
        [nodeId]: {
          ...state.collectionNodes[nodeId],
          reservedByDroneId: "starter",
        },
      },
    };
    // Drone is idle — selectDroneTask should still see its own claimed node
    const next = droneTick(state);
    expect(next.drones.starter.status).toBe("moving_to_collect");
    expect(next.drones.starter.targetNodeId).toBe(nodeId);
  });
});

describe("DRONE_TICK – self-heal missing hub entry", () => {
  let base: GameState;
  let hubId: string;

  beforeEach(() => {
    const init = createInitialState("release");
    const placed = placeServiceHub(
      init,
      TEST_SERVICE_HUB_POS.x,
      TEST_SERVICE_HUB_POS.y,
    );
    base = placed.state;
    hubId = placed.hubId;
  });

  it("recreates missing serviceHubs entry on idle tick", () => {
    // Corrupt state: remove the serviceHubs entry while keeping hubId
    const { [hubId]: _removed, ...remainingHubs } = base.serviceHubs;
    let state: GameState = { ...base, serviceHubs: remainingHubs };
    // Add a node so the drone has something to do
    state = addNode(state, "wood", 7, 5, 3);
    // The idle tick should self-heal the hub entry and pick up the task
    state = droneTick(state);
    expect(state.serviceHubs[hubId]).toBeDefined();
    expect(state.drones.starter.status).toBe("moving_to_collect");
  });

  it("self-heals during deposit and deposits into hub (not global)", () => {
    // Corrupt state: remove the serviceHubs entry
    const { [hubId]: _removed, ...remainingHubs } = base.serviceHubs;
    let state: GameState = {
      ...base,
      serviceHubs: remainingHubs,
    };
    const ironBefore = state.inventory.iron;
    // Drone is about to deposit
    state = withDrone(state, {
      status: "depositing",
      cargo: { itemType: "iron", amount: 3 },
      ticksRemaining: 1,
      hubId,
      currentTaskType: "hub_restock",
      deliveryTargetId: hubId,
    });
    state = droneTick(state);
    // Hub entry should have been recreated and deposit went to hub, not global
    expect(state.serviceHubs[hubId]).toBeDefined();
    expect(state.serviceHubs[hubId].inventory.iron).toBe(3);
    expect(state.inventory.iron).toBe(ironBefore); // global unchanged
  });
});
