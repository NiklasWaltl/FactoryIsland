import type {
  DroneRole,
  DroneTaskType,
  GameState,
  StarterDroneState,
} from "../../store/types";
import type { DroneSelectionCandidate } from "../candidates/types";
import {
  buildCandidateInputs,
  collectDroneTaskCandidates,
} from "./select-drone-task-candidates";
import type { SelectDroneTaskDeps } from "./select-drone-task-types";
import { requireStarterDrone } from "../utils/drone-state-helpers";

export type {
  NearbyWarehouseDispatchCandidate,
  SelectDroneTaskDeps,
} from "./select-drone-task-types";

export type SelectedDroneTask = {
  taskType: DroneTaskType;
  nodeId: string;
  deliveryTargetId: string;
};

/**
 * Selects the highest-scoring drone task from all valid candidates.
 *
 * Scoring: score = BASE_PRIORITY[taskType] - chebyshevDistanceDroneToNode + bonuses
 */
export function selectDroneTask(
  state: GameState,
  droneOverride: StarterDroneState | undefined,
  deps: SelectDroneTaskDeps,
): SelectedDroneTask | null {
  type TopDroneCandidateSelectionDecision = {
    selected: DroneSelectionCandidate | null;
    bestConstruction?: DroneSelectionCandidate;
    bestHubRestock?: DroneSelectionCandidate;
  };

  const decideTopDroneCandidateSelection = (
    candidates: DroneSelectionCandidate[],
  ): TopDroneCandidateSelectionDecision => {
    if (candidates.length === 0) {
      return { selected: null };
    }

    // Deconstruct requests are processed in FIFO order: smaller sequence means older request.
    const compareDeconstructRequestOrder = (
      left: DroneSelectionCandidate,
      right: DroneSelectionCandidate,
    ): number => {
      if (left.taskType !== "deconstruct" || right.taskType !== "deconstruct") {
        return 0;
      }

      const leftSeq = left.deconstructRequestSeq ?? Number.MAX_SAFE_INTEGER;
      const rightSeq = right.deconstructRequestSeq ?? Number.MAX_SAFE_INTEGER;
      if (leftSeq === rightSeq) return 0;
      return leftSeq - rightSeq;
    };

    const rankedCandidates = [...candidates].sort((left, right) => {
      const deconstructRequestOrder = compareDeconstructRequestOrder(
        left,
        right,
      );
      if (deconstructRequestOrder !== 0) return deconstructRequestOrder;
      return (
        right.score - left.score || left.nodeId.localeCompare(right.nodeId)
      );
    });

    return {
      selected: rankedCandidates[0] ?? null,
      bestConstruction: rankedCandidates.find(
        (candidate) =>
          candidate.taskType === "construction_supply" ||
          candidate.taskType === "hub_dispatch",
      ),
      bestHubRestock: rankedCandidates.find(
        (candidate) => candidate.taskType === "hub_restock",
      ),
    };
  };

  const drone = droneOverride ?? requireStarterDrone(state);
  const role: DroneRole = drone.role ?? "auto";

  const { availableNodes, availableTypes } = buildCandidateInputs(state, drone);

  let candidates = collectDroneTaskCandidates({
    state,
    drone,
    availableNodes,
    availableTypes,
    role,
    deps,
  });

  // Hard-filter fallback: if a role-locked drone has no role-matching work,
  // retry with role: "auto" so the drone doesn't deadlock idle.
  if (candidates.length === 0 && role !== "auto") {
    candidates = collectDroneTaskCandidates({
      state,
      drone,
      availableNodes,
      availableTypes,
      role: "auto",
      deps,
    });
  }

  const {
    selected: chosen,
    bestConstruction: bestConstructionCandidate,
    bestHubRestock: bestHubRestockCandidate,
  } = decideTopDroneCandidateSelection(candidates);

  if (!chosen) return null;

  return {
    taskType: chosen.taskType,
    nodeId: chosen.nodeId,
    deliveryTargetId: chosen.deliveryTargetId,
  };
}
