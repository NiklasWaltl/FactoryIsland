import type { GameState, StarterDroneState } from "../../store/types";
import { STARTER_DRONE_ID } from "../../store/selectors/drone-selectors";

type StarterDroneReadable = {
  readonly drones?: Partial<Record<string, StarterDroneState>>;
};

export function selectStarterDrone(
  state: StarterDroneReadable,
): StarterDroneState | undefined {
  return state.drones?.[STARTER_DRONE_ID];
}

export function requireStarterDrone(
  state: StarterDroneReadable,
): StarterDroneState {
  const drone = selectStarterDrone(state);
  if (!drone) throw new Error("[drone] starter drone not found in state");
  return drone;
}

export function syncDrones(state: GameState): GameState {
  return state;
}

export function applyDroneUpdate(
  state: GameState,
  droneId: string,
  updated: StarterDroneState,
): GameState {
  const newDrones = { ...state.drones, [droneId]: updated };
  return { ...state, drones: newDrones };
}
