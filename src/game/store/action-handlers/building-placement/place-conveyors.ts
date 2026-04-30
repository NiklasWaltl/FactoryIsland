import type { AssetType, BuildingType, ConveyorItem, Direction, GameState, PlacedAsset } from "../../types";
import { BUILDING_LABELS } from "../../constants/buildings";
import { cellKey } from "../../utils/cell-key";
import { placeAsset } from "../../asset-mutation";
import { undergroundSpanCellsInBounds } from "../../conveyor/constants";
import {
  explainUndergroundOutPairingFailure,
  findUnpairedUndergroundEntranceId,
  hasUndergroundOutSpanWindowInBounds,
} from "../../conveyor/underground-out-pairing-hint";
import { type BuildingPlacementIoDeps } from "./shared";
import { finalizePlacement } from "./place-building-shared";

export interface ConveyorPlacementContext {
  state: GameState;
  bType: BuildingType;
  useConstructionSite: boolean;
  applyCostOrConstructionSite: (partial: GameState, assetId: string) => GameState;
  addErrorNotification: BuildingPlacementIoDeps["addErrorNotification"];
  debugLog: BuildingPlacementIoDeps["debugLog"];
}

export function placeConveyorBranch(
  ctx: ConveyorPlacementContext,
  x: number,
  y: number,
  direction: Direction,
): GameState {
  const { state, bType, useConstructionSite, applyCostOrConstructionSite, addErrorNotification, debugLog } = ctx;
  if (state.cellMap[cellKey(x, y)]) {
    return { ...state, notifications: addErrorNotification(state.notifications, "Das Feld ist belegt.") };
  }
  const placeType: AssetType =
    bType === "conveyor_corner"
      ? "conveyor_corner"
      : bType === "conveyor_merger"
        ? "conveyor_merger"
        : bType === "conveyor_splitter"
          ? "conveyor_splitter"
          : "conveyor";
  const convPlaced = placeAsset(state.assets, state.cellMap, placeType, x, y, 1);
  if (!convPlaced) return state;
  const assetWithDir = { ...convPlaced.assets[convPlaced.id], direction };
  const newAssetsC = { ...convPlaced.assets, [convPlaced.id]: assetWithDir };
  const newConveyors = { ...state.conveyors, [convPlaced.id]: { queue: [] as ConveyorItem[] } };
  debugLog.building(`[BuildMode] Placed ${BUILDING_LABELS[bType]} at (${x},${y}) facing ${direction}${useConstructionSite ? " as construction site" : ""}`);
  const partialC = applyCostOrConstructionSite(
    { ...state, assets: newAssetsC, cellMap: convPlaced.cellMap, conveyors: newConveyors },
    convPlaced.id,
  );
  return finalizePlacement(partialC, "BUILD_PLACE_BUILDING", debugLog);
}

export function placeUndergroundInBranch(
  ctx: ConveyorPlacementContext,
  x: number,
  y: number,
  direction: Direction,
): GameState {
  const { state, bType, useConstructionSite, applyCostOrConstructionSite, addErrorNotification, debugLog } = ctx;
  if (state.cellMap[cellKey(x, y)]) {
    return { ...state, notifications: addErrorNotification(state.notifications, "Das Feld ist belegt.") };
  }
  const convPlaced = placeAsset(state.assets, state.cellMap, "conveyor_underground_in", x, y, 1);
  if (!convPlaced) return state;
  const assetWithDir = { ...convPlaced.assets[convPlaced.id], direction };
  const newAssetsC = { ...convPlaced.assets, [convPlaced.id]: assetWithDir };
  const newConveyors = { ...state.conveyors, [convPlaced.id]: { queue: [] as ConveyorItem[] } };
  debugLog.building(
    `[BuildMode] Placed ${BUILDING_LABELS[bType]} at (${x},${y}) facing ${direction}${useConstructionSite ? " as construction site" : ""}`,
  );
  const partialC = applyCostOrConstructionSite(
    { ...state, assets: newAssetsC, cellMap: convPlaced.cellMap, conveyors: newConveyors },
    convPlaced.id,
  );
  return finalizePlacement(partialC, "BUILD_PLACE_BUILDING", debugLog);
}

export function placeUndergroundOutBranch(
  ctx: ConveyorPlacementContext,
  x: number,
  y: number,
  direction: Direction,
): GameState {
  const { state, bType, useConstructionSite, applyCostOrConstructionSite, addErrorNotification, debugLog } = ctx;
  if (state.cellMap[cellKey(x, y)]) {
    return { ...state, notifications: addErrorNotification(state.notifications, "Das Feld ist belegt.") };
  }
  if (!hasUndergroundOutSpanWindowInBounds(x, y, direction)) {
    return {
      ...state,
      notifications: addErrorNotification(
        state.notifications,
        "Untergrund-Tunnel: Ein Teil der Strecke zwischen Eingang und Ausgang liegt außerhalb der Karte.",
      ),
    };
  }
  const entranceId = findUnpairedUndergroundEntranceId(state, x, y, direction);
  if (!entranceId) {
    return {
      ...state,
      notifications: addErrorNotification(
        state.notifications,
        explainUndergroundOutPairingFailure(state, x, y, direction),
      ),
    };
  }
  const entrance = state.assets[entranceId];
  if (!entrance || entrance.type !== "conveyor_underground_in") return state;
  const tempOut: PlacedAsset = { id: "temp", type: "conveyor_underground_out", x, y, size: 1, direction };
  if (!undergroundSpanCellsInBounds(entrance, tempOut)) {
    return {
      ...state,
      notifications: addErrorNotification(
        state.notifications,
        "Untergrund-Tunnel: Ein Teil der Strecke zwischen Eingang und Ausgang liegt außerhalb der Karte.",
      ),
    };
  }
  const inZone = state.buildingZoneIds[entranceId] ?? null;
  const convPlaced = placeAsset(state.assets, state.cellMap, "conveyor_underground_out", x, y, 1);
  if (!convPlaced) return state;
  const outId = convPlaced.id;
  const assetWithDir = { ...convPlaced.assets[outId], direction };
  const newAssetsC = { ...convPlaced.assets, [outId]: assetWithDir };
  const newConveyors = { ...state.conveyors, [outId]: { queue: [] as ConveyorItem[] } };
  const newPeers: Record<string, string> = {
    ...state.conveyorUndergroundPeers,
    [entranceId]: outId,
    [outId]: entranceId,
  };
  const nextBuildingZones = inZone
    ? { ...state.buildingZoneIds, [outId]: inZone }
    : state.buildingZoneIds;
  debugLog.building(
    `[BuildMode] Placed ${BUILDING_LABELS[bType]} at (${x},${y}) facing ${direction}, paired with entrance ${entranceId}${useConstructionSite ? " as construction site" : ""}`,
  );
  const partialC = applyCostOrConstructionSite(
    {
      ...state,
      assets: newAssetsC,
      cellMap: convPlaced.cellMap,
      conveyors: newConveyors,
      conveyorUndergroundPeers: newPeers,
      buildingZoneIds: nextBuildingZones,
    },
    outId,
  );
  return finalizePlacement(partialC, "BUILD_PLACE_BUILDING", debugLog);
}
