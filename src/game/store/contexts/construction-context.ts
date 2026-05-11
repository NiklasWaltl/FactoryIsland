import type { GameAction } from "../game-actions";
import type { BoundedContext, ConstructionContextState } from "./types";

export const CONSTRUCTION_HANDLED_ACTION_TYPES = [
  "BUILD_PLACE_BUILDING",
  "BUILD_PLACE_FLOOR_TILE",
  "BUILD_REMOVE_ASSET",
  "REQUEST_DECONSTRUCT_ASSET",
  "CANCEL_DECONSTRUCT_ASSET",
  "REMOVE_BUILDING",
  "UPGRADE_HUB",
  "LOGISTICS_TICK",
] as const satisfies readonly GameAction["type"][];

type ConstructionActionType =
  (typeof CONSTRUCTION_HANDLED_ACTION_TYPES)[number];
type ConstructionAction = Extract<GameAction, { type: ConstructionActionType }>;

const CONSTRUCTION_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  CONSTRUCTION_HANDLED_ACTION_TYPES,
);

function isConstructionAction(
  action: GameAction,
): action is ConstructionAction {
  return CONSTRUCTION_ACTION_TYPE_SET.has(action.type);
}

function reduceConstruction(
  state: ConstructionContextState,
  action: ConstructionAction,
): ConstructionContextState {
  const actionType = action.type;

  switch (actionType) {
    case "BUILD_PLACE_BUILDING":
    case "BUILD_PLACE_FLOOR_TILE":
    case "BUILD_REMOVE_ASSET":
    case "REQUEST_DECONSTRUCT_ASSET":
    case "CANCEL_DECONSTRUCT_ASSET":
    case "REMOVE_BUILDING":
    case "UPGRADE_HUB":
    case "LOGISTICS_TICK":
      // cross-slice: no-op in isolated context
      // Placement and removal need state.inventory, state.warehouseInventories,
      // state.serviceHubs, notifications and geometry validation; hub upgrade
      // mutates state.serviceHubs alongside constructionSites; LOGISTICS_TICK
      // advances construction sites through cross-slice drone delivery.
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const constructionContext: BoundedContext<ConstructionContextState> = {
  reduce(state, action) {
    if (!isConstructionAction(action)) return null;
    return reduceConstruction(state, action);
  },
  handledActionTypes: CONSTRUCTION_HANDLED_ACTION_TYPES,
};
