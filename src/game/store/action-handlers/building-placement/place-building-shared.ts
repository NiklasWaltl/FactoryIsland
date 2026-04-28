import type { AssetType, Direction, GameState, PlacedAsset } from "../../types";
import { GRID_W, GRID_H } from "../../../constants/grid";
import { cellKey } from "../../cell-key";
import { getAutoSmelterIoCells } from "../../asset-geometry";
import { computeConnectedAssetIds } from "../../../logistics/connectivity";
import type { BuildPlacementEligibilityDecision } from "../../build-placement-eligibility";
import { type BuildingPlacementIoDeps, logPlacementInvariantWarnings } from "./shared";

// ---- Notification mapping ----

type BlockReason = Extract<BuildPlacementEligibilityDecision, { kind: "blocked" }>["blockReason"];

const STATIC_BLOCK_NOTIFICATIONS: Partial<Record<BlockReason, string>> = {
  not_enough_resources: "Nicht genug Ressourcen!",
  workbench_already_exists: "Es kann nur eine Werkbank gebaut werden.",
  warehouse_limit_reached: "Maximale Anzahl an Lagerhäusern erreicht.",
};

export function getBuildPlacementNotificationForDecision(
  blockReason: BlockReason,
  buildingLabel: string,
): string | null {
  if (blockReason in STATIC_BLOCK_NOTIFICATIONS) {
    return STATIC_BLOCK_NOTIFICATIONS[blockReason] ?? null;
  }
  if (blockReason === "non_stackable_limit_reached") {
    return `${buildingLabel} ist bereits platziert.`;
  }
  if (blockReason === "missing_stone_floor") {
    return `${buildingLabel} benötigt Steinboden unter allen Feldern!`;
  }
  // out_of_bounds / cell_occupied remain silent no-op paths.
  return null;
}

// ---- Auto-Smelter / Auto-Assembler shared helpers ----

export function getAutoSmelterFootprintDimensions(
  dir: Direction,
): { width: 1 | 2; height: 1 | 2 } {
  return dir === "east" || dir === "west"
    ? { width: 2, height: 1 }
    : { width: 1, height: 2 };
}

export type AutoSmelterFootprintEligibilityDecision =
  | { kind: "eligible" }
  | { kind: "blocked"; blockReason: "out_of_bounds" | "cell_occupied" };

export function checkAutoSmelterFootprintEligibility(input: {
  x: number;
  y: number;
  width: 1 | 2;
  height: 1 | 2;
  dir: Direction;
  cellMap: Record<string, string>;
}): AutoSmelterFootprintEligibilityDecision {
  const { x, y, width, height, cellMap } = input;
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      if (x + dx >= GRID_W || y + dy >= GRID_H) {
        return { kind: "blocked", blockReason: "out_of_bounds" };
      }
      if (cellMap[cellKey(x + dx, y + dy)]) {
        return { kind: "blocked", blockReason: "cell_occupied" };
      }
    }
  }
  return { kind: "eligible" };
}

export type AutoSmelterConnectorPreflight = {
  ioCells: {
    input: { x: number; y: number };
    output: { x: number; y: number };
  };
  neighborTypes: {
    inputType: AssetType | null;
    outputType: AssetType | null;
    inputIsConveyor: boolean;
    outputIsConveyor: boolean;
  };
  beltFound: boolean;
  ioOutOfBounds: boolean;
};

export function computeAutoSmelterConnectorPreflight(input: {
  x: number;
  y: number;
  width: 1 | 2;
  height: 1 | 2;
  dir: Direction;
  cellMap: Record<string, string>;
  assets: Record<string, PlacedAsset>;
}): AutoSmelterConnectorPreflight {
  const { x, y, width, height, dir, cellMap, assets } = input;
  const tempAsset: PlacedAsset = { id: "temp", type: "auto_smelter", x, y, size: 2, width, height, direction: dir };
  const io = getAutoSmelterIoCells(tempAsset);
  const inputNeighborId = cellMap[cellKey(io.input.x, io.input.y)];
  const outputNeighborId = cellMap[cellKey(io.output.x, io.output.y)];
  const inputNeighbor = inputNeighborId ? assets[inputNeighborId] : null;
  const outputNeighbor = outputNeighborId ? assets[outputNeighborId] : null;
  const inputType = inputNeighbor?.type ?? null;
  const outputType = outputNeighbor?.type ?? null;
  const beltLike: AssetType[] = [
    "conveyor",
    "conveyor_corner",
    "conveyor_underground_in",
    "conveyor_underground_out",
  ];
  const inputIsConveyor = inputType !== null && beltLike.includes(inputType);
  const outputIsConveyor = outputType !== null && beltLike.includes(outputType);
  return {
    ioCells: io,
    neighborTypes: { inputType, outputType, inputIsConveyor, outputIsConveyor },
    beltFound: inputIsConveyor && outputIsConveyor,
    ioOutOfBounds:
      io.input.x < 0 || io.input.x >= GRID_W || io.input.y < 0 || io.input.y >= GRID_H ||
      io.output.x < 0 || io.output.x >= GRID_W || io.output.y < 0 || io.output.y >= GRID_H,
  };
}

// ---- Post-placement finalization ----

export function finalizePlacement(
  partial: GameState,
  actionType: "BUILD_PLACE_BUILDING",
  debugLog: BuildingPlacementIoDeps["debugLog"],
): GameState {
  const nextState = { ...partial, connectedAssetIds: computeConnectedAssetIds(partial) };
  logPlacementInvariantWarnings(nextState, actionType, debugLog);
  return nextState;
}
