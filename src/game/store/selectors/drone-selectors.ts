import type { GameState, StarterDroneState } from "../types";

export const STARTER_DRONE_ID = "starter";

/** Canonical read accessor for the starter drone (drones record is source of truth). */
export function selectStarterDrone(
  state: Pick<GameState, "drones">,
): StarterDroneState | undefined {
  return state.drones?.[STARTER_DRONE_ID];
}

/** Strict helper for call sites that require a starter drone to exist. */
export function requireStarterDrone(
  state: Pick<GameState, "drones">,
): StarterDroneState {
  const drone = selectStarterDrone(state);
  if (!drone) {
    throw new Error(
      "[selectStarterDrone] starterDrone not found in drones record",
    );
  }
  return drone;
}