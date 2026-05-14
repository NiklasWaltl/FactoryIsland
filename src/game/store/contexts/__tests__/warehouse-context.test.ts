import type { GameAction } from "../../game-actions";
import type { WarehouseContextState } from "../types";
import {
  WAREHOUSE_HANDLED_ACTION_TYPES,
  warehouseContext,
} from "../warehouse-context";

function createWarehouseState(): WarehouseContextState {
  return {
    warehousesPlaced: 0,
    warehouseInventories: {},
  } satisfies WarehouseContextState;
}

describe("warehouseContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createWarehouseState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(warehouseContext.reduce(state, action)).toBeNull();
    });

    it("TRANSFER_TO_WAREHOUSE keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createWarehouseState();
      const action = {
        type: "TRANSFER_TO_WAREHOUSE",
        item: "wood",
        amount: 5,
      } satisfies GameAction;

      expect(warehouseContext.reduce(state, action)).toBe(state);
    });

    it("TRANSFER_FROM_WAREHOUSE keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createWarehouseState();
      const action = {
        type: "TRANSFER_FROM_WAREHOUSE",
        item: "wood",
        amount: 5,
      } satisfies GameAction;

      expect(warehouseContext.reduce(state, action)).toBe(state);
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
