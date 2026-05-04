import type { GameState, PlacedAsset } from "../../../../../store/types";
import { depositFallback } from "../deposit-fallback";
import {
  createIdleDrone,
  createMinimalState,
  createMockDeps,
  emptyHubInventory,
  withDrone,
} from "./test-helpers";

function createHubAsset(id: string): PlacedAsset {
  return {
    id,
    type: "service_hub",
    x: 6,
    y: 6,
    size: 2,
    width: 2,
    height: 2,
  };
}

function withHub(state: GameState, hubId: string): GameState {
  return {
    ...state,
    assets: { ...state.assets, [hubId]: createHubAsset(hubId) },
    serviceHubs: {
      [hubId]: {
        inventory: { ...emptyHubInventory, wood: 1 },
        targetStock: { ...emptyHubInventory },
        tier: 1,
        droneIds: [state.starterDrone.droneId],
      },
    },
  };
}

describe("depositFallback", () => {
  it("restocks an assigned hub inventory", () => {
    const deps = createMockDeps();
    const hubId = "hub-test";
    const base = withHub(createMinimalState(), hubId);
    const { state, drone } = withDrone(base, {
      hubId,
      status: "depositing",
      cargo: { itemType: "stone", amount: 3 },
    });

    const next = depositFallback(state, drone.droneId, {
      drone,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "stone", amount: 3 },
      deps,
    });

    expect(next.serviceHubs[hubId].inventory).toMatchObject({
      wood: 1,
      stone: 3,
    });
    expect(next.inventory.stone).toBe(state.inventory.stone);
    expect(next.starterDrone).toMatchObject({ status: "idle", cargo: null });
  });

  it("self-heals a missing hub entry when the hub asset still exists", () => {
    const deps = createMockDeps();
    const hubId = "hub-damaged";
    const base: GameState = {
      ...createMinimalState(),
      assets: { [hubId]: createHubAsset(hubId) },
      serviceHubs: {},
    };
    const { state, drone } = withDrone(base, {
      hubId,
      status: "depositing",
      cargo: { itemType: "iron", amount: 2 },
    });

    const next = depositFallback(state, drone.droneId, {
      drone,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "iron", amount: 2 },
      deps,
    });

    expect(next.serviceHubs[hubId]).toMatchObject({
      tier: 1,
      droneIds: [drone.droneId],
      inventory: { ...emptyHubInventory, iron: 2 },
    });
    expect(deps.debugLog.inventory).toHaveBeenCalledWith(
      expect.stringContaining("self-healing"),
    );
  });

  it("deposits into the global inventory when no specific path applies", () => {
    const deps = createMockDeps();
    const base: GameState = {
      ...createMinimalState(),
      inventory: { ...createMinimalState().inventory, copper: 1 },
    };
    const { state, drone } = withDrone(base, {
      hubId: null,
      status: "depositing",
      cargo: { itemType: "copper", amount: 4 },
    });

    const next = depositFallback(state, drone.droneId, {
      drone,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "copper", amount: 4 },
      deps,
    });

    expect(next.inventory.copper).toBe(5);
    expect(next.serviceHubs).toEqual({});
    expect(next.starterDrone).toMatchObject({ status: "idle", cargo: null });
  });
});
