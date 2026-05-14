import type { GameAction } from "../game-actions";
import { addResources } from "../inventory-ops";
import { consumeResources } from "../helpers/reducer-helpers";
import { getWarehouseCapacity } from "../warehouse-capacity";
import type { BoundedContext, WarehouseContextState } from "./types";

export const WAREHOUSE_HANDLED_ACTION_TYPES = [
  "TRANSFER_TO_WAREHOUSE",
  "TRANSFER_FROM_WAREHOUSE",
] as const satisfies readonly GameAction["type"][];

type WarehouseActionType = (typeof WAREHOUSE_HANDLED_ACTION_TYPES)[number];
type WarehouseAction = Extract<GameAction, { type: WarehouseActionType }>;

const WAREHOUSE_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  WAREHOUSE_HANDLED_ACTION_TYPES,
);

function isWarehouseAction(action: GameAction): action is WarehouseAction {
  return WAREHOUSE_ACTION_TYPE_SET.has(action.type);
}

function reduceWarehouse(
  state: WarehouseContextState,
  action: WarehouseAction,
): WarehouseContextState {
  const actionType = action.type;

  switch (actionType) {
    case "TRANSFER_TO_WAREHOUSE": {
      const { item, amount } = action;
      if (amount <= 0) return state;
      const whId = state.selectedWarehouseId;
      if (!whId) return state;
      const whInv = state.warehouseInventories[whId];
      if (!whInv) return state;

      const globalAvailable = state.inventory[item] as number;
      const whCap = getWarehouseCapacity(state.mode);
      const whCurrent = whInv[item] as number;
      const spaceInWarehouse =
        item === "coins" ? Infinity : Math.max(0, whCap - whCurrent);
      const transferAmount = Math.min(
        amount,
        globalAvailable,
        spaceInWarehouse,
      );
      if (transferAmount <= 0) return state;

      return {
        ...state,
        inventory: consumeResources(state.inventory, {
          [item]: transferAmount,
        }),
        warehouseInventories: {
          ...state.warehouseInventories,
          [whId]: addResources(whInv, { [item]: transferAmount }),
        },
      };
    }

    case "TRANSFER_FROM_WAREHOUSE": {
      const { item, amount } = action;
      if (amount <= 0) return state;
      const whId = state.selectedWarehouseId;
      if (!whId) return state;
      const whInv = state.warehouseInventories[whId];
      if (!whInv) return state;

      const whAvailable = whInv[item] as number;
      const transferAmount = Math.min(amount, whAvailable);
      if (transferAmount <= 0) return state;

      return {
        ...state,
        inventory: addResources(state.inventory, { [item]: transferAmount }),
        warehouseInventories: {
          ...state.warehouseInventories,
          [whId]: consumeResources(whInv, { [item]: transferAmount }),
        },
      };
    }

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const warehouseContext: BoundedContext<WarehouseContextState> = {
  reduce(state, action) {
    if (!isWarehouseAction(action)) return null;
    return reduceWarehouse(state, action);
  },
  handledActionTypes: WAREHOUSE_HANDLED_ACTION_TYPES,
};
