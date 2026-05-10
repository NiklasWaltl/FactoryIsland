import type { GameAction } from "../game-actions";
import type { DroneContextState, BoundedContext } from "./types";

export const DRONES_HANDLED_ACTION_TYPES = [
  "DRONE_TICK",
  "DRONE_SET_ROLE",
  "ASSIGN_DRONE_TO_HUB",
] as const satisfies readonly GameAction["type"][];

type DronesActionType = (typeof DRONES_HANDLED_ACTION_TYPES)[number];
type DronesAction = Extract<GameAction, { type: DronesActionType }>;

const DRONES_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  DRONES_HANDLED_ACTION_TYPES,
);

function isDronesAction(action: GameAction): action is DronesAction {
  return DRONES_ACTION_TYPE_SET.has(action.type);
}

function reduceDrones(
  state: DroneContextState,
  action: DronesAction,
): DroneContextState {
  const actionType = action.type;

  switch (actionType) {
    case "DRONE_TICK":
      return state;

    case "DRONE_SET_ROLE": {
      const target = state.drones[action.droneId];
      if (!target) return state;
      return {
        ...state,
        drones: {
          ...state.drones,
          [action.droneId]: { ...target, role: action.role },
        },
      };
    }

    case "ASSIGN_DRONE_TO_HUB":
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const dronesContext: BoundedContext<DroneContextState> = {
  reduce(state, action) {
    if (!isDronesAction(action)) return null;
    return reduceDrones(state, action);
  },
  handledActionTypes: DRONES_HANDLED_ACTION_TYPES,
};
