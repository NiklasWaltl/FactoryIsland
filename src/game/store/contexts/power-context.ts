import type { GameAction } from "../game-actions";
import type { BoundedContext, PowerContextState } from "./types";

export const POWER_HANDLED_ACTION_TYPES = [
  "GENERATOR_ADD_FUEL",
  "GENERATOR_REQUEST_REFILL",
  "GENERATOR_START",
  "GENERATOR_STOP",
  "GENERATOR_TICK",
  "ENERGY_NET_TICK",
  "REMOVE_POWER_POLE",
] as const satisfies readonly GameAction["type"][];

type PowerActionType = (typeof POWER_HANDLED_ACTION_TYPES)[number];
type PowerAction = Extract<GameAction, { type: PowerActionType }>;

const POWER_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  POWER_HANDLED_ACTION_TYPES,
);

function isPowerAction(action: GameAction): action is PowerAction {
  return POWER_ACTION_TYPE_SET.has(action.type);
}

function reducePower(
  state: PowerContextState,
  action: PowerAction,
): PowerContextState {
  const actionType = action.type;

  switch (actionType) {
    case "GENERATOR_ADD_FUEL":
    case "GENERATOR_REQUEST_REFILL":
    case "GENERATOR_START":
    case "GENERATOR_STOP":
    case "GENERATOR_TICK":
    case "ENERGY_NET_TICK":
    case "REMOVE_POWER_POLE":
      // cross-slice: no-op in isolated context
      // Power mutations require state.assets, state.selectedGeneratorId,
      // state.inventory, notifications and other fields outside the
      // power slice.
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const powerContext: BoundedContext<PowerContextState> = {
  reduce(state, action) {
    if (!isPowerAction(action)) return null;
    return reducePower(state, action);
  },
  handledActionTypes: POWER_HANDLED_ACTION_TYPES,
};
