import type { BuildingType } from "../types";
import {
  forEachTileInBounds,
  isTileFootprintPlayable,
} from "../../world/tile-footprint-utils";
import type { TileType } from "../../world/tile-types";

export type BuildPlacementEligibilityBlockReason =
  | "not_enough_resources"
  | "workbench_already_exists"
  | "non_stackable_limit_reached"
  | "warehouse_limit_reached"
  | "footprint_out_of_bounds"
  | "footprint_non_playable_tile"
  | "footprint_cell_occupied"
  | "missing_stone_floor";

export type BuildPlacementEligibilityDecision =
  | { kind: "eligible" }
  | { kind: "blocked"; blockReason: BuildPlacementEligibilityBlockReason };

export interface DecideBuildingPlacementEligibilityInput {
  buildingType: BuildingType;
  hasEnoughResources: boolean;
  hasWorkbenchPlaced: boolean;
  isStackableBuilding: boolean;
  placedBuildingCountOfType: number;
  nonStackableLimit: number;
  warehousesPlaced: number;
  warehouseLimit: number;
  requiresStoneFloor: boolean;
  runStandardPlacementChecks: boolean;
  x: number;
  y: number;
  footprintSize: number;
  gridWidth: number;
  gridHeight: number;
  tileMap: TileType[][];
  cellMap: Record<string, string>;
  floorMap: Record<string, "stone_floor">;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function decideBuildingPlacementEligibility(
  input: DecideBuildingPlacementEligibilityInput,
): BuildPlacementEligibilityDecision {
  if (!input.hasEnoughResources) {
    return { kind: "blocked", blockReason: "not_enough_resources" };
  }

  if (!input.runStandardPlacementChecks) {
    return { kind: "eligible" };
  }

  if (input.buildingType === "workbench" && input.hasWorkbenchPlaced) {
    return { kind: "blocked", blockReason: "workbench_already_exists" };
  }

  if (
    !input.isStackableBuilding &&
    input.buildingType !== "warehouse" &&
    input.placedBuildingCountOfType >= input.nonStackableLimit
  ) {
    return { kind: "blocked", blockReason: "non_stackable_limit_reached" };
  }

  if (
    input.buildingType === "warehouse" &&
    input.warehousesPlaced >= input.warehouseLimit
  ) {
    return { kind: "blocked", blockReason: "warehouse_limit_reached" };
  }

  let footprintBlockReason: Extract<
    BuildPlacementEligibilityBlockReason,
    | "footprint_out_of_bounds"
    | "footprint_non_playable_tile"
    | "footprint_cell_occupied"
  > | null = null;

  forEachTileInBounds(
    {
      row: input.y,
      col: input.x,
      width: input.footprintSize,
      height: input.footprintSize,
    },
    (row, col) => {
      if (footprintBlockReason) return;
      if (col >= input.gridWidth || row >= input.gridHeight) {
        footprintBlockReason = "footprint_out_of_bounds";
        return;
      }
      if (
        !isTileFootprintPlayable(input.tileMap, {
          row,
          col,
          width: 1,
          height: 1,
        })
      ) {
        footprintBlockReason = "footprint_non_playable_tile";
        return;
      }
      if (input.cellMap[cellKey(col, row)]) {
        footprintBlockReason = "footprint_cell_occupied";
      }
    },
  );

  if (footprintBlockReason) {
    return { kind: "blocked", blockReason: footprintBlockReason };
  }

  if (input.requiresStoneFloor) {
    for (let dy = 0; dy < input.footprintSize; dy++) {
      for (let dx = 0; dx < input.footprintSize; dx++) {
        if (!input.floorMap[cellKey(input.x + dx, input.y + dy)]) {
          return { kind: "blocked", blockReason: "missing_stone_floor" };
        }
      }
    }
  }

  return { kind: "eligible" };
}
