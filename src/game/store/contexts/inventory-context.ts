import { applyNetworkAction } from "../../inventory/reservations";
import type { GameAction } from "../game-actions";
import type { InventoryContextState, BoundedContext } from "./types";

export const INVENTORY_HANDLED_ACTION_TYPES = [
  "NETWORK_RESERVE_BATCH",
  "NETWORK_COMMIT_RESERVATION",
  "NETWORK_COMMIT_BY_OWNER",
  "NETWORK_CANCEL_RESERVATION",
  "NETWORK_CANCEL_BY_OWNER",
] as const satisfies readonly GameAction["type"][];

type InventoryActionType = (typeof INVENTORY_HANDLED_ACTION_TYPES)[number];
type InventoryAction = Extract<GameAction, { type: InventoryActionType }>;

const INVENTORY_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  INVENTORY_HANDLED_ACTION_TYPES,
);

function isInventoryAction(action: GameAction): action is InventoryAction {
  return INVENTORY_ACTION_TYPE_SET.has(action.type);
}

function reduceInventory(
  state: InventoryContextState,
  action: InventoryAction,
): InventoryContextState {
  const actionType = action.type;

  switch (actionType) {
    case "NETWORK_RESERVE_BATCH":
    case "NETWORK_COMMIT_RESERVATION":
    case "NETWORK_COMMIT_BY_OWNER":
    case "NETWORK_CANCEL_RESERVATION":
    case "NETWORK_CANCEL_BY_OWNER": {
      const result = applyNetworkAction({}, state.network, action);
      if (result.network === state.network) return state;
      return { ...state, network: result.network };
    }

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const inventoryContext: BoundedContext<InventoryContextState> = {
  reduce(state, action) {
    if (!isInventoryAction(action)) return null;
    return reduceInventory(state, action);
  },
  handledActionTypes: INVENTORY_HANDLED_ACTION_TYPES,
};
