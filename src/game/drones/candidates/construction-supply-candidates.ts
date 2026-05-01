import type {
  CollectableItemType,
  CollectionNode,
  DroneTaskType,
  GameState,
  StarterDroneState,
} from "../../store/types";
import type { DroneSelectionCandidate } from "./types";
import { buildScoredCandidate } from "./candidate-builder";

export type { DroneSelectionCandidate };

export interface ConstructionSupplyCandidateConstants {
  demandBonusMax: number;
  stickyBonus: number;
  spreadPenaltyPerDrone: number;
}

export interface ConstructionSupplyCandidateDeps {
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

export function gatherConstructionSupplyCandidates(
  state: Pick<
    GameState,
    "assets" | "constructionSites" | "collectionNodes" | "drones"
  >,
  drone: Pick<StarterDroneState, "droneId" | "tileX" | "tileY">,
  availableNodes: readonly CollectionNode[],
  availableTypes: ReadonlySet<CollectableItemType>,
  constructionRoleBonus: number,
  constants: ConstructionSupplyCandidateConstants,
  deps: ConstructionSupplyCandidateDeps,
): DroneSelectionCandidate[] {
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
    for (const [res, amt] of Object.entries(site.remaining)) {
      if ((amt ?? 0) <= 0) continue;
      const itemType = res as CollectableItemType;
      const remainingNeed = deps.getRemainingConstructionNeed(
        state,
        siteId,
        itemType,
        drone.droneId,
      );
      if (remainingNeed <= 0) continue;
      if (!availableTypes.has(itemType)) continue;
      const demandBonus = Math.min(constants.demandBonusMax, remainingNeed);
      for (const node of availableNodes) {
        if (node.itemType !== itemType) continue;
        const stickyBonus =
          node.reservedByDroneId === drone.droneId ? constants.stickyBonus : 0;
        const bonuses = {
          role: constructionRoleBonus,
          sticky: stickyBonus,
          demand: demandBonus,
          spread: spreadPenalty,
        };
        candidates.push(
          buildScoredCandidate(
            "construction_supply",
            node.id,
            siteId,
            deps.scoreDroneTask(
              "construction_supply",
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
    }
  }

  return candidates;
}
