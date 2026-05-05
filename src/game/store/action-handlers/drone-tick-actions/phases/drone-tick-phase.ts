import type { GameState } from "../../../types";
import type { DroneTickActionDeps } from "../deps";
import type { DroneTickAction } from "../types";
import { applyDroneUpdate } from "../../../../drones/utils/drone-state-helpers";
import { STARTER_DRONE_ID } from "../../../selectors/drone-selectors";

export interface DroneTickContext {
  state: GameState;
  action: DroneTickAction;
  deps: DroneTickActionDeps;
}

export function runDroneTickPhase(ctx: DroneTickContext): GameState {
  const { state, deps } = ctx;

  // Inline of the former tickAllDrones() - sequential per-drone tick using
  // the order of the current drones map. Each subsequent drone sees all
  // mutations made by the previously ticked drones.
  const starterDroneFromRecord = state.drones[STARTER_DRONE_ID];
  const startState =
    starterDroneFromRecord === undefined ||
    starterDroneFromRecord === state.starterDrone
      ? state
      : applyDroneUpdate(state, STARTER_DRONE_ID, state.starterDrone);
  let nextState = startState;
  for (const droneId of Object.keys(startState.drones)) {
    nextState = deps.tickOneDrone(nextState, droneId);
  }
  return nextState;
}
