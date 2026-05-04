import { getWorkbenchRecipe } from "../../simulation/recipes";
import type { RecipeId } from "../types";
import type {
  AutoCraftPlanError,
  AutoCraftPlanErrorKind,
} from "./planner";

export function getRecipeLabel(recipeId: RecipeId): string {
  return getWorkbenchRecipe(recipeId)?.label ?? recipeId;
}

export function createError(
  kind: AutoCraftPlanErrorKind,
  message: string,
  fields?: Omit<AutoCraftPlanError, "kind" | "message">,
): AutoCraftPlanError {
  return {
    kind,
    message,
    ...fields,
  };
}