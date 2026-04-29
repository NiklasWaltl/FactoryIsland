import type { CraftingJob } from "../../../crafting/types";
import type {
  CollectableItemType,
  GameState,
} from "../../../store/types";

export interface NeedSlotResolverDeps {
  getOpenConstructionDroneSlots: (
    state: Pick<GameState, "drones" | "constructionSites">,
    siteId: string,
    excludeDroneId?: string,
  ) => number;
  getAssignedConstructionDroneCount: (
    state: Pick<GameState, "drones">,
    siteId: string,
    excludeDroneId?: string,
  ) => number;
  getRemainingConstructionNeed: (
    state: Pick<GameState, "drones" | "collectionNodes" | "constructionSites">,
    siteId: string,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => number;
  getRemainingHubRestockNeed: (
    state: Pick<GameState, "drones" | "collectionNodes" | "serviceHubs" | "constructionSites">,
    hubId: string,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => number;
  getOpenHubRestockDroneSlots: (
    state: Pick<GameState, "drones" | "collectionNodes" | "serviceHubs" | "constructionSites">,
    hubId: string,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => number;
  getRemainingBuildingInputDemand: (
    state: Pick<GameState, "assets" | "generators" | "drones" | "collectionNodes">,
    assetId: string,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => number;
  getOpenBuildingSupplyDroneSlots: (
    state: Pick<GameState, "assets" | "generators" | "drones">,
    assetId: string,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => number;
  getAssignedBuildingSupplyDroneCount: (
    state: Pick<GameState, "drones">,
    assetId: string,
    excludeDroneId?: string,
  ) => number;
  getWorkbenchJobInputAmount: (
    job: CraftingJob,
    itemId: CraftingJob["ingredients"][number]["itemId"],
  ) => number;
  getAssignedWorkbenchInputDroneCount: (
    state: Pick<GameState, "drones">,
    reservationId: string,
    excludeDroneId?: string,
  ) => number;
  getAssignedWorkbenchDeliveryDroneCount: (
    state: Pick<GameState, "drones">,
    jobId: string,
    excludeDroneId?: string,
  ) => number;
}
