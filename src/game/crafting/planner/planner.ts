import type { ItemId, WarehouseId } from "../../items/types";
import type { NetworkSlice } from "../../inventory/reservationTypes";
import { getWorkbenchRecipe } from "../../simulation/recipes";
import type { PlacedAsset, ServiceHubEntry } from "../../store/types";
import type { CraftingInventorySource, CraftingJob, RecipeId } from "../types";
import type { RecipePolicyDecision } from "../policies/policies";
import type { Inventory } from "../../store/types";
import { buildAutoCraftPlanCore } from "./planner-core";

export interface AutoCraftPlanStep {
  readonly recipeId: RecipeId;
  readonly count: number;
  readonly label: string;
}

export type AutoCraftPlanErrorKind =
  | "UNKNOWN_RECIPE"
  | "NO_PHYSICAL_SOURCE"
  | "NO_OUTPUT_DESTINATION"
  | "POLICY_BLOCKED"
  | "MISSING_MANUAL"
  | "MISSING_UNKNOWN"
  | "MISSING_CRAFTABLE_OFF_WORKBENCH"
  | "RECIPE_CYCLE"
  | "MAX_DEPTH"
  | "UNRESOLVABLE_INGREDIENT";

export interface AutoCraftPlanError {
  readonly kind: AutoCraftPlanErrorKind;
  readonly message: string;
  readonly recipeId?: RecipeId;
  readonly itemId?: ItemId;
  readonly amount?: number;
  readonly path?: readonly RecipeId[];
}

export type AutoCraftPlanResult =
  | {
      readonly ok: true;
      readonly steps: readonly AutoCraftPlanStep[];
    }
  | {
      readonly ok: false;
      readonly error: AutoCraftPlanError;
    };

export interface BuildAutoCraftPlanInput {
  readonly recipeId: RecipeId;
  readonly amount?: number;
  readonly producerAssetId?: string;
  readonly source: CraftingInventorySource;
  readonly warehouseInventories: Readonly<Record<WarehouseId, Inventory>>;
  readonly serviceHubs: Readonly<Record<string, ServiceHubEntry>>;
  readonly network: NetworkSlice;
  readonly assets: Readonly<Record<string, PlacedAsset>>;
  readonly existingJobs?: readonly CraftingJob[];
  readonly canUseRecipe?: (recipeId: RecipeId) => RecipePolicyDecision;
  readonly maxDepth?: number;
}

function getRecipeLabel(recipeId: RecipeId): string {
  return getWorkbenchRecipe(recipeId)?.label ?? recipeId;
}

export function buildAutoCraftPlan(
  input: BuildAutoCraftPlanInput,
): AutoCraftPlanResult {
  const { stepsInOrder, stepCounts, error } = buildAutoCraftPlanCore(input);
  if (error) {
    return { ok: false, error };
  }

  const steps: AutoCraftPlanStep[] = stepsInOrder.map((recipeId) => ({
    recipeId,
    count: stepCounts.get(recipeId) ?? 0,
    label: getRecipeLabel(recipeId),
  }));

  return {
    ok: true,
    steps: steps.filter((step) => step.count > 0),
  };
}

export function buildWorkbenchAutoCraftPlan(
  input: BuildAutoCraftPlanInput,
): AutoCraftPlanResult {
  return buildAutoCraftPlan(input);
}
