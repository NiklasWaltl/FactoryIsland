import { SERVICE_HUB_TARGET_STOCK } from "../../../../../store/constants/hub/hub-target-stock";
import type { GameState, PlacedAsset } from "../../../../../store/types";
import { finalizeHubAfterConstruction } from "../deposit-hub-upgrade";
import {
  createMinimalState,
  createMockDeps,
  emptyHubInventory,
} from "./test-helpers";

function createHubAsset(id: string): PlacedAsset {
  return {
    id,
    type: "service_hub",
    x: 12,
    y: 14,
    size: 2,
    width: 2,
    height: 2,
  };
}

describe("finalizeHubAfterConstruction", () => {
  it("finalizes a tier-2 upgrade and updates hub state", () => {
    const deps = createMockDeps(["one", "two", "three"]);
    const hubId = "hub-upgrade-test";
    const base = createMinimalState();
    const state: GameState = {
      ...base,
      assets: { [hubId]: createHubAsset(hubId) },
      serviceHubs: {
        [hubId]: {
          inventory: { ...emptyHubInventory, wood: 5 },
          targetStock: { ...emptyHubInventory },
          tier: 1,
          droneIds: [base.drones.starter.droneId],
          pendingUpgrade: { wood: 5 },
        },
      },
    };

    const next = finalizeHubAfterConstruction(state, {
      deliveryId: hubId,
      deps,
    });

    expect(next.serviceHubs[hubId]).toMatchObject({
      tier: 2,
      targetStock: SERVICE_HUB_TARGET_STOCK,
      inventory: { ...emptyHubInventory, wood: 5 },
      pendingUpgrade: undefined,
    });
    expect(next.serviceHubs[hubId].droneIds).toEqual([
      "starter",
      "drone-one",
      "drone-two",
      "drone-three",
    ]);
    expect(next.drones["drone-one"]).toMatchObject({
      droneId: "drone-one",
      hubId,
      status: "idle",
    });
    expect(next.notifications).toHaveLength(1);
    expect(next.notifications[0]).toMatchObject({
      resource: "hub_upgrade",
      amount: 1,
    });
  });

  it("spawns the first drone for a completed proto hub", () => {
    const deps = createMockDeps(["proto"]);
    const hubId = "hub-proto-test";
    const state: GameState = {
      ...createMinimalState(),
      assets: { [hubId]: createHubAsset(hubId) },
      serviceHubs: {
        [hubId]: {
          inventory: { ...emptyHubInventory },
          targetStock: { ...emptyHubInventory },
          tier: 1,
          droneIds: [],
        },
      },
    };

    const next = finalizeHubAfterConstruction(state, {
      deliveryId: hubId,
      deps,
    });

    expect(next.serviceHubs[hubId].droneIds).toEqual(["drone-proto"]);
    expect(next.drones["drone-proto"]).toMatchObject({
      droneId: "drone-proto",
      hubId,
      status: "idle",
      tileX: 12,
      tileY: 14,
    });
    expect(next.notifications).toHaveLength(0);
  });
});
