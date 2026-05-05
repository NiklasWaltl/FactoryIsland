import type {
  DroneTaskType,
  GameState,
  StarterDroneState,
} from "../../store/types";
import type { DroneSelectionCandidate } from "./types";
import { buildScoredCandidate } from "./candidate-builder";

export interface DeconstructCandidateConstants {
  stickyBonus: number;
}

export interface DeconstructCandidateDeps {
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

function getAssignedDeconstructDroneCount(
  state: Pick<GameState, "drones">,
  assetId: string,
  excludeDroneId?: string,
): number {
  let total = 0;
  for (const drone of Object.values(state.drones)) {
    if (drone.droneId === excludeDroneId) continue;
    if (drone.currentTaskType !== "deconstruct") continue;
    if (drone.deliveryTargetId !== assetId) continue;
    total++;
  }
  return total;
}

export function gatherDeconstructCandidates(
  state: Pick<GameState, "assets" | "drones">,
  drone: Pick<
    StarterDroneState,
    "droneId" | "tileX" | "tileY" | "deliveryTargetId"
  >,
  constants: DeconstructCandidateConstants,
  deps: DeconstructCandidateDeps,
): DroneSelectionCandidate[] {
  const candidates: DroneSelectionCandidate[] = [];

  for (const asset of Object.values(state.assets)) {
    if (asset.fixed) continue;
    if (asset.status !== "deconstructing") continue;
    if (getAssignedDeconstructDroneCount(state, asset.id, drone.droneId) > 0) {
      continue;
    }

    const stickyBonus =
      drone.deliveryTargetId === asset.id ? constants.stickyBonus : 0;
    const bonuses = {
      sticky: stickyBonus,
    };

    candidates.push(
      buildScoredCandidate(
        "deconstruct",
        asset.id,
        asset.id,
        deps.scoreDroneTask(
          "deconstruct",
          drone.tileX,
          drone.tileY,
          asset.x,
          asset.y,
          bonuses,
        ),
        bonuses,
        { deconstructRequestSeq: asset.deconstructRequestSeq },
      ),
    );
  }

  return candidates;
}
