import {
  buildConveyorRoutingIndex,
  type ConveyorRoutingIndex,
} from "../conveyor/conveyor-routing";
import type { GameState } from "../types";

export function invalidateRoutingIndexCache(state: GameState): GameState {
  return { ...state, routingIndexCache: null };
}

export function getOrBuildRoutingIndex(state: GameState): ConveyorRoutingIndex {
  const cached = state.routingIndexCache;
  if (cached && cached.assetsRef === state.assets) return cached;
  return buildConveyorRoutingIndex(state);
}
