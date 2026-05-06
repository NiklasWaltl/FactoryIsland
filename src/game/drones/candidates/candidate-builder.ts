import type { DroneTaskType } from "../../store/types";
import type { DroneSelectionCandidate } from "./types";

export interface CandidateBonuses {
  sticky?: number;
  urgency?: number;
  demand?: number;
  spread?: number;
}

export interface CandidateMetadata {
  deconstructRequestSeq?: number;
}

export function buildScoredCandidate(
  taskType: DroneTaskType,
  nodeId: string,
  deliveryTargetId: string,
  score: number,
  bonuses: CandidateBonuses,
  metadata: CandidateMetadata = {},
): DroneSelectionCandidate {
  return {
    taskType,
    nodeId,
    deliveryTargetId,
    deconstructRequestSeq: metadata.deconstructRequestSeq,
    score,
    _stickyBonus: bonuses.sticky ?? 0,
    _urgencyBonus: bonuses.urgency ?? 0,
    _demandBonus: bonuses.demand ?? 0,
    _spreadPenalty: bonuses.spread ?? 0,
  };
}
