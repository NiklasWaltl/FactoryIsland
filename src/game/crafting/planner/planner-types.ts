import type { NetworkSlice } from "../../inventory/reservationTypes";
import type { WarehouseId } from "../../items/types";
import type {
  Inventory,
  PlacedAsset,
  ServiceHubEntry,
} from "../../store/types";
import type { RecipePolicyDecision } from "../policies/policies";
import type { CraftingInventorySource, RecipeId } from "../types";

export type NonGlobalSource = Exclude<
  CraftingInventorySource,
  { kind: "global" }
>;

export type MissingKind = "manual" | "craftable" | "unknown";

export interface PlannerState {
  readonly source: NonGlobalSource;
  readonly assets: Readonly<Record<string, PlacedAsset>>;
  readonly producerAssetId?: string;
  readonly network: NetworkSlice;
  readonly maxDepth: number;
  readonly canUseRecipe?: (recipeId: RecipeId) => RecipePolicyDecision;
  readonly stepsInOrder: RecipeId[];
  readonly stepCounts: Map<RecipeId, number>;
  readonly recursionPath: RecipeId[];
  readonly outputWarehouseId: WarehouseId;
  warehouseInventories: Record<WarehouseId, Inventory>;
  serviceHubs: Record<string, ServiceHubEntry>;
}
