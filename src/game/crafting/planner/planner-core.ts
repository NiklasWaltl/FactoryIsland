import type { WarehouseId } from "../../items/types";
import { getWorkbenchRecipe } from "../../simulation/recipes";
import type { Inventory, ServiceHubEntry } from "../../store/types";
import type { RecipeId } from "../types";
import type { AutoCraftPlanError, BuildAutoCraftPlanInput } from "./planner";
import { createError } from "./planner-error-shaping";
import {
  getOutputWarehouseId,
  seedExistingJobOutputs,
} from "./planner-output-forecast";
import { planRecipeRecursive } from "./planner-recursion";
import type { PlannerState } from "./planner-types";

export function cloneWarehouseInventories(
  input: Readonly<Record<WarehouseId, Inventory>>,
): Record<WarehouseId, Inventory> {
  const out: Record<WarehouseId, Inventory> = {};
  for (const [warehouseId, inv] of Object.entries(input)) {
    out[warehouseId as WarehouseId] = { ...inv };
  }
  return out;
}

export function cloneServiceHubs(
  input: Readonly<Record<string, ServiceHubEntry>>,
): Record<string, ServiceHubEntry> {
  const out: Record<string, ServiceHubEntry> = {};
  for (const [hubId, hub] of Object.entries(input)) {
    out[hubId] = {
      ...hub,
      inventory: { ...hub.inventory },
      targetStock: { ...hub.targetStock },
      droneIds: [...hub.droneIds],
    };
  }
  return out;
}

export function buildAutoCraftPlanCore(input: BuildAutoCraftPlanInput): {
  stepsInOrder: RecipeId[];
  stepCounts: Map<RecipeId, number>;
  error: AutoCraftPlanError | null;
} {
  const targetAmount = Math.max(1, Math.floor(input.amount ?? 1));
  const recipe = getWorkbenchRecipe(input.recipeId);
  if (!recipe) {
    return {
      stepsInOrder: [],
      stepCounts: new Map(),
      error: createError(
        "UNKNOWN_RECIPE",
        `Rezept ${input.recipeId} wurde nicht gefunden.`,
        {
          recipeId: input.recipeId,
        },
      ),
    };
  }

  if (input.source.kind === "global") {
    return {
      stepsInOrder: [],
      stepCounts: new Map(),
      error: createError(
        "NO_PHYSICAL_SOURCE",
        "Workbench braucht eine physische Quelle (Lagerhaus/Zone) für Auto-Craft.",
        { recipeId: input.recipeId },
      ),
    };
  }

  const clonedWarehouses = cloneWarehouseInventories(
    input.warehouseInventories,
  );
  const outputWarehouseId = getOutputWarehouseId(
    input.source,
    clonedWarehouses,
    input.assets,
    input.producerAssetId,
  );
  if (!outputWarehouseId) {
    return {
      stepsInOrder: [],
      stepCounts: new Map(),
      error: createError(
        "NO_OUTPUT_DESTINATION",
        "Keine gültige Lagerhaus-Zielquelle für geplante Workbench-Ausgaben gefunden.",
        { recipeId: input.recipeId },
      ),
    };
  }

  const DEFAULT_MAX_DEPTH = 12;
  const planner: PlannerState = {
    source: input.source,
    assets: input.assets,
    producerAssetId: input.producerAssetId,
    network: input.network,
    maxDepth: Math.max(1, Math.floor(input.maxDepth ?? DEFAULT_MAX_DEPTH)),
    canUseRecipe: input.canUseRecipe,
    stepsInOrder: [],
    stepCounts: new Map<RecipeId, number>(),
    recursionPath: [],
    outputWarehouseId,
    warehouseInventories: clonedWarehouses,
    serviceHubs: cloneServiceHubs(input.serviceHubs),
  };

  seedExistingJobOutputs(planner, input.existingJobs);

  const error = planRecipeRecursive(planner, recipe.key, targetAmount, 0);
  return {
    stepsInOrder: planner.stepsInOrder,
    stepCounts: planner.stepCounts,
    error,
  };
}
