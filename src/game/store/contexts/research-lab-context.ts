import type { GameAction } from "../game-actions";
import type { GameNotification } from "../types";
import { getResearchRecipe } from "../../simulation/recipes/research-recipes";
import { BUILDING_LABELS } from "../constants/buildings/index";
import { hasResources } from "../inventory-ops";
import { consumeResources } from "../helpers/reducer-helpers";
import { addErrorNotification } from "../utils/notifications";
import { makeId } from "../utils/make-id";
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

// Mirrors the legacy handler in action-handlers/research.ts:25-44. The success
// notification is custom (kind: "success", 4000ms TTL, bounded -5 ringbuffer)
// and does not go through addNotification because that helper merges by
// `resource` key and would collapse repeated unlocks into one entry.
function addResearchSuccessNotification(
  notifications: GameNotification[],
  label: string,
): GameNotification[] {
  const message = `${label} freigeschaltet`;
  const now = Date.now();
  const trimmed = notifications.slice(-5);
  return [
    ...trimmed,
    {
      id: makeId(),
      resource: "research_unlock",
      displayName: message,
      amount: 1,
      kind: "success" as const,
      expiresAt: now + 4000,
    },
  ];
}

function reduceResearchLab(
  state: ResearchLabContextState,
  action: ResearchLabAction,
): ResearchLabContextState {
  const actionType = action.type;

  switch (actionType) {
    case "RESEARCH_BUILDING": {
      const recipe = getResearchRecipe(action.recipeId);
      if (!recipe) {
        return {
          ...state,
          notifications: addErrorNotification(
            state.notifications,
            `Unbekanntes Forschungsrezept: ${action.recipeId}`,
          ),
        };
      }

      const label = BUILDING_LABELS[recipe.buildingType];

      if (state.unlockedBuildings.includes(recipe.buildingType)) {
        return {
          ...state,
          notifications: addErrorNotification(
            state.notifications,
            `${label} ist bereits freigeschaltet`,
          ),
        };
      }

      if (!hasResources(state.inventory, recipe.cost)) {
        return {
          ...state,
          notifications: addErrorNotification(
            state.notifications,
            `Nicht genug Ressourcen für ${label}`,
          ),
        };
      }

      return {
        ...state,
        inventory: consumeResources(state.inventory, recipe.cost),
        unlockedBuildings: [...state.unlockedBuildings, recipe.buildingType],
        notifications: addResearchSuccessNotification(
          state.notifications,
          label,
        ),
      };
    }

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
