import { GRID_H, GRID_W } from "../constants/grid";
import { isTileFootprintPlayable } from "../world/tile-footprint-utils";
import {
  BUILDING_SIZES,
  REQUIRES_STONE_FLOOR,
} from "../store/constants/buildings/index";
import { DEPOSIT_TYPES } from "../world/fixed-resource-layout";
import { cellKey } from "../store/utils/cell-key";
import {
  isConveyorPreviewBuildingType,
  previewBuildingPlacementAtCell,
} from "../store/building-placement-preview";
import type { Direction, GameState } from "../store/types";

export interface BuildingPlacementDimensions {
  bWidth: 1 | 2;
  bHeight: 1 | 2;
  isDirectedTwoByOneMachine: boolean;
}

export interface BuildingPlacementValidationResult {
  valid: boolean;
  ugOutPreviewOk: boolean;
  undergroundOutPlacementHint: string | null;
  conveyorNonUgHint: string | null;
}

export function getBuildingPreviewDimensions(
  activeBuildingType: GameState["selectedBuildingType"] | undefined,
  buildDirection: Direction,
): BuildingPlacementDimensions {
  const isDirectedTwoByOneMachine =
    activeBuildingType === "auto_smelter" ||
    activeBuildingType === "auto_assembler";
  const bWidth: 1 | 2 = isDirectedTwoByOneMachine
    ? buildDirection === "east" || buildDirection === "west"
      ? 2
      : 1
    : ((activeBuildingType && BUILDING_SIZES[activeBuildingType]) ?? 2);
  const bHeight: 1 | 2 = isDirectedTwoByOneMachine
    ? buildDirection === "east" || buildDirection === "west"
      ? 1
      : 2
    : ((activeBuildingType && BUILDING_SIZES[activeBuildingType]) ?? 2);

  return { bWidth, bHeight, isDirectedTwoByOneMachine };
}

export function validateBuildingPlacementPreview(input: {
  state: GameState;
  x: number;
  y: number;
  activeBuildingType: GameState["selectedBuildingType"] | undefined;
  buildDirection: Direction;
  bWidth: 1 | 2;
  bHeight: 1 | 2;
}): BuildingPlacementValidationResult {
  const { state, x, y, activeBuildingType, buildDirection, bWidth, bHeight } =
    input;

  let valid = x >= 0 && y >= 0 && x + bWidth <= GRID_W && y + bHeight <= GRID_H;

  const conveyorPreview =
    activeBuildingType && isConveyorPreviewBuildingType(activeBuildingType)
      ? previewBuildingPlacementAtCell(
          state,
          activeBuildingType,
          x,
          y,
          buildDirection,
        )
      : null;

  if (conveyorPreview) {
    valid = conveyorPreview.ok;
  } else if (valid && activeBuildingType === "auto_miner") {
    const depId = state.cellMap[cellKey(x, y)];
    const depAsset = depId ? state.assets[depId] : null;
    valid = !!depAsset && DEPOSIT_TYPES.has(depAsset.type);
    if (valid && depId) {
      const existingMiner = Object.values(state.autoMiners).find(
        (miner) => miner.depositId === depId,
      );
      if (existingMiner) valid = false;
    }
  } else if (valid) {
    for (let dy = 0; dy < bHeight && valid; dy++) {
      for (let dx = 0; dx < bWidth && valid; dx++) {
        if (state.cellMap[cellKey(x + dx, y + dy)]) valid = false;
      }
    }
  }

  if (
    valid &&
    activeBuildingType &&
    REQUIRES_STONE_FLOOR.has(activeBuildingType)
  ) {
    for (let dy = 0; dy < bHeight && valid; dy++) {
      for (let dx = 0; dx < bWidth && valid; dx++) {
        if (!state.floorMap[cellKey(x + dx, y + dy)]) valid = false;
      }
    }
  }

  if (valid && activeBuildingType) {
    valid = isTileFootprintPlayable(state.tileMap, {
      row: y,
      col: x,
      width: bWidth,
      height: bHeight,
    });
  }

  const isUgOutBuild = activeBuildingType === "conveyor_underground_out";
  const ugOutPreviewOk = isUgOutBuild && conveyorPreview?.ok === true;

  const undergroundOutPlacementHint: string | null = !isUgOutBuild
    ? null
    : conveyorPreview
      ? conveyorPreview.ok
        ? "Untergrund: Eingang in Reichweite (2–5 Felder)."
        : conveyorPreview.message
      : null;

  const conveyorNonUgHint: string | null =
    activeBuildingType &&
    isConveyorPreviewBuildingType(activeBuildingType) &&
    activeBuildingType !== "conveyor_underground_out" &&
    conveyorPreview &&
    !conveyorPreview.ok
      ? conveyorPreview.message
      : null;

  return {
    valid,
    ugOutPreviewOk,
    undergroundOutPlacementHint,
    conveyorNonUgHint,
  };
}

export function isFloorTilePlacementValid(
  state: GameState,
  x: number,
  y: number,
  tileType: NonNullable<GameState["selectedFloorTile"]>,
): boolean {
  const key = cellKey(x, y);
  return tileType === "stone_floor"
    ? !state.floorMap[key] && !state.cellMap[key]
    : !!state.floorMap[key] && !state.cellMap[key];
}
