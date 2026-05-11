import type { GameAction } from "../game-actions";
import type { AutoAssemblerContextState, BoundedContext } from "./types";

export const AUTO_ASSEMBLER_HANDLED_ACTION_TYPES = [
  "AUTO_ASSEMBLER_SET_RECIPE",
  "LOGISTICS_TICK",
] as const satisfies readonly GameAction["type"][];

type AutoAssemblerActionType =
  (typeof AUTO_ASSEMBLER_HANDLED_ACTION_TYPES)[number];
type AutoAssemblerAction = Extract<
  GameAction,
  { type: AutoAssemblerActionType }
>;

const AUTO_ASSEMBLER_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  AUTO_ASSEMBLER_HANDLED_ACTION_TYPES,
);

function isAutoAssemblerAction(
  action: GameAction,
): action is AutoAssemblerAction {
  return AUTO_ASSEMBLER_ACTION_TYPE_SET.has(action.type);
}

function reduceAutoAssembler(
  state: AutoAssemblerContextState,
  action: AutoAssemblerAction,
): AutoAssemblerContextState {
  const actionType = action.type;

  switch (actionType) {
    case "AUTO_ASSEMBLER_SET_RECIPE": {
      const entry = state.autoAssemblers[action.assetId];
      if (!entry) return state;

      const canSwitch =
        entry.ironIngotBuffer === 0 &&
        !entry.processing &&
        entry.pendingOutput.length === 0;

      if (!canSwitch) return state;
      if (entry.selectedRecipe === action.recipe) return state;

      return {
        ...state,
        autoAssemblers: {
          ...state.autoAssemblers,
          [action.assetId]: { ...entry, selectedRecipe: action.recipe },
        },
      };
    }

    case "LOGISTICS_TICK":
      // cross-slice: no-op in isolated context
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const autoAssemblerContext: BoundedContext<AutoAssemblerContextState> = {
  reduce(state, action) {
    if (!isAutoAssemblerAction(action)) return null;
    return reduceAutoAssembler(state, action);
  },
  handledActionTypes: AUTO_ASSEMBLER_HANDLED_ACTION_TYPES,
};
