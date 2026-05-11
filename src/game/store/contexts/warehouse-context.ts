import type { GameAction } from "../game-actions";
import type { BoundedContext, WarehouseContextState } from "./types";

export const WAREHOUSE_HANDLED_ACTION_TYPES = [
  "TRANSFER_TO_WAREHOUSE",
  "TRANSFER_FROM_WAREHOUSE",
  "LOGISTICS_TICK",
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
    case "TRANSFER_TO_WAREHOUSE":
    case "TRANSFER_FROM_WAREHOUSE":
    case "LOGISTICS_TICK":
      // cross-slice: no-op in isolated context
      // Transfers need state.inventory + state.selectedWarehouseId; the
      // logistics tick reads many fields outside the warehouse slice.
      return state;

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
