import { createInitialState } from "../../../../../store/initial-state";
import type {
  GameNotification,
  GameState,
  StarterDroneState,
} from "../../../../../store/types";
import type { DroneFinalizationDeps } from "../../types";

export function createMockDeps(
  ids: string[] = ["one", "two", "three", "four"],
): DroneFinalizationDeps {
  let idIndex = 0;
  return {
    makeId: jest.fn(() => ids[idIndex++] ?? `id-${idIndex}`),
    addNotification: jest.fn(
      (notifications: GameNotification[], resource: string, amount: number) => [
        ...notifications,
        {
          id: `notification-${resource}-${amount}`,
          resource,
          displayName: resource,
          amount,
          expiresAt: 0,
          kind: "success" as const,
        },
      ],
    ),
    debugLog: {
      inventory: jest.fn(),
      building: jest.fn(),
      mining: jest.fn(),
    },
  };
}

export function createMinimalState(): GameState {
  const base = createInitialState("release");
  const starter: StarterDroneState = {
    ...base.drones.starter,
    hubId: null,
  };

  return {
    ...base,
    assets: {},
    cellMap: {},
    warehouseInventories: {},
    serviceHubs: {},
    constructionSites: {},
    generators: {},
    connectedAssetIds: [],
    notifications: [],
    drones: { [starter.droneId]: starter },
  };
}

export function withDrone(
  state: GameState,
  patch: Partial<StarterDroneState>,
): { state: GameState; drone: StarterDroneState } {
  const drone: StarterDroneState = {
    ...state.drones.starter,
    ...patch,
  };
  return {
    drone,
    state: {
      ...state,
      drones: { ...state.drones, [drone.droneId]: drone },
    },
  };
}

export function createIdleDrone(drone: StarterDroneState): StarterDroneState {
  return {
    ...drone,
    status: "idle",
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
  };
}

export const emptyHubInventory = {
  wood: 0,
  stone: 0,
  iron: 0,
  copper: 0,
};
