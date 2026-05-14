import type { GameAction } from "../game-actions";
import type { AutoSmelterContextState, BoundedContext } from "./types";

export const AUTO_SMELTER_HANDLED_ACTION_TYPES = [
  "AUTO_SMELTER_SET_RECIPE",
] as const satisfies readonly GameAction["type"][];

type AutoSmelterActionType = (typeof AUTO_SMELTER_HANDLED_ACTION_TYPES)[number];
type AutoSmelterAction = Extract<GameAction, { type: AutoSmelterActionType }>;

const AUTO_SMELTER_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  AUTO_SMELTER_HANDLED_ACTION_TYPES,
);

function isAutoSmelterAction(action: GameAction): action is AutoSmelterAction {
  return AUTO_SMELTER_ACTION_TYPE_SET.has(action.type);
}

function reduceAutoSmelter(
  state: AutoSmelterContextState,
  action: AutoSmelterAction,
): AutoSmelterContextState {
  const actionType = action.type;

  switch (actionType) {
    case "AUTO_SMELTER_SET_RECIPE": {
      const smelter = state.autoSmelters[action.assetId];
      if (!smelter) return state;
      if (smelter.selectedRecipe === action.recipe) return state;
      return {
        ...state,
        autoSmelters: {
          ...state.autoSmelters,
          [action.assetId]: { ...smelter, selectedRecipe: action.recipe },
        },
      };
    }

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const autoSmelterContext: BoundedContext<AutoSmelterContextState> = {
  reduce(state, action) {
    if (!isAutoSmelterAction(action)) return null;
    return reduceAutoSmelter(state, action);
  },
  handledActionTypes: AUTO_SMELTER_HANDLED_ACTION_TYPES,
};
