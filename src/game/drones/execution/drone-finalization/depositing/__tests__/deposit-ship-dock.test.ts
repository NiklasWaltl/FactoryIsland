import type {
  GameState,
  PlacedAsset,
  ShipQuest,
} from "../../../../../store/types";
import { handleDepositingStatus } from "../index";
import { depositShipDock } from "../deposit-ship-dock";
import {
  createIdleDrone,
  createMinimalState,
  createMockDeps,
  emptyHubInventory,
  withDrone,
} from "./test-helpers";

function createDockAsset(id: string): PlacedAsset {
  return {
    id,
    type: "dock_warehouse",
    x: 4,
    y: 4,
    size: 2,
    width: 2,
    height: 2,
    isDockWarehouse: true,
  };
}

function createWoodQuest(amount: number): ShipQuest {
  return {
    itemId: "wood",
    amount,
    label: "Wood",
    phase: 1,
  };
}

function withDockAndHub(
  state: GameState,
  dockId: string,
  hubId: string,
): GameState {
  return {
    ...state,
    assets: {
      [dockId]: createDockAsset(dockId),
      [hubId]: {
        id: hubId,
        type: "service_hub",
        x: 8,
        y: 8,
        size: 2,
        width: 2,
        height: 2,
      },
    },
    serviceHubs: {
      [hubId]: {
        inventory: { ...emptyHubInventory },
        targetStock: { ...emptyHubInventory },
        tier: 1,
        droneIds: [state.starterDrone.droneId],
      },
    },
  };
}

describe("depositShipDock", () => {
  it("deposits matching quest cargo into the ship dock", () => {
    const deps = createMockDeps();
    const dockId = "dock-test";
    const state: GameState = {
      ...createMinimalState(),
      assets: { [dockId]: createDockAsset(dockId) },
      inventory: { ...createMinimalState().inventory, wood: 0 },
      warehouseInventories: {
        [dockId]: { ...createMinimalState().inventory, wood: 2 },
      },
      ship: {
        ...createMinimalState().ship,
        status: "docked",
        activeQuest: createWoodQuest(8),
      },
    };
    const drone = state.starterDrone;

    const outcome = depositShipDock(state, drone.droneId, {
      deliveryId: dockId,
      idleDrone: createIdleDrone(drone),
      cargo: { itemType: "wood", amount: 5 },
      deps,
    });

    expect(outcome.outcome).toBe("deposited");
    if (!outcome.handled) throw new Error("expected dock deposit");
    expect(outcome.nextState.warehouseInventories[dockId].wood).toBe(7);
    expect(outcome.nextState.inventory.wood).toBe(0);
    expect(outcome.nextState.starterDrone).toMatchObject({
      status: "idle",
      cargo: null,
      currentTaskType: null,
      deliveryTargetId: null,
    });
  });

  it("delegates to fallback when no matching quest is active", () => {
    const deps = createMockDeps();
    const dockId = "dock-test";
    const hubId = "hub-test";
    const base: GameState = {
      ...withDockAndHub(createMinimalState(), dockId, hubId),
      inventory: { ...createMinimalState().inventory, wood: 0 },
      warehouseInventories: {
        [dockId]: { ...createMinimalState().inventory, wood: 0 },
      },
      ship: {
        ...createMinimalState().ship,
        status: "sailing",
        activeQuest: null,
      },
    };
    const { state, drone } = withDrone(base, {
      status: "depositing",
      ticksRemaining: 1,
      hubId,
      currentTaskType: "building_supply",
      deliveryTargetId: dockId,
      cargo: { itemType: "wood", amount: 4 },
    });

    const next = handleDepositingStatus(state, drone.droneId, drone, deps);

    expect(next.warehouseInventories[dockId].wood).toBe(0);
    expect(next.serviceHubs[hubId].inventory.wood).toBe(4);
    expect(next.inventory.wood).toBe(0);
  });

  it("delegates to fallback when the dock warehouse is full", () => {
    const deps = createMockDeps();
    const dockId = "dock-test";
    const hubId = "hub-test";
    const base: GameState = {
      ...withDockAndHub(createMinimalState(), dockId, hubId),
      inventory: { ...createMinimalState().inventory, wood: 0 },
      warehouseInventories: {
        [dockId]: { ...createMinimalState().inventory, wood: 20 },
      },
      ship: {
        ...createMinimalState().ship,
        status: "docked",
        activeQuest: createWoodQuest(40),
      },
    };
    const { state, drone } = withDrone(base, {
      status: "depositing",
      ticksRemaining: 1,
      hubId,
      currentTaskType: "building_supply",
      deliveryTargetId: dockId,
      cargo: { itemType: "wood", amount: 4 },
    });

    const next = handleDepositingStatus(state, drone.droneId, drone, deps);

    expect(next.warehouseInventories[dockId].wood).toBe(20);
    expect(next.serviceHubs[hubId].inventory.wood).toBe(4);
    expect(next.inventory.wood).toBe(0);
  });
});
