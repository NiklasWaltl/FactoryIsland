import { isKnownItemId } from "../../items/registry";
import type { ItemId, WarehouseId } from "../../items/types";
import type { WorkbenchRecipe } from "../../simulation/recipes";
import type { Inventory, PlacedAsset } from "../../store/types";
import { pickOutputWarehouseId } from "../output";
import type { CraftingInventorySource, CraftingJob, RecipeId } from "../types";
import type { NonGlobalSource, PlannerState } from "./planner-types";

// R1: only count jobs whose inputs are ALREADY locked (reserved/crafting/delivering)
// as guaranteed future output. `queued` jobs have no reservation yet, so neither
// their inputs nor their outputs may be assumed by the planner — otherwise we
// would credit phantom stock that the queued job is not yet committed to produce.
type ActiveJobStatus = "reserved" | "crafting" | "delivering";

export function getOutputWarehouseId(
  source: NonGlobalSource,
  warehouseInventories: Readonly<Record<WarehouseId, Inventory>>,
  assets: Readonly<Record<string, PlacedAsset>>,
  producerAssetId?: string,
): WarehouseId | null {
  // G2: delegate to the shared helper used by the live `routeOutput` so the
  // planner forecasts the same destination warehouse the tick will deposit to.
  return pickOutputWarehouseId(source, warehouseInventories, {
    assets,
    preferredFromAssetId: producerAssetId,
  });
}

function isSameSource(
  left: CraftingInventorySource,
  right: NonGlobalSource,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "warehouse" && right.kind === "warehouse") {
    return left.warehouseId === right.warehouseId;
  }
  if (left.kind === "zone" && right.kind === "zone") {
    if (left.zoneId !== right.zoneId) return false;
    if (left.warehouseIds.length !== right.warehouseIds.length) return false;
    const a = [...left.warehouseIds].sort();
    const b = [...right.warehouseIds].sort();
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  return false;
}

function getActivePlannedJobStatuses(): ReadonlySet<ActiveJobStatus> {
  return new Set<ActiveJobStatus>(["reserved", "crafting", "delivering"]);
}

export function seedExistingJobOutputs(
  planner: PlannerState,
  jobs: readonly CraftingJob[] | undefined,
): void {
  if (!jobs || jobs.length === 0) return;
  const activeStatuses = getActivePlannedJobStatuses();
  for (const job of jobs) {
    if (!activeStatuses.has(job.status as ActiveJobStatus)) continue;
    if (!isSameSource(job.inventorySource, planner.source)) continue;
    addWarehouseStock(
      planner,
      planner.outputWarehouseId,
      job.output.itemId,
      job.output.count,
    );
  }
}

function addWarehouseStock(
  planner: PlannerState,
  warehouseId: WarehouseId,
  itemId: ItemId,
  amount: number,
): void {
  if (amount <= 0) return;
  const current =
    planner.warehouseInventories[warehouseId] ?? ({} as Inventory);
  const rec = current as unknown as Record<string, number>;
  planner.warehouseInventories[warehouseId] = {
    ...current,
    [itemId]: (rec[itemId] ?? 0) + amount,
  };
}

export function pushStep(
  planner: PlannerState,
  recipeId: RecipeId,
  count: number,
): void {
  if (count <= 0) return;
  if (!planner.stepCounts.has(recipeId)) {
    planner.stepsInOrder.push(recipeId);
  }
  planner.stepCounts.set(
    recipeId,
    (planner.stepCounts.get(recipeId) ?? 0) + count,
  );
}

export function addRecipeOutput(
  planner: PlannerState,
  recipe: WorkbenchRecipe,
  count: number,
): void {
  const amount = recipe.outputAmount * count;
  if (!isKnownItemId(recipe.outputItem)) return;
  addWarehouseStock(
    planner,
    planner.outputWarehouseId,
    recipe.outputItem,
    amount,
  );
}