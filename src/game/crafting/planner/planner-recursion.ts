import { getItemDef, isKnownItemId } from "../../items/registry";
import type { ItemId } from "../../items/types";
import {
  MANUAL_ASSEMBLER_RECIPES,
  SMELTING_RECIPES,
  WORKBENCH_RECIPES,
  getWorkbenchRecipe,
  type WorkbenchRecipe,
} from "../../simulation/recipes";
import type { RecipeId } from "../types";
import type { AutoCraftPlanError } from "./planner";
import {
  consumeIngredientIfAvailable,
  getWarehouseLaneAvailability,
} from "./planner-availability";
import { createError, getRecipeLabel } from "./planner-error-shaping";
import { addRecipeOutput, pushStep } from "./planner-output-forecast";
import type { MissingKind, PlannerState } from "./planner-types";

function classifyMissingItem(itemId: ItemId): MissingKind {
  const def = getItemDef(itemId);
  if (def?.category === "raw_resource") return "manual";
  if (isItemCraftableByAnyRecipe(itemId)) return "craftable";
  return "unknown";
}

function isItemCraftableByAnyRecipe(itemId: ItemId): boolean {
  for (const recipe of WORKBENCH_RECIPES)
    if (recipe.outputItem === itemId) return true;
  for (const recipe of SMELTING_RECIPES)
    if (recipe.outputItem === itemId) return true;
  for (const recipe of MANUAL_ASSEMBLER_RECIPES)
    if (recipe.outputItem === itemId) return true;
  return false;
}

function findWorkbenchRecipeByOutputItem(
  itemId: ItemId,
): WorkbenchRecipe | null {
  return (
    WORKBENCH_RECIPES.find((recipe) => recipe.outputItem === itemId) ?? null
  );
}

export function planRecipeRecursive(
  planner: PlannerState,
  recipeId: RecipeId,
  crafts: number,
  depth: number,
): AutoCraftPlanError | null {
  if (crafts <= 0) return null;

  if (depth > planner.maxDepth) {
    return createError(
      "MAX_DEPTH",
      `Auto-Craft-Plan zu tief (>${planner.maxDepth}) für Rezept ${getRecipeLabel(recipeId)}.`,
      {
        recipeId,
        path: [...planner.recursionPath],
      },
    );
  }

  if (planner.recursionPath.includes(recipeId)) {
    return createError(
      "RECIPE_CYCLE",
      `Rezeptzyklus erkannt: ${[...planner.recursionPath, recipeId].join(" -> ")}`,
      {
        recipeId,
        path: [...planner.recursionPath, recipeId],
      },
    );
  }

  const recipe = getWorkbenchRecipe(recipeId);
  if (!recipe) {
    return createError(
      "UNKNOWN_RECIPE",
      `Rezept ${recipeId} wurde nicht gefunden.`,
      {
        recipeId,
      },
    );
  }

  const policyDecision = planner.canUseRecipe?.(recipe.key);
  if (policyDecision && !policyDecision.allowed) {
    return createError(
      "POLICY_BLOCKED",
      policyDecision.reason ??
        `Rezept ${recipe.label} ist per Policy fuer Automation gesperrt.`,
      {
        recipeId,
      },
    );
  }

  planner.recursionPath.push(recipeId);

  for (const [ingredientKey, rawCost] of Object.entries(recipe.costs)) {
    const unitCost = typeof rawCost === "number" ? rawCost : 0;
    if (unitCost <= 0) continue;
    if (!isKnownItemId(ingredientKey)) {
      planner.recursionPath.pop();
      return createError(
        "MISSING_UNKNOWN",
        `Unbekannte Zutat ${ingredientKey} in ${recipe.label}.`,
        {
          recipeId,
        },
      );
    }

    const ingredientId = ingredientKey as ItemId;
    const required = unitCost * crafts;
    if (required <= 0) continue;

    const immediate = consumeIngredientIfAvailable(
      planner,
      ingredientId,
      required,
    );
    if (immediate.ok) {
      continue;
    }

    const lane = getWarehouseLaneAvailability(
      planner,
      ingredientId,
      planner.outputWarehouseId,
    );
    const shortfall = Math.max(0, required - lane.free);
    const missingAmount = shortfall > 0 ? shortfall : required;
    const missingKind = classifyMissingItem(ingredientId);

    if (missingKind === "manual") {
      planner.recursionPath.pop();
      return createError(
        "MISSING_MANUAL",
        `${missingAmount}x ${getItemDef(ingredientId)?.displayName ?? ingredientId} müssen manuell beschafft werden.`,
        {
          recipeId,
          itemId: ingredientId,
          amount: missingAmount,
        },
      );
    }

    if (missingKind === "unknown") {
      planner.recursionPath.pop();
      return createError(
        "MISSING_UNKNOWN",
        `Für ${getItemDef(ingredientId)?.displayName ?? ingredientId} existiert kein bekanntes Rezept.`,
        {
          recipeId,
          itemId: ingredientId,
          amount: missingAmount,
        },
      );
    }

    const subRecipe = findWorkbenchRecipeByOutputItem(ingredientId);
    if (!subRecipe) {
      planner.recursionPath.pop();
      return createError(
        "MISSING_CRAFTABLE_OFF_WORKBENCH",
        `${getItemDef(ingredientId)?.displayName ?? ingredientId} ist craftbar, aber nicht über die Workbench-Queue (MVP).`,
        {
          recipeId,
          itemId: ingredientId,
          amount: missingAmount,
        },
      );
    }

    const subCrafts = Math.ceil(
      missingAmount / Math.max(1, subRecipe.outputAmount),
    );
    const subError = planRecipeRecursive(
      planner,
      subRecipe.key,
      subCrafts,
      depth + 1,
    );
    if (subError) {
      planner.recursionPath.pop();
      return subError;
    }

    const retry = consumeIngredientIfAvailable(planner, ingredientId, required);
    if (!retry.ok) {
      planner.recursionPath.pop();
      return createError(
        "UNRESOLVABLE_INGREDIENT",
        `${getItemDef(ingredientId)?.displayName ?? ingredientId} bleibt trotz Vorprodukt-Planung unzureichend verfügbar.`,
        {
          recipeId,
          itemId: ingredientId,
          amount: required,
        },
      );
    }
  }

  pushStep(planner, recipeId, crafts);
  addRecipeOutput(planner, recipe, crafts);
  planner.recursionPath.pop();
  return null;
}