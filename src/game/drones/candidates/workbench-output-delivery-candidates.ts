import type {
  DroneTaskType,
  GameState,
  StarterDroneState,
} from "../../store/types";
import type { DroneSelectionCandidate } from "./types";
import { buildScoredCandidate } from "./candidate-builder";

export interface WorkbenchDeliveryCandidateConstants {
  stickyBonus: number;
}

export interface WorkbenchDeliveryCandidateDeps {
  getAssignedWorkbenchDeliveryDroneCount: (
    state: Pick<GameState, "drones">,
    jobId: string,
    excludeDroneId?: string,
  ) => number;
  scoreDroneTask: (
    taskType: DroneTaskType,
    droneX: number,
    droneY: number,
    nodeX: number,
    nodeY: number,
    bonuses?: { role?: number; sticky?: number; urgency?: number; demand?: number; spread?: number },
  ) => number;
}

export function gatherWorkbenchOutputDeliveryCandidates(
  state: Pick<GameState, "assets" | "crafting" | "drones">,
  drone: Pick<StarterDroneState, "droneId" | "tileX" | "tileY" | "craftingJobId">,
  constants: WorkbenchDeliveryCandidateConstants,
  deps: WorkbenchDeliveryCandidateDeps,
): DroneSelectionCandidate[] {
  const candidates: DroneSelectionCandidate[] = [];

  for (const job of state.crafting.jobs) {
    if (job.status !== "delivering") continue;
    if (deps.getAssignedWorkbenchDeliveryDroneCount(state, job.id, drone.droneId) > 0) continue;
    const workbenchAsset = state.assets[job.workbenchId];
    if (!workbenchAsset || workbenchAsset.type !== "workbench") continue;
    const syntheticNodeId = `workbench:${job.workbenchId}:${job.id}`;
    const stickyBonus = drone.craftingJobId === job.id ? constants.stickyBonus : 0;
    const bonuses = { sticky: stickyBonus };
    candidates.push(buildScoredCandidate(
      "workbench_delivery", syntheticNodeId, job.workbenchId,
      deps.scoreDroneTask("workbench_delivery", drone.tileX, drone.tileY, workbenchAsset.x, workbenchAsset.y, bonuses),
      bonuses,
    ));
  }

  return candidates;
}