import type {
  CollectableItemType,
  DroneTaskType,
  GameState,
  StarterDroneState,
} from "../../store/types";
import type { DroneSelectionCandidate } from "./types";
import { buildScoredCandidate } from "./candidate-builder";

export interface HubDispatchCandidateConstants {
  demandBonusMax: number;
  stickyBonus: number;
  spreadPenaltyPerDrone: number;
}

export interface HubDispatchCandidateDeps {
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
  getAvailableHubDispatchSupply: (
    state: Pick<GameState, "drones" | "serviceHubs" | "constructionSites">,
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

export function gatherHubDispatchCandidates(
  state: GameState,
  drone: Pick<
    StarterDroneState,
    "droneId" | "hubId" | "tileX" | "tileY" | "targetNodeId"
  >,
  constants: HubDispatchCandidateConstants,
  deps: HubDispatchCandidateDeps,
): DroneSelectionCandidate[] {
  if (!drone.hubId) return [];

  const hubAsset = state.assets[drone.hubId];
  if (!hubAsset) return [];

  const candidates: DroneSelectionCandidate[] = [];

  for (const [siteId, site] of Object.entries(state.constructionSites)) {
    if (!state.assets[siteId]) continue;
    const openSlots = deps.getOpenConstructionDroneSlots(
      state,
      siteId,
      drone.droneId,
    );
    if (openSlots <= 0) continue;
    const assignedSoFar = deps.getAssignedConstructionDroneCount(
      state,
      siteId,
      drone.droneId,
    );
    const spreadPenalty = -constants.spreadPenaltyPerDrone * assignedSoFar;
    for (const [resource, amount] of Object.entries(site.remaining)) {
      if ((amount ?? 0) <= 0) continue;
      const itemType = resource as CollectableItemType;
      const remainingNeed = deps.getRemainingConstructionNeed(
        state,
        siteId,
        itemType,
        drone.droneId,
      );
      const availableHubSupply = deps.getAvailableHubDispatchSupply(
        state,
        drone.droneId ? drone.hubId : "",
        itemType,
        drone.droneId,
      );
      if (remainingNeed <= 0 || availableHubSupply <= 0) continue;
      const demandBonus = Math.min(constants.demandBonusMax, remainingNeed);
      const syntheticNodeId = `hub:${drone.hubId}:${itemType}`;
      const stickyBonus =
        drone.targetNodeId === syntheticNodeId ? constants.stickyBonus : 0;
      const bonuses = {
        sticky: stickyBonus,
        demand: demandBonus,
        spread: spreadPenalty,
      };
      candidates.push(
        buildScoredCandidate(
          "hub_dispatch",
          syntheticNodeId,
          siteId,
          deps.scoreDroneTask(
            "hub_dispatch",
            drone.tileX,
            drone.tileY,
            hubAsset.x,
            hubAsset.y,
            bonuses,
          ),
          bonuses,
        ),
      );
    }
  }

  return candidates;
}
