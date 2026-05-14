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

function createInventoryState(
  network?: NetworkSlice,
  warehouseInventories?: InventoryContextState["warehouseInventories"],
): InventoryContextState {
  return {
    inventory: createEmptyInventory(),
    network: network ?? createEmptyNetworkSlice(),
    ...(warehouseInventories !== undefined ? { warehouseInventories } : {}),
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

    it("NETWORK_RESERVE_BATCH uses warehouse snapshot and sets error on overflow", () => {
      const state = createInventoryState(undefined, {
        wh1: { ...createEmptyInventory(), iron: 10 },
      });

      const reserveWithinStock = {
        type: "NETWORK_RESERVE_BATCH",
        items: [{ itemId: "iron", count: 5 }],
        ownerKind: "system_request",
        ownerId: "reserve-test-1",
      } satisfies GameAction;

      const afterFirstReserve = expectHandled(
        inventoryContext.reduce(state, reserveWithinStock),
      );

      expect(afterFirstReserve.network.lastError).toBeNull();
      expect(afterFirstReserve.network.reservations).toHaveLength(1);
      expect(afterFirstReserve.network.reservations[0]).toMatchObject({
        itemId: "iron",
        amount: 5,
        ownerId: "reserve-test-1",
      });
      expect(afterFirstReserve.warehouseInventories).toEqual(
        state.warehouseInventories,
      );

      const reserveOverflow = {
        type: "NETWORK_RESERVE_BATCH",
        items: [{ itemId: "iron", count: 15 }],
        ownerKind: "system_request",
        ownerId: "reserve-test-2",
      } satisfies GameAction;

      const afterOverflow = expectHandled(
        inventoryContext.reduce(afterFirstReserve, reserveOverflow),
      );

      expect(afterOverflow.network.lastError?.kind).toBe("INSUFFICIENT_STOCK");
      expect(afterOverflow.network.reservations).toHaveLength(1);
      expect(afterOverflow.warehouseInventories).toEqual(
        state.warehouseInventories,
      );
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

    it("NETWORK_COMMIT_RESERVATION decrements physical stock and removes the reservation", () => {
      const reservation = createReservation({
        id: "res-1",
        itemId: "wood",
        amount: 3,
      });
      const state = createInventoryState(
        {
          reservations: [reservation],
          nextReservationId: 2,
          lastError: null,
        },
        { "wh-A": { ...createEmptyInventory(), wood: 10 } },
      );
      const action = {
        type: "NETWORK_COMMIT_RESERVATION",
        reservationId: reservation.id,
      } satisfies GameAction;

      const result = expectHandled(inventoryContext.reduce(state, action));

      expect(result.network.reservations).toEqual([]);
      expect(result.network.lastError).toBeNull();
      expect(result.warehouseInventories?.["wh-A"]?.wood).toBe(7);
    });

    it("NETWORK_COMMIT_RESERVATION with unknown id leaves warehouseInventories untouched", () => {
      const state = createInventoryState(undefined, {
        "wh-A": { ...createEmptyInventory(), wood: 10 },
      });
      const action = {
        type: "NETWORK_COMMIT_RESERVATION",
        reservationId: "missing-reservation",
      } satisfies GameAction;

      const result = expectHandled(inventoryContext.reduce(state, action));

      expect(result.network.lastError?.kind).toBe("UNKNOWN_RESERVATION");
      expect(result.warehouseInventories).toBe(state.warehouseInventories);
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

    it("NETWORK_COMMIT_BY_OWNER decrements physical stock for all owner reservations", () => {
      const reservationWood = createReservation({
        id: "res-1",
        itemId: "wood",
        amount: 3,
        ownerKind: "crafting_job",
        ownerId: "job-1",
      });
      const reservationStone = createReservation({
        id: "res-2",
        itemId: "stone",
        amount: 2,
        ownerKind: "crafting_job",
        ownerId: "job-1",
      });
      const state = createInventoryState(
        {
          reservations: [reservationWood, reservationStone],
          nextReservationId: 3,
          lastError: null,
        },
        { "wh-A": { ...createEmptyInventory(), wood: 10, stone: 5 } },
      );
      const action = {
        type: "NETWORK_COMMIT_BY_OWNER",
        ownerKind: "crafting_job",
        ownerId: "job-1",
      } satisfies GameAction;

      const result = expectHandled(inventoryContext.reduce(state, action));

      expect(result.network.reservations).toEqual([]);
      expect(result.network.lastError).toBeNull();
      expect(result.warehouseInventories?.["wh-A"]?.wood).toBe(7);
      expect(result.warehouseInventories?.["wh-A"]?.stone).toBe(3);
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
