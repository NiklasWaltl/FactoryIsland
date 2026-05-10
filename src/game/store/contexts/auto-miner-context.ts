import type { GameAction } from "../game-actions";
import type { AutoMinerContextState, BoundedContext } from "./types";

export const AUTO_MINER_HANDLED_ACTION_TYPES = [
  "LOGISTICS_TICK",
] as const satisfies readonly GameAction["type"][];

type AutoMinerActionType = (typeof AUTO_MINER_HANDLED_ACTION_TYPES)[number];
type AutoMinerAction = Extract<GameAction, { type: AutoMinerActionType }>;

function isAutoMinerAction(action: GameAction): action is AutoMinerAction {
  return (AUTO_MINER_HANDLED_ACTION_TYPES as readonly string[]).includes(
    action.type,
  );
}

function reduceAutoMiner(
  state: AutoMinerContextState,
  action: AutoMinerAction,
): AutoMinerContextState {
  const actionType = action.type;

  switch (actionType) {
    case "LOGISTICS_TICK":
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const autoMinerContext: BoundedContext<AutoMinerContextState> = {
  reduce(state, action) {
    if (!isAutoMinerAction(action)) return null;
    return reduceAutoMiner(state, action);
  },
  handledActionTypes: AUTO_MINER_HANDLED_ACTION_TYPES,
};
