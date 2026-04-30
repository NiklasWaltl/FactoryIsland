import type { AssetType, AutoSmelterStatus, Direction, GameState } from "../../types";
import { BUILDING_LABELS } from "../../constants/buildings";
import { DEPOSIT_RESOURCE, DEPOSIT_TYPES } from "../../constants/map/deposit-positions";
import { DEFAULT_MACHINE_PRIORITY } from "../../constants/energy/energy-balance";
import { cellKey } from "../../utils/cell-key";
import { placeAsset } from "../../asset-mutation";
import { decideAutoMinerPlacementEligibility } from "../../decisions/build-auto-miner-placement-eligibility";
import { getNearestWarehouseId } from "../../../buildings/warehouse/warehouse-assignment";
import { type BuildingPlacementIoDeps } from "./shared";
import {
  getAutoSmelterFootprintDimensions,
  checkAutoSmelterFootprintEligibility,
  computeAutoSmelterConnectorPreflight,
  finalizePlacement,
} from "./place-building-shared";

export interface SpecialMachinePlacementContext {
  state: GameState;
  bType: "auto_miner" | "auto_smelter" | "auto_assembler";
  useConstructionSite: boolean;
  applyCostOrConstructionSite: (partial: GameState, assetId: string) => GameState;
  makeId: BuildingPlacementIoDeps["makeId"];
  addErrorNotification: BuildingPlacementIoDeps["addErrorNotification"];
  debugLog: BuildingPlacementIoDeps["debugLog"];
}

export function placeAutoMinerBranch(
  ctx: SpecialMachinePlacementContext,
  x: number,
  y: number,
  direction: Direction,
): GameState {
  const { state, useConstructionSite, applyCostOrConstructionSite, makeId, addErrorNotification, debugLog } = ctx;
  const autoMinerEligibilityDecision = decideAutoMinerPlacementEligibility({
    x,
    y,
    cellMap: state.cellMap,
    assets: state.assets,
    autoMiners: state.autoMiners,
    depositTypes: DEPOSIT_TYPES,
  });
  if (autoMinerEligibilityDecision.kind === "blocked") {
    if (autoMinerEligibilityDecision.blockReason === "deposit_already_has_auto_miner") {
      return {
        ...state,
        notifications: addErrorNotification(
          state.notifications,
          "Dieses Vorkommen hat bereits einen Auto-Miner.",
        ),
      };
    }
    return { ...state, notifications: addErrorNotification(state.notifications, "Auto-Miner kann nur auf einem Ressourcenvorkommen platziert werden.") };
  }

  const depositAssetId = state.cellMap[cellKey(x, y)];
  const depositAsset = state.assets[depositAssetId];
  const minerId = makeId();
  const newAssets = {
    ...state.assets,
    [minerId]: {
      id: minerId,
      type: "auto_miner" as AssetType,
      x,
      y,
      size: 1 as const,
      direction,
      priority: DEFAULT_MACHINE_PRIORITY,
    },
  };
  const newCellMap = { ...state.cellMap, [cellKey(x, y)]: minerId };
  const resource = DEPOSIT_RESOURCE[depositAsset.type];
  const newAutoMiners = { ...state.autoMiners, [minerId]: { depositId: depositAssetId, resource, progress: 0 } };
  debugLog.building(`[BuildMode] Placed Auto-Miner at (${x},${y}) on ${depositAsset.type}${useConstructionSite ? " as construction site" : ""}`);
  let partialM = applyCostOrConstructionSite(
    { ...state, assets: newAssets, cellMap: newCellMap, autoMiners: newAutoMiners },
    minerId,
  );
  const nearestWhId = getNearestWarehouseId(partialM, x, y);
  if (nearestWhId) {
    partialM = { ...partialM, buildingSourceWarehouseIds: { ...partialM.buildingSourceWarehouseIds, [minerId]: nearestWhId } };
  }
  return finalizePlacement(partialM, "BUILD_PLACE_BUILDING", debugLog);
}

