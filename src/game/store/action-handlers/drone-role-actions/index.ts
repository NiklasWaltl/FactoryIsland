// ============================================================
// Drone role action handler
// ------------------------------------------------------------
// Handles:     DRONE_SET_ROLE
// Reads:       state.drones, starter drone selector, state.serviceHubs
// Writes:      state.drones[id].role
// Depends on:  ./phases/drone-set-role-phase
// Notes:       Role hard-filters which task types a drone can take —
//              see ../../../drones/selection/select-drone-task.ts and
//              `roleAllows` in ../../types/drone-types.ts. Role change
//              ONLY mutates `drone.role` (see ./phases/drone-set-role-phase.ts)
//              — it does NOT cancel an in-flight task, drop cargo, or
//              clear `deliveryTargetId`. The new role only takes effect
//              the next time the drone is idle and re-evaluates tasks
//              via select-drone-task.ts.
// ============================================================

import type { GameAction } from "../../game-actions";
import type { GameState } from "../../types";
import type { DroneRoleActionDeps } from "./deps";
import { HANDLED_ACTION_TYPES, type DroneRoleHandledAction } from "./types";
import { runDroneSetRolePhase } from "./phases/drone-set-role-phase";

export type { DroneRoleActionDeps } from "./deps";

export function isDroneRoleAction(
  action: GameAction,
): action is DroneRoleHandledAction {
  return HANDLED_ACTION_TYPES.has(action.type);
}

/**
 * Handles drone-role actions. Returns the next state if the action
 * belongs to this cluster, or `null` to signal reducer fallback.
 */
export function handleDroneRoleAction(
  state: GameState,
  action: GameAction,
  deps: DroneRoleActionDeps,
): GameState | null {
  switch (action.type) {
    case "DRONE_SET_ROLE": {
      return runDroneSetRolePhase({ state, action, deps });
    }

    default:
      return null;
  }
}
