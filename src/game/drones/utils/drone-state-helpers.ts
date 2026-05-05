import type { GameState, StarterDroneState } from "../../store/types";

export function selectStarterDrone(
  state: GameState,
): StarterDroneState | undefined {
  return state.drones?.["starter"] ?? state.starterDrone;
}

export function requireStarterDrone(state: GameState): StarterDroneState {
  const drone = selectStarterDrone(state);
  if (!drone) throw new Error("[drone] starterDrone not found in state");
  return drone;
}

/** Keep drones record and starterDrone in sync (backward compat). */
export function syncDrones(state: GameState): GameState {
  if (!state.drones || state.drones["starter"] === undefined) return state;
  if (state.drones["starter"] === state.starterDrone) return state;
  return { ...state, drones: { ...state.drones, starter: state.starterDrone } };
}

/**
 * Write back an updated drone into state.drones[droneId].
 * Also keeps state.starterDrone in sync when droneId === "starter".
 */
export function applyDroneUpdate(
  state: GameState,
  droneId: string,
  updated: StarterDroneState,
): GameState {
  const newDrones = { ...state.drones, [droneId]: updated };
  if (droneId === "starter") {
    return { ...state, drones: newDrones, starterDrone: updated };
  }
  return { ...state, drones: newDrones };
}