export function placeAutoSmelterBranch(
  ctx: SpecialMachinePlacementContext,
  x: number,
  y: number,
  direction: Direction,
): GameState {
  const { state, bType, useConstructionSite, applyCostOrConstructionSite, addErrorNotification, debugLog } = ctx;
  const { width, height } = getAutoSmelterFootprintDimensions(direction);

  const footprintEligibilityDecision = checkAutoSmelterFootprintEligibility({
    x,
    y,
    width,
    height,
    dir: direction,
    cellMap: state.cellMap,
  });
  if (footprintEligibilityDecision.kind === "blocked") {
    if (footprintEligibilityDecision.blockReason === "out_of_bounds") {
      return { ...state, notifications: addErrorNotification(state.notifications, "Kein Platz für Auto Smelter.") };
    }
    return { ...state, notifications: addErrorNotification(state.notifications, "Das Feld ist belegt.") };
  }

  const connectorPreflight = computeAutoSmelterConnectorPreflight({
    x,
    y,
    width,
    height,
    dir: direction,
    cellMap: state.cellMap,
    assets: state.assets,
  });
  if (import.meta.env.DEV) {
    console.log("[Smelter] Input-Tile:", connectorPreflight.ioCells.input);
    console.log("[Smelter] Output-Tile:", connectorPreflight.ioCells.output);
    console.log("[Smelter] Förderband erkannt:", connectorPreflight.beltFound, {
      inputType: connectorPreflight.neighborTypes.inputType,
      outputType: connectorPreflight.neighborTypes.outputType,
    });
  }
  if (connectorPreflight.ioOutOfBounds) {
    return { ...state, notifications: addErrorNotification(state.notifications, "Input/Output-Felder liegen außerhalb der Karte.") };
  }

  const placed = placeAsset(state.assets, state.cellMap, "auto_smelter", x, y, 2, width, height);
  if (!placed) return state;
  const newAssets = {
    ...placed.assets,
    [placed.id]: {
      ...placed.assets[placed.id],
      direction,
      priority: DEFAULT_MACHINE_PRIORITY,
    },
  };
  const newAutoSmelters = {
    ...state.autoSmelters,
    [placed.id]: {
      inputBuffer: [],
      processing: null,
      pendingOutput: [],
      status: "IDLE" as AutoSmelterStatus,
      lastRecipeInput: null,
      lastRecipeOutput: null,
      throughputEvents: [],
      selectedRecipe: "iron" as const,
    },
  };
  debugLog.building(`[BuildMode] Placed Auto-Smelter at (${x},${y}) facing ${direction}${useConstructionSite ? " as construction site" : ""}`);
  const partialSmelter = applyCostOrConstructionSite(
    {
      ...state,
      assets: newAssets,
      cellMap: placed.cellMap,
      autoSmelters: newAutoSmelters,
      placedBuildings: [...state.placedBuildings, bType],
      purchasedBuildings: [...state.purchasedBuildings, bType],
    },
    placed.id,
  );
  return finalizePlacement(partialSmelter, "BUILD_PLACE_BUILDING", debugLog);
}

export function placeAutoAssemblerBranch(
  ctx: SpecialMachinePlacementContext,
  x: number,
  y: number,
  direction: Direction,
): GameState {
  const { state, bType, useConstructionSite, applyCostOrConstructionSite, addErrorNotification, debugLog } = ctx;
  const { width, height } = getAutoSmelterFootprintDimensions(direction);

  const footprintEligibilityDecision = checkAutoSmelterFootprintEligibility({
    x,
    y,
    width,
    height,
    dir: direction,
    cellMap: state.cellMap,
  });
  if (footprintEligibilityDecision.kind === "blocked") {
    if (footprintEligibilityDecision.blockReason === "out_of_bounds") {
      return { ...state, notifications: addErrorNotification(state.notifications, "Kein Platz für Auto-Assembler.") };
    }
    return { ...state, notifications: addErrorNotification(state.notifications, "Das Feld ist belegt.") };
  }

  const connectorPreflight = computeAutoSmelterConnectorPreflight({
    x,
    y,
    width,
    height,
    dir: direction,
    cellMap: state.cellMap,
    assets: state.assets,
  });
  if (connectorPreflight.ioOutOfBounds) {
    return { ...state, notifications: addErrorNotification(state.notifications, "Input/Output-Felder liegen außerhalb der Karte.") };
  }

  const placedA = placeAsset(state.assets, state.cellMap, "auto_assembler", x, y, 2, width, height);
  if (!placedA) return state;
  const newAssetsA = {
    ...placedA.assets,
    [placedA.id]: {
      ...placedA.assets[placedA.id],
      direction,
      priority: DEFAULT_MACHINE_PRIORITY,
    },
  };
  const newAutoAssemblers = {
    ...state.autoAssemblers,
    [placedA.id]: {
      ironIngotBuffer: 0,
      processing: null,
      pendingOutput: [],
      status: "IDLE" as const,
      selectedRecipe: "metal_plate" as const,
    },
  };
  debugLog.building(`[BuildMode] Placed Auto-Assembler at (${x},${y}) facing ${direction}${useConstructionSite ? " as construction site" : ""}`);
  const partialAssembler = applyCostOrConstructionSite(
    {
      ...state,
      assets: newAssetsA,
      cellMap: placedA.cellMap,
      autoAssemblers: newAutoAssemblers,
      placedBuildings: [...state.placedBuildings, bType],
      purchasedBuildings: [...state.purchasedBuildings, bType],
    },
    placedA.id,
  );
  return finalizePlacement(partialAssembler, "BUILD_PLACE_BUILDING", debugLog);
}
