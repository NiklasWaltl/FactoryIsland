import { computeConnectedAssetIds } from "../../../../../logistics/connectivity";
import type { GameState, PlacedAsset } from "../../../../../store/types";
import { depositConstruction } from "../deposit-construction";
import {
  createIdleDrone,
  createMinimalState,
  createMockDeps,
  emptyHubInventory,
} from "./test-helpers";

jest.mock("../../../../../logistics/connectivity", () => ({
  computeConnectedAssetIds: jest.fn(() => ["connected-test"]),
}));

const mockedComputeConnectedAssetIds =
  computeConnectedAssetIds as jest.MockedFunction<
    typeof computeConnectedAssetIds
  >;

function createAsset(id: string, type: PlacedAsset["type"]): PlacedAsset {
  return {
    id,
    type,
    x: 10,
    y: 10,
    size: 2,
    width: 2,
    height: 2,
  };
}

function withConstructionSite(
  state: GameState,
  siteId: string,
  assetType: PlacedAsset["type"],
  remaining: GameState["constructionSites"][string]["remaining"],
): GameState {
  return {
    ...state,
    assets: { ...state.assets, [siteId]: createAsset(siteId, assetType) },
    constructionSites: {
      ...state.constructionSites,
      [siteId]: { buildingType: assetType as "workbench", remaining },
    },
  };
}

describe("depositConstruction", () => {
  beforeEach(() => {
    mockedComputeConnectedAssetIds.mockClear();
    mockedComputeConnectedAssetIds.mockReturnValue(["connected-test"]);
  });

  it("stores construction material without completing the site", () => {
    const deps = createMockDeps();
    const siteId = "site-test";
    const state = withConstructionSite(
      createMinimalState(),
      siteId,
      "workbench",
      {
        wood: 8,
        stone: 2,
      },
    );
    const drone = state.starterDrone;

    const next = depositConstruction(state, drone.droneId, {
      deliveryId: siteId,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "wood", amount: 5 },
      deps,
    });

    expect(next.constructionSites[siteId].remaining).toEqual({
      wood: 3,
      stone: 2,
    });
    expect(next.inventory.wood).toBe(state.inventory.wood);
    expect(next.starterDrone.cargo).toBeNull();
    expect(mockedComputeConnectedAssetIds).not.toHaveBeenCalled();
  });

  it("recomputes connectivity when the last material completes construction", () => {
    const deps = createMockDeps();
    const siteId = "site-test";
    const state = withConstructionSite(
      createMinimalState(),
      siteId,
      "workbench",
      {
        wood: 5,
      },
    );
    const drone = state.starterDrone;

    const next = depositConstruction(state, drone.droneId, {
      deliveryId: siteId,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "wood", amount: 5 },
      deps,
    });

    expect(next.constructionSites[siteId]).toBeUndefined();
    expect(mockedComputeConnectedAssetIds).toHaveBeenCalledTimes(1);
    expect(next.connectedAssetIds).toEqual(["connected-test"]);
  });

  it("finalizes a completed hub upgrade site through the hub-upgrade finalizer", () => {
    const deps = createMockDeps(["one", "two", "three"]);
    const hubId = "hub-upgrade-test";
    const stateWithSite = withConstructionSite(
      createMinimalState(),
      hubId,
      "service_hub",
      { wood: 5 },
    );
    const state: GameState = {
      ...stateWithSite,
      serviceHubs: {
        [hubId]: {
          inventory: { ...emptyHubInventory, wood: 5 },
          targetStock: { ...emptyHubInventory },
          tier: 1,
          droneIds: [stateWithSite.starterDrone.droneId],
          pendingUpgrade: { wood: 5 },
        },
      },
    };
    const drone = state.starterDrone;

    const next = depositConstruction(state, drone.droneId, {
      deliveryId: hubId,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "wood", amount: 5 },
      deps,
    });

    expect(next.constructionSites[hubId]).toBeUndefined();
    expect(next.serviceHubs[hubId]).toMatchObject({
      tier: 2,
      pendingUpgrade: undefined,
    });
    expect(next.serviceHubs[hubId].droneIds).toHaveLength(4);
    expect(next.notifications).toHaveLength(1);
  });

  it("spawns the first drone for a completed proto hub construction", () => {
    const deps = createMockDeps(["proto"]);
    const hubId = "hub-proto-test";
    const stateWithSite = withConstructionSite(
      createMinimalState(),
      hubId,
      "service_hub",
      { wood: 5 },
    );
    const state: GameState = {
      ...stateWithSite,
      serviceHubs: {
        [hubId]: {
          inventory: { ...emptyHubInventory },
          targetStock: { ...emptyHubInventory },
          tier: 1,
          droneIds: [],
        },
      },
    };
    const drone = state.starterDrone;

    const next = depositConstruction(state, drone.droneId, {
      deliveryId: hubId,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "wood", amount: 5 },
      deps,
    });

    expect(next.serviceHubs[hubId].droneIds).toEqual(["drone-proto"]);
    expect(next.drones["drone-proto"]).toMatchObject({
      droneId: "drone-proto",
      hubId,
      status: "idle",
      tileX: 10,
      tileY: 10,
    });
  });
});
