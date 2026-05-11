import {
  getSplitterFilter,
  setSplitterFilter,
} from "../slices/splitter-filter-state";
import type { GameAction } from "../game-actions";
import type { BoundedContext, ConveyorContextState } from "./types";

export const CONVEYOR_HANDLED_ACTION_TYPES = [
  "SET_SPLITTER_FILTER",
  "LOGISTICS_TICK",
] as const satisfies readonly GameAction["type"][];

type ConveyorActionType = (typeof CONVEYOR_HANDLED_ACTION_TYPES)[number];
type ConveyorAction = Extract<GameAction, { type: ConveyorActionType }>;

const CONVEYOR_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  CONVEYOR_HANDLED_ACTION_TYPES,
);

function isConveyorAction(action: GameAction): action is ConveyorAction {
  return CONVEYOR_ACTION_TYPE_SET.has(action.type);
}

function reduceConveyor(
  state: ConveyorContextState,
  action: ConveyorAction,
): ConveyorContextState {
  const actionType = action.type;

  switch (actionType) {
    case "SET_SPLITTER_FILTER": {
      if (
        getSplitterFilter(
          state.splitterFilterState,
          action.splitterId,
          action.side,
        ) === action.itemType
      ) {
        return state;
      }
      return {
        ...state,
        splitterFilterState: setSplitterFilter(
          state.splitterFilterState,
          action.splitterId,
          action.side,
          action.itemType,
        ),
      };
    }

    case "LOGISTICS_TICK":
      // cross-slice: no-op in isolated context
      // The conveyor phase of LOGISTICS_TICK reads state.assets, state.inventory
      // and state.network outside the conveyor slice.
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const conveyorContext: BoundedContext<ConveyorContextState> = {
  reduce(state, action) {
    if (!isConveyorAction(action)) return null;
    return reduceConveyor(state, action);
  },
  handledActionTypes: CONVEYOR_HANDLED_ACTION_TYPES,
};
