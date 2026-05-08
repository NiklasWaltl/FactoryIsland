// ============================================================
// Production zone action handler
// ------------------------------------------------------------
// Centralizes the three production-zone mutation cases extracted
// from reducer.ts. Behaviour is byte-equivalent to the prior inline
// case bodies — no new abstractions, no logic changes.
// ============================================================

import type { GameAction } from "../game-actions";
import { MAX_ZONES } from "../constants/buildings/index";
import { makeId } from "../utils/make-id";
import type { GameState } from "../types";
import { hasAsset, isBuildingZoneStateConsistent } from "../utils/asset-guards";
import { invalidateRoutingIndexCache } from "../helpers/routing-index-cache";

type HandledActionType = "CREATE_ZONE" | "DELETE_ZONE" | "SET_BUILDING_ZONE";

const HANDLED_ACTION_TYPES = new Set<string>([
  "CREATE_ZONE",
  "DELETE_ZONE",
  "SET_BUILDING_ZONE",
]);

export function isZoneAction(
  action: GameAction,
): action is Extract<GameAction, { type: HandledActionType }> {
  return HANDLED_ACTION_TYPES.has(action.type);
}

function logZoneInvariantIfInvalid(state: GameState, actionType: string): void {
  if (!import.meta.env.DEV) return;
  if (isBuildingZoneStateConsistent(state)) return;
}

function finalizeZoneAction(
  nextState: GameState,
  actionType: string,
): GameState {
  logZoneInvariantIfInvalid(nextState, actionType);
  return invalidateRoutingIndexCache(nextState);
}

/**
 * Handles all production-zone mutation actions. Returns the next
 * state if the action belongs to this cluster, or `null` so the
 * reducer can fall through to its remaining switch cases.
 */
export function handleZoneAction(
  state: GameState,
  action: GameAction,
): GameState | null {
  switch (action.type) {
    case "CREATE_ZONE": {
      if (Object.keys(state.productionZones).length >= MAX_ZONES) return state;
      const zoneId = makeId();
      const idx = Object.keys(state.productionZones).length + 1;
      const name = action.name || `Zone ${idx}`;
      const nextState = {
        ...state,
        productionZones: {
          ...state.productionZones,
          [zoneId]: { id: zoneId, name },
        },
      };
      return finalizeZoneAction(nextState, action.type);
    }

    case "DELETE_ZONE": {
      const { zoneId } = action;
      if (!state.productionZones[zoneId]) return state;
      const { [zoneId]: _, ...remainingZones } = state.productionZones;
      // Remove all building-zone assignments for this zone
      const newBuildingZoneIds: Record<string, string> = {};
      for (const [bid, zid] of Object.entries(state.buildingZoneIds)) {
        if (zid !== zoneId) newBuildingZoneIds[bid] = zid;
      }
      const nextState = {
        ...state,
        productionZones: remainingZones,
        buildingZoneIds: newBuildingZoneIds,
      };
      return finalizeZoneAction(nextState, action.type);
    }

    case "SET_BUILDING_ZONE": {
      const { buildingId, zoneId } = action;
      if (!hasAsset(state, buildingId)) return state;
      if (!zoneId) {
        // Remove from zone
        const { [buildingId]: _removed, ...rest } = state.buildingZoneIds;
        const nextState = { ...state, buildingZoneIds: rest };
        return finalizeZoneAction(nextState, action.type);
      }
      if (!state.productionZones[zoneId]) return state;
      const nextState = {
        ...state,
        buildingZoneIds: { ...state.buildingZoneIds, [buildingId]: zoneId },
      };
      return finalizeZoneAction(nextState, action.type);
    }

    default:
      return null;
  }
}
