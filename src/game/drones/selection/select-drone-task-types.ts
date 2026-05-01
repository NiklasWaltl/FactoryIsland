import type { CraftingJob } from "../../crafting/types";
import type { CollectableItemType, GameState } from "../../store/types";

export interface NearbyWarehouseDispatchCandidate {
  readonly warehouseId: string;
  readonly x: number;
  readonly y: number;
  readonly available: number;
  readonly distance: number;
}

export interface SelectDroneTaskDeps {
  getAvailableHubDispatchSupply: (
    state: Pick<GameState, "drones" | "serviceHubs" | "constructionSites">,
    hubId: string,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => number;
  getNearbyWarehousesForDispatch: (
    state: GameState,
    fromX: number,
    fromY: number,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => NearbyWarehouseDispatchCandidate[];
  getBuildingInputTargets: (
    state: Pick<GameState, "assets">,
  ) => { assetId: string; resource: CollectableItemType; capacity: number }[];
  isUnderConstruction: (
    state: Pick<GameState, "constructionSites">,
    assetId: string,
  ) => boolean;
  hasCompleteWorkbenchInput: (job: CraftingJob) => boolean;
  isCollectableCraftingItem: (
    itemId: CraftingJob["ingredients"][number]["itemId"],
  ) => itemId is CollectableItemType;
  resolveWorkbenchInputPickup: (
    state: Pick<
      GameState,
      "assets" | "warehouseInventories" | "serviceHubs" | "network"
    >,
    job: CraftingJob,
    reservation: {
      id: string;
      itemId: CraftingJob["ingredients"][number]["itemId"];
      amount: number;
    },
  ) => {
    x: number;
    y: number;
    sourceKind: "warehouse" | "hub";
    sourceId: string;
  } | null;
}
