// ============================================================
// Research Lab — handle RESEARCH_BUILDING action.
// ------------------------------------------------------------
// Item-based, instant-research counterpart of the removed
// BUY_BUILDING_UNLOCK action. Looks up the recipe, validates
// item stock, consumes the cost from the global inventory and
// appends the unlocked BuildingType to state.unlockedBuildings.
//
// Idempotent: re-researching an already-unlocked building is a
// no-op (no resource drain, error notification surfaces it).
// ============================================================

import type { GameAction } from "../game-actions";
import type { GameNotification, GameState } from "../types";
import {
  RESEARCH_RECIPES,
  getResearchRecipe,
} from "../../simulation/recipes/research-recipes";
import { BUILDING_LABELS } from "../constants/buildings/index";
import { hasResources } from "../inventory-ops";
import { consumeResources } from "../helpers/reducer-helpers";
import { addErrorNotification } from "../utils/notifications";
import { makeId } from "../utils/make-id";

function addResearchSuccessNotification(
  notifications: GameNotification[],
  label: string,
): GameNotification[] {
  const message = `${label} freigeschaltet`;
  const now = Date.now();
  // Keep only the last few entries to mirror addNotification's bounded buffer.
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

export function handleResearchAction(
  state: GameState,
  action: GameAction,
): GameState | null {
  if (action.type !== "RESEARCH_BUILDING") return null;

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

  const inventoryAfter = consumeResources(state.inventory, recipe.cost);

  return {
    ...state,
    inventory: inventoryAfter,
    unlockedBuildings: [...state.unlockedBuildings, recipe.buildingType],
    notifications: addResearchSuccessNotification(state.notifications, label),
  };
}

// Re-export for ergonomic test imports.
export { RESEARCH_RECIPES };
