import { applyDroneUpdate } from "../../../../drones/utils/drone-state-helpers";
import type { GameState, StarterDroneState } from "../../../types";
import { requireStarterDrone } from "../../../selectors/drone-selectors";
import type { DroneRoleActionDeps } from "../deps";
import type { DroneSetRoleAction } from "../types";

export interface DroneSetRoleContext {
  state: GameState;
  action: DroneSetRoleAction;
  deps: DroneRoleActionDeps;
}

function applyRole(drone: StarterDroneState, role: DroneSetRoleAction["role"]) {
  return { ...drone, role };
}

export function runDroneSetRolePhase(ctx: DroneSetRoleContext): GameState {
  const { state, action } = ctx;
  const { droneId, role } = action;
  const starter = requireStarterDrone(state);
  // Invariants:
  // 1) the selector is authoritative for starter reads.
  // 2) unknown non-starter IDs are strict no-op.
  // 3) only the role field is changed.
  if (droneId === starter.droneId) {
    const updated = applyRole(starter, role);
    return applyDroneUpdate(state, droneId, updated);
  }
  const target = state.drones[droneId];
  if (!target) return state;
  return applyDroneUpdate(state, droneId, applyRole(target, role));
}
