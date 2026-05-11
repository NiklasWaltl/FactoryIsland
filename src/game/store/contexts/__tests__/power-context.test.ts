import type { GameAction } from "../../game-actions";
import type { PowerContextState } from "../types";
import { POWER_HANDLED_ACTION_TYPES, powerContext } from "../power-context";

function createPowerState(): PowerContextState {
  return {
    battery: { stored: 0, capacity: 100 },
    generators: {},
    poweredMachineIds: [],
    machinePowerRatio: {},
  } satisfies PowerContextState;
}

describe("powerContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createPowerState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBeNull();
    });

    it("GENERATOR_ADD_FUEL keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createPowerState();
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 5,
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_REQUEST_REFILL keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createPowerState();
      const action = {
        type: "GENERATOR_REQUEST_REFILL",
        amount: "max",
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_START keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createPowerState();
      const action = { type: "GENERATOR_START" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_STOP keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createPowerState();
      const action = { type: "GENERATOR_STOP" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_TICK keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createPowerState();
      const action = { type: "GENERATOR_TICK" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("ENERGY_NET_TICK keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createPowerState();
      const action = { type: "ENERGY_NET_TICK" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("REMOVE_POWER_POLE keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createPowerState();
      const action = {
        type: "REMOVE_POWER_POLE",
        assetId: "pole-1",
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(powerContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(powerContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        POWER_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(powerContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
