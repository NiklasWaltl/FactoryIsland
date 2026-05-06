import type {
  CollectionNode,
  CollectableItemType,
  DroneTaskType,
  GameState,
  StarterDroneState,
} from "../../store/types";
import type { DroneSelectionCandidate } from "./types";
import { buildScoredCandidate } from "./candidate-builder";

export interface HubRestockCandidateConstants {
  stickyBonus: number;
  urgencyBonusMax: number;
}

export interface HubRestockCandidateDeps {
  getRemainingHubRestockNeed: (
    state: Pick<
      GameState,
      "drones" | "collectionNodes" | "serviceHubs" | "constructionSites"
    >,
    hubId: string,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => number;
  getOpenHubRestockDroneSlots: (
    state: Pick<
      GameState,
      "drones" | "collectionNodes" | "serviceHubs" | "constructionSites"
    >,
    hubId: string,
    itemType: CollectableItemType,
    excludeDroneId?: string,
  ) => number;
  scoreDroneTask: (
    taskType: DroneTaskType,
    droneX: number,
    droneY: number,
    nodeX: number,
    nodeY: number,
    bonuses?: {
      role?: number;
      sticky?: number;
      urgency?: number;
      demand?: number;
      spread?: number;
    },
  ) => number;
}

export function gatherHubRestockCandidates(
  state: Pick<
    GameState,
    "drones" | "collectionNodes" | "serviceHubs" | "constructionSites"
  >,
  drone: Pick<StarterDroneState, "droneId" | "tileX" | "tileY">,
  hubId: string,
  availableNodes: readonly CollectionNode[],
  constants: HubRestockCandidateConstants,
  deps: HubRestockCandidateDeps,
): DroneSelectionCandidate[] {
  const candidates: DroneSelectionCandidate[] = [];

  for (const node of availableNodes) {
    const remainingNeed = deps.getRemainingHubRestockNeed(
      state,
      hubId,
      node.itemType,
      drone.droneId,
    );
    const openSlots = deps.getOpenHubRestockDroneSlots(
      state,
      hubId,
      node.itemType,
      drone.droneId,
    );
    if (remainingNeed <= 0 || openSlots <= 0) continue;
    const stickyBonus =
      node.reservedByDroneId === drone.droneId ? constants.stickyBonus : 0;
    const urgencyBonus = Math.min(constants.urgencyBonusMax, remainingNeed);
    const bonuses = {
      sticky: stickyBonus,
      urgency: urgencyBonus,
    };
    candidates.push(
      buildScoredCandidate(
        "hub_restock",
        node.id,
        hubId,
        deps.scoreDroneTask(
          "hub_restock",
          drone.tileX,
          drone.tileY,
          node.tileX,
          node.tileY,
          bonuses,
        ),
        bonuses,
      ),
    );
  }

  return candidates;
}
