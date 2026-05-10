import { createEmptyNetworkSlice } from "../../../inventory/reservationTypes";
import type {
  NetworkSlice,
  Reservation,
} from "../../../inventory/reservationTypes";
import type { GameAction } from "../../game-actions";
import { createEmptyInventory } from "../../inventory-ops";
import type { InventoryContextState } from "../types";
import {
  INVENTORY_HANDLED_ACTION_TYPES,
  inventoryContext,
} from "../inventory-context";

function createReservation(overrides: Partial<Reservation> = {}) {
  return {
    id: "res-1",
    itemId: "wood",
    amount: 1,
    ownerKind: "crafting_job",
    ownerId: "job-1",
    createdAt: 1,
    ...overrides,
  } satisfies Reservation;
}

function createInventoryState(network?: NetworkSlice): InventoryContextState {
  return {
    inventory: createEmptyInventory(),
    network: network ?? createEmptyNetworkSlice(),
  } satisfies InventoryContextState;
}

function expectHandled(
  result: InventoryContextState | null,
): InventoryContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected inventory action handled");
  return result;
}

describe("inventoryContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createInventoryState();
      const action = { type: "JOB_TICK" } satisfies GameAction;

      expect(inventoryContext.reduce(state, action)).toBeNull();
    });

    it("NETWORK_RESERVE_BATCH records insufficient stock without warehouse state", () => {
      const state = createInventoryState();
      const action = {
        type: "NETWORK_RESERVE_BATCH",
        items: [{ itemId: "wood", count: 1 }],
        ownerKind: "crafting_job",
        ownerId: "job-1",
      } satisfies GameAction;

      const result = expectHandled(inventoryContext.reduce(state, action));

      expect(result.network.lastError?.kind).toBe("INSUFFICIENT_STOCK");
    });

    it("NETWORK_COMMIT_RESERVATION records unknown reservation errors", () => {
      const state = createInventoryState();
      const action = {
        type: "NETWORK_COMMIT_RESERVATION",
        reservationId: "missing-reservation",
      } satisfies GameAction;

      const result = expectHandled(inventoryContext.reduce(state, action));

      expect(result.network.lastError?.kind).toBe("UNKNOWN_RESERVATION");
    });

    it("NETWORK_COMMIT_BY_OWNER records unknown owner errors", () => {
      const state = createInventoryState();
      const action = {
        type: "NETWORK_COMMIT_BY_OWNER",
        ownerKind: "crafting_job",
        ownerId: "missing-job",
      } satisfies GameAction;

      const result = expectHandled(inventoryContext.reduce(state, action));

      expect(result.network.lastError?.kind).toBe("UNKNOWN_RESERVATION");
    });

    it("NETWORK_CANCEL_RESERVATION removes the reservation", () => {
      const reservation = createReservation();
      const state = createInventoryState({
        reservations: [reservation],
        nextReservationId: 2,
        lastError: null,
      });
      const action = {
        type: "NETWORK_CANCEL_RESERVATION",
        reservationId: reservation.id,
      } satisfies GameAction;

      const result = expectHandled(inventoryContext.reduce(state, action));

      expect(result.network.reservations).toEqual([]);
    });

    it("NETWORK_CANCEL_BY_OWNER removes matching reservations", () => {
      const reservation = createReservation();
      const state = createInventoryState({
        reservations: [reservation],
        nextReservationId: 2,
        lastError: null,
      });
      const action = {
        type: "NETWORK_CANCEL_BY_OWNER",
        ownerKind: "crafting_job",
        ownerId: reservation.ownerId,
      } satisfies GameAction;

      const result = expectHandled(inventoryContext.reduce(state, action));

      expect(result.network.reservations).toEqual([]);
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(inventoryContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(inventoryContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        INVENTORY_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(inventoryContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
