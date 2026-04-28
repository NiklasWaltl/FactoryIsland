import type { DroneTaskType } from "../../store/types";
import type { DroneSelectionCandidate } from "./types";

export interface CandidateBonuses {
  role?: number;
  sticky?: number;
  urgency?: number;
  demand?: number;
  spread?: number;
}

export function buildScoredCandidate(
  taskType: DroneTaskType,
  nodeId: string,
  deliveryTargetId: string,
  score: number,
  bonuses: CandidateBonuses,
): DroneSelectionCandidate {
  return {
    taskType,
    nodeId,
    deliveryTargetId,
    score,
    _roleBonus: bonuses.role ?? 0,
    _stickyBonus: bonuses.sticky ?? 0,
    _urgencyBonus: bonuses.urgency ?? 0,
    _demandBonus: bonuses.demand ?? 0,
    _spreadPenalty: bonuses.spread ?? 0,
  };
}
