import { WAREHOUSE_CAPACITY } from "../../constants/buildings/index";
import type { GameAction } from "../../game-actions";
import { createEmptyInventory } from "../../inventory-ops";
import type { GameMode } from "../../types";
import type { WarehouseContextState } from "../types";
import {
  WAREHOUSE_HANDLED_ACTION_TYPES,
  warehouseContext,
} from "../warehouse-context";

function createWarehouseState(
  overrides: Partial<WarehouseContextState> = {},
): WarehouseContextState {
  return {
    warehousesPlaced: 0,
    warehouseInventories: {},
    inventory: createEmptyInventory(),
    selectedWarehouseId: null,
    mode: "release" as GameMode,
    ...overrides,
  } satisfies WarehouseContextState;
}

describe("warehouseContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createWarehouseState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(warehouseContext.reduce(state, action)).toBeNull();
    });

    describe("TRANSFER_TO_WAREHOUSE", () => {
      it("moves the requested amount from inventory into the selected warehouse", () => {
        const inv = { ...createEmptyInventory(), iron: 50 };
        const whInv = { ...createEmptyInventory() };
        const state = createWarehouseState({
          selectedWarehouseId: "wh-A",
          warehouseInventories: { "wh-A": whInv },
          inventory: inv,
        });
        const action = {
          type: "TRANSFER_TO_WAREHOUSE",
          item: "iron",
          amount: 10,
        } satisfies GameAction;

        const result = warehouseContext.reduce(state, action);

        expect(result).not.toBe(state);
        expect(result!.inventory.iron).toBe(40);
        expect(result!.warehouseInventories["wh-A"]!.iron).toBe(10);
      });

      it("clamps to the remaining warehouse capacity", () => {
        const whInv = {
          ...createEmptyInventory(),
          iron: WAREHOUSE_CAPACITY - 3,
        };
        const state = createWarehouseState({
          selectedWarehouseId: "wh-A",
          warehouseInventories: { "wh-A": whInv },
          inventory: { ...createEmptyInventory(), iron: 50 },
        });
        const action = {
          type: "TRANSFER_TO_WAREHOUSE",
          item: "iron",
          amount: 10,
        } satisfies GameAction;

        const result = warehouseContext.reduce(state, action);

        expect(result!.warehouseInventories["wh-A"]!.iron).toBe(
          WAREHOUSE_CAPACITY,
        );
        expect(result!.inventory.iron).toBe(50 - 3);
      });

      it("is a no-op when the warehouse is full (identity short-circuit)", () => {
        const state = createWarehouseState({
          selectedWarehouseId: "wh-A",
          warehouseInventories: {
            "wh-A": { ...createEmptyInventory(), iron: WAREHOUSE_CAPACITY },
          },
          inventory: { ...createEmptyInventory(), iron: 50 },
        });
        const action = {
          type: "TRANSFER_TO_WAREHOUSE",
          item: "iron",
          amount: 1,
        } satisfies GameAction;

        expect(warehouseContext.reduce(state, action)).toBe(state);
      });

      it("is a no-op when amount is zero", () => {
        const state = createWarehouseState({
          selectedWarehouseId: "wh-A",
          warehouseInventories: { "wh-A": createEmptyInventory() },
          inventory: { ...createEmptyInventory(), iron: 10 },
        });
        const action = {
          type: "TRANSFER_TO_WAREHOUSE",
          item: "iron",
          amount: 0,
        } satisfies GameAction;

        expect(warehouseContext.reduce(state, action)).toBe(state);
      });

      it("is a no-op when no warehouse is selected", () => {
        const state = createWarehouseState({
          selectedWarehouseId: null,
          warehouseInventories: { "wh-A": createEmptyInventory() },
          inventory: { ...createEmptyInventory(), iron: 10 },
        });
        const action = {
          type: "TRANSFER_TO_WAREHOUSE",
          item: "iron",
          amount: 5,
        } satisfies GameAction;

        expect(warehouseContext.reduce(state, action)).toBe(state);
      });
    });

    describe("TRANSFER_FROM_WAREHOUSE", () => {
      it("moves the requested amount from the warehouse into the global inventory", () => {
        const state = createWarehouseState({
          selectedWarehouseId: "wh-A",
          warehouseInventories: {
            "wh-A": { ...createEmptyInventory(), iron: 15 },
          },
        });
        const action = {
          type: "TRANSFER_FROM_WAREHOUSE",
          item: "iron",
          amount: 5,
        } satisfies GameAction;

        const result = warehouseContext.reduce(state, action);

        expect(result).not.toBe(state);
        expect(result!.warehouseInventories["wh-A"]!.iron).toBe(10);
        expect(result!.inventory.iron).toBe(5);
      });

      it("clamps to the available warehouse stock", () => {
        const state = createWarehouseState({
          selectedWarehouseId: "wh-A",
          warehouseInventories: {
            "wh-A": { ...createEmptyInventory(), iron: 15 },
          },
        });
        const action = {
          type: "TRANSFER_FROM_WAREHOUSE",
          item: "iron",
          amount: 999,
        } satisfies GameAction;

        const result = warehouseContext.reduce(state, action);

        expect(result!.warehouseInventories["wh-A"]!.iron).toBe(0);
        expect(result!.inventory.iron).toBe(15);
      });

      it("is a no-op when the warehouse has no stock of the requested item", () => {
        const state = createWarehouseState({
          selectedWarehouseId: "wh-A",
          warehouseInventories: { "wh-A": createEmptyInventory() },
        });
        const action = {
          type: "TRANSFER_FROM_WAREHOUSE",
          item: "iron",
          amount: 5,
        } satisfies GameAction;

        expect(warehouseContext.reduce(state, action)).toBe(state);
      });

      it("is a no-op when amount is zero", () => {
        const state = createWarehouseState({
          selectedWarehouseId: "wh-A",
          warehouseInventories: {
            "wh-A": { ...createEmptyInventory(), iron: 10 },
          },
        });
        const action = {
          type: "TRANSFER_FROM_WAREHOUSE",
          item: "iron",
          amount: 0,
        } satisfies GameAction;

        expect(warehouseContext.reduce(state, action)).toBe(state);
      });

      it("is a no-op when no warehouse is selected", () => {
        const state = createWarehouseState({
          selectedWarehouseId: null,
          warehouseInventories: {
            "wh-A": { ...createEmptyInventory(), iron: 10 },
          },
        });
        const action = {
          type: "TRANSFER_FROM_WAREHOUSE",
          item: "iron",
          amount: 5,
        } satisfies GameAction;

        expect(warehouseContext.reduce(state, action)).toBe(state);
      });
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(warehouseContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(warehouseContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        WAREHOUSE_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(warehouseContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
