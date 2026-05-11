import type { GameAction } from "../../game-actions";
import type { ShipState } from "../../types/ship-types";
import type { ShipContextState } from "../types";
import { SHIP_HANDLED_ACTION_TYPES, shipContext } from "../ship-context";

function createShipState(overrides: Partial<ShipState> = {}): ShipContextState {
  return {
    ship: {
      status: "sailing",
      activeQuest: null,
      nextQuest: null,
      questHistory: [],
      dockedAt: null,
      departureAt: null,
      returnsAt: null,
      rewardPending: false,
      lastReward: null,
      questPhase: 1,
      shipsSinceLastFragment: 0,
      pityCounter: 0,
      pendingMultiplier: 1,
      ...overrides,
    },
  } satisfies ShipContextState;
}

function expectHandled(result: ShipContextState | null): ShipContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected ship action handled");
  return result;
}

describe("shipContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createShipState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(shipContext.reduce(state, action)).toBeNull();
    });

    it("SHIP_DOCK transitions the ship into docked status with a quest drawn", () => {
      const state = createShipState();
      const action = { type: "SHIP_DOCK" } satisfies GameAction;

      const result = expectHandled(shipContext.reduce(state, action));

      expect(result.ship.status).toBe("docked");
      expect(result.ship.activeQuest).not.toBeNull();
      expect(result.ship.nextQuest).not.toBeNull();
      expect(result.ship.dockedAt).not.toBeNull();
      expect(result.ship.departureAt).not.toBeNull();
      expect(result.ship.returnsAt).toBeNull();
      expect(result.ship.rewardPending).toBe(false);
      expect(result.ship.pendingMultiplier).toBe(1);
    });

    it("SHIP_TICK keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createShipState();
      const action = { type: "SHIP_TICK" } satisfies GameAction;

      expect(shipContext.reduce(state, action)).toBe(state);
    });

    it("SHIP_DEPART keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createShipState();
      const action = { type: "SHIP_DEPART" } satisfies GameAction;

      expect(shipContext.reduce(state, action)).toBe(state);
    });

    it("SHIP_RETURN keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createShipState();
      const action = { type: "SHIP_RETURN" } satisfies GameAction;

      expect(shipContext.reduce(state, action)).toBe(state);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(shipContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(shipContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        SHIP_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(shipContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
