import { MAX_ZONES } from "../constants/buildings/index";
import type { GameAction } from "../game-actions";
import { makeId } from "../utils/make-id";
import type { BoundedContext, ZoneContextState } from "./types";

export const ZONE_HANDLED_ACTION_TYPES = [
  "CREATE_ZONE",
  "DELETE_ZONE",
  "SET_BUILDING_ZONE",
  "CLEAR_ALL_BUILDING_ZONES",
  "SET_BUILDING_SOURCE",
] as const satisfies readonly GameAction["type"][];

type ZoneActionType = (typeof ZONE_HANDLED_ACTION_TYPES)[number];
type ZoneAction = Extract<GameAction, { type: ZoneActionType }>;

const ZONE_ACTION_TYPE_SET: ReadonlySet<GameAction["type"]> = new Set(
  ZONE_HANDLED_ACTION_TYPES,
);

function isZoneAction(action: GameAction): action is ZoneAction {
  return ZONE_ACTION_TYPE_SET.has(action.type);
}

function reduceZone(
  state: ZoneContextState,
  action: ZoneAction,
): ZoneContextState {
  const actionType = action.type;

  switch (actionType) {
    case "CREATE_ZONE": {
      if (Object.keys(state.productionZones).length >= MAX_ZONES) return state;
      const zoneId = makeId();
      const idx = Object.keys(state.productionZones).length + 1;
      const name = action.name || `Zone ${idx}`;
      return {
        ...state,
        productionZones: {
          ...state.productionZones,
          [zoneId]: { id: zoneId, name },
        },
        routingIndexCache: null,
      };
    }

    case "DELETE_ZONE": {
      const { zoneId } = action;
      if (!state.productionZones[zoneId]) return state;
      const { [zoneId]: _removed, ...remainingZones } = state.productionZones;
      const newBuildingZoneIds: Record<string, string> = {};
      for (const [bid, zid] of Object.entries(state.buildingZoneIds)) {
        if (zid !== zoneId) newBuildingZoneIds[bid] = zid;
      }
      return {
        ...state,
        productionZones: remainingZones,
        buildingZoneIds: newBuildingZoneIds,
        routingIndexCache: null,
      };
    }

    case "SET_BUILDING_ZONE": {
      const { buildingId, zoneId } = action;
      if (!zoneId) {
        if (!(buildingId in state.buildingZoneIds)) return state;
        const { [buildingId]: _removed, ...rest } = state.buildingZoneIds;
        return { ...state, buildingZoneIds: rest };
      }
      if (!state.productionZones[zoneId]) return state;
      if (state.buildingZoneIds[buildingId] === zoneId) return state;
      return {
        ...state,
        buildingZoneIds: { ...state.buildingZoneIds, [buildingId]: zoneId },
      };
    }

    case "CLEAR_ALL_BUILDING_ZONES": {
      return {
        ...state,
        buildingZoneIds: {},
        routingIndexCache: null,
      };
    }

    case "SET_BUILDING_SOURCE": {
      const { buildingId, warehouseId } = action;
      if (!warehouseId) {
        if (!(buildingId in state.buildingSourceWarehouseIds)) return state;
        const { [buildingId]: _removed, ...rest } =
          state.buildingSourceWarehouseIds;
        return { ...state, buildingSourceWarehouseIds: rest };
      }
      if (state.buildingSourceWarehouseIds[buildingId] === warehouseId) {
        return state;
      }
      return {
        ...state,
        buildingSourceWarehouseIds: {
          ...state.buildingSourceWarehouseIds,
          [buildingId]: warehouseId,
        },
      };
    }

    default: {
      const _exhaustive: never = actionType;
      return _exhaustive;
    }
  }
}

export const zoneContext: BoundedContext<ZoneContextState> = {
  reduce(state, action) {
    if (!isZoneAction(action)) return null;
    return reduceZone(state, action);
  },
  handledActionTypes: ZONE_HANDLED_ACTION_TYPES,
};
