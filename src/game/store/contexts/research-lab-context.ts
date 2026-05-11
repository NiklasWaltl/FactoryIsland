import type { GameAction } from "../game-actions";
import type { ResearchLabContextState, BoundedContext } from "./types";

export const RESEARCH_LAB_HANDLED_ACTION_TYPES = [
  "RESEARCH_BUILDING",
] as const satisfies readonly GameAction["type"][];

type ResearchLabActionType = (typeof RESEARCH_LAB_HANDLED_ACTION_TYPES)[number];
type ResearchLabAction = Extract<GameAction, { type: ResearchLabActionType }>;

const RESEARCH_LAB_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  RESEARCH_LAB_HANDLED_ACTION_TYPES,
);

function isResearchLabAction(action: GameAction): action is ResearchLabAction {
  return RESEARCH_LAB_ACTION_TYPE_SET.has(action.type);
}

function reduceResearchLab(
  state: ResearchLabContextState,
  action: ResearchLabAction,
): ResearchLabContextState {
  const actionType = action.type;

  switch (actionType) {
    case "RESEARCH_BUILDING":
      // cross-slice: no-op in isolated context
      // Resolution requires inventory validation + notification side effects
      // which live outside the research-lab slice.
      return state;

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const researchLabContext: BoundedContext<ResearchLabContextState> = {
  reduce(state, action) {
    if (!isResearchLabAction(action)) return null;
    return reduceResearchLab(state, action);
  },
  handledActionTypes: RESEARCH_LAB_HANDLED_ACTION_TYPES,
};
