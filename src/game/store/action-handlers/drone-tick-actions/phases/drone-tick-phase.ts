import type { GameState } from "../../../types";
import type { DroneTickActionDeps } from "../deps";
import type { DroneTickAction } from "../types";

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
  let nextState = state;
  for (const droneId of Object.keys(state.drones)) {
    nextState = deps.tickOneDrone(nextState, droneId);
  }
  return nextState;
}
