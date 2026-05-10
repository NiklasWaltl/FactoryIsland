import type { GameAction } from "../../game-actions";
import type { StarterDroneState } from "../../types";
import type { DroneContextState } from "../types";
import { DRONES_HANDLED_ACTION_TYPES, dronesContext } from "../drones-context";

function createDrone(overrides: Partial<StarterDroneState> = {}) {
  return {
    status: "idle",
    tileX: 0,
    tileY: 0,
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    hubId: null,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
    droneId: "starter",
    deconstructRefund: null,
    ...overrides,
  } satisfies StarterDroneState;
}

function createDroneState(): DroneContextState {
  return {
    drones: {
      starter: createDrone(),
    },
  } satisfies DroneContextState;
}

function expectHandled(result: DroneContextState | null): DroneContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected drone action handled");
  return result;
}

describe("dronesContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createDroneState();
      const action = { type: "JOB_TICK" } satisfies GameAction;

      expect(dronesContext.reduce(state, action)).toBeNull();
    });

    it("DRONE_TICK keeps the slice unchanged during Phase 2", () => {
      const state = createDroneState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(dronesContext.reduce(state, action)).toBe(state);
    });

    it("DRONE_SET_ROLE updates the target drone role", () => {
      const state = createDroneState();
      const action = {
        type: "DRONE_SET_ROLE",
        droneId: "starter",
        role: "construction",
      } satisfies GameAction;

      const result = expectHandled(dronesContext.reduce(state, action));

      expect(result.drones.starter.role).toBe("construction");
    });

    it("ASSIGN_DRONE_TO_HUB keeps the slice unchanged during Phase 2", () => {
      const state = createDroneState();
      const action = {
        type: "ASSIGN_DRONE_TO_HUB",
        droneId: "starter",
        hubId: "hub-1",
      } satisfies GameAction;

      expect(dronesContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(dronesContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(dronesContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        DRONES_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(dronesContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
