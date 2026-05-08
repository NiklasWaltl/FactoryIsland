/* eslint-disable prettier/prettier */
import { GRID_H, GRID_W } from "../../constants/grid";
import { cellKey, isWarehouseStorageAsset } from "../../logistics/common/index-utils";
import { CONVEYOR_TILE_CAPACITY } from "../conveyor/constants";
import { directionOffset } from "../utils/direction";
import type { ConveyorItem, ConveyorState, Direction, GameMode, GameState, Inventory, PlacedAsset, SmithyState } from "../types";
import type { ConveyorNoTargetReason, ConveyorTargetBlockReason, ConveyorTargetDecision, ConveyorTargetType } from "../types/conveyor-types";
import { canAssetReceiveFromConveyorSplitterOutput, getConveyorMergerInputCell, getConveyorMergerInputSide, getConveyorSplitterOutputCell, isValidConveyorSplitterInput } from "./conveyor-geometry";
import { type SplitterRouteState, getSplitterRouteState, setSplitterLastSide } from "../slices/splitter-route-state";
import { getSplitterFilter, type SplitterFilterState } from "../slices/splitter-filter-state";
import { classifyConveyorTargetEligibility, getSmithyOreAmount, isConveyorZoneCompatible } from "./conveyor-helpers";
import { buildConveyorRoutingIndex, type ConveyorRoutingIndex, type TileId } from "./conveyor-index";
import { decideConveyorTickEligibility } from "./conveyor-eligibility";

export type { ConveyorRoutingIndex, TileId, WorkbenchJob, ZoneId } from "./conveyor-index";
export { buildConveyorRoutingIndex } from "./conveyor-index";
export type { ConveyorTickEligibilityDecision } from "./conveyor-eligibility";
export { decideConveyorTickEligibility } from "./conveyor-eligibility";
export type { ConveyorTargetBlockReason, ConveyorTargetDecision, ConveyorTargetEligibility, ConveyorTargetEligibilityCheck, ConveyorTargetType, ConveyorNoTargetReason } from "../types/conveyor-types";
export { classifyConveyorTargetEligibility } from "./conveyor-helpers";

type SimpleConveyorTargetType = Exclude<ConveyorTargetType, "smithy" | "next_conveyor" | "workbench">;
type BlockableConveyorTargetType = Exclude<ConveyorTargetType, "next_conveyor">;

function noConveyorTarget(blockReason: ConveyorNoTargetReason): ConveyorTargetDecision {
  return { kind: "no_target", blockReason };
}

function targetNextConveyor(targetId: string): ConveyorTargetDecision {
  return { kind: "target", targetType: "next_conveyor", targetId, nextAssetId: targetId };
}

function blockedNextConveyor(targetId: string, blockReason: ConveyorTargetBlockReason): ConveyorTargetDecision {
  return { kind: "blocked", targetType: "next_conveyor", targetId, nextAssetId: targetId, blockReason };
}

function targetConveyorDestination(targetType: SimpleConveyorTargetType, targetId: string): ConveyorTargetDecision {
  return { kind: "target", targetType, targetId };
}

function blockedConveyorDestination(targetType: BlockableConveyorTargetType, targetId: string, blockReason: ConveyorTargetBlockReason): ConveyorTargetDecision {
  return { kind: "blocked", targetType, targetId, blockReason };
}

function isForwardConveyorTargetCompatible(fromAsset: PlacedAsset, nextAsset: PlacedAsset | null, direction: Direction): boolean {
  return (
    nextAsset?.status !== "deconstructing" &&
    (nextAsset?.type === "conveyor_corner" ||
      (nextAsset?.type === "conveyor" && (nextAsset.direction ?? "east") === direction) ||
      (nextAsset?.type === "conveyor_underground_in" && (nextAsset.direction ?? "east") === direction) ||
      (nextAsset?.type === "conveyor_merger" && getConveyorMergerInputSide(fromAsset, nextAsset) !== null) ||
      (nextAsset?.type === "conveyor_splitter" && isValidConveyorSplitterInput(fromAsset, nextAsset)))
  );
}

export function shouldDeferRightMergerInputToLeft(input: {
  convId: string;
  conveyorAsset: PlacedAsset;
  targetMergerId: string;
  assets: Record<string, PlacedAsset>;
  cellMap: GameState["cellMap"];
  connectedSet: ReadonlySet<string>;
  poweredSet: ReadonlySet<string>;
  movedThisTick: ReadonlySet<string>;
  conveyors: Record<string, ConveyorState>;
  decideRoutingFor: (convId: string, conveyorAsset: PlacedAsset, currentItem: ConveyorItem) => ConveyorTargetDecision;
}): boolean {
  const { convId, conveyorAsset, targetMergerId, assets, cellMap, connectedSet, poweredSet, movedThisTick, conveyors, decideRoutingFor } = input;
  const mergerAsset = assets[targetMergerId];
  if (!mergerAsset || mergerAsset.type !== "conveyor_merger" || mergerAsset.status === "deconstructing") return false;
  if (getConveyorMergerInputSide(conveyorAsset, mergerAsset) !== "right") return false;
  const leftInputCell = getConveyorMergerInputCell(mergerAsset, "left");
  const leftInputId = cellMap[cellKey(leftInputCell.x, leftInputCell.y)] ?? null;
  if (!leftInputId || leftInputId === convId) return false;
  const leftAsset = assets[leftInputId];
  if (!leftAsset || leftAsset.status === "deconstructing") return false;
  const leftItem = conveyors[leftInputId]?.queue?.[0] ?? null;
  if (!leftItem) return false;
  const leftPreflight = decideConveyorTickEligibility({ conveyorId: leftInputId, movedThisTick, assets, connectedSet, poweredSet });
  if (leftPreflight.kind === "blocked") return false;
  const leftRoutingDecision = decideRoutingFor(leftInputId, leftPreflight.conveyorAsset, leftItem);
  return leftRoutingDecision.kind === "target" && leftRoutingDecision.targetType === "next_conveyor" && leftRoutingDecision.nextAssetId === targetMergerId;
}

export type ConveyorRoutingStateSnapshot = {
  state: GameState; liveState: GameState; convId: string; convAsset: PlacedAsset; currentItem: ConveyorItem;
  conveyors: Record<string, ConveyorState>; warehouseInventories: Record<string, Inventory>; smithy: SmithyState; movedThisTick: ReadonlySet<string>;
};

export type ConveyorRoutingDeps<TSource = unknown> = {
  isValidWarehouseInput: (entityX: number, entityY: number, entityDir: Direction, warehouse: PlacedAsset) => boolean;
  resolveBuildingSource: (state: GameState, buildingId: string | null) => TSource;
  getCraftingSourceInventory: (state: GameState, source: TSource) => Inventory;
  getSourceCapacity: (state: GameState, source: TSource) => number;
  getWarehouseCapacity: (mode: GameMode) => number;
  splitterRouteState?: SplitterRouteState; splitterFilterState?: SplitterFilterState; routingIndex?: ConveyorRoutingIndex;
};

export type DecideConveyorTargetSelectionInput<TSource = unknown> = ConveyorRoutingStateSnapshot & ConveyorRoutingDeps<TSource>;

function splitDecideConveyorTargetSelectionInput<TSource>(input: DecideConveyorTargetSelectionInput<TSource>): { stateSnapshot: ConveyorRoutingStateSnapshot; deps: ConveyorRoutingDeps<TSource> } {
  const stateSnapshot: ConveyorRoutingStateSnapshot = {
    state: input.state,
    liveState: input.liveState,
    convId: input.convId,
    convAsset: input.convAsset,
    currentItem: input.currentItem,
    conveyors: input.conveyors,
    warehouseInventories: input.warehouseInventories,
    smithy: input.smithy,
    movedThisTick: input.movedThisTick,
  };
  const deps: ConveyorRoutingDeps<TSource> = {
    isValidWarehouseInput: input.isValidWarehouseInput,
    resolveBuildingSource: input.resolveBuildingSource,
    getCraftingSourceInventory: input.getCraftingSourceInventory,
    getSourceCapacity: input.getSourceCapacity,
    getWarehouseCapacity: input.getWarehouseCapacity,
    splitterRouteState: input.splitterRouteState,
    splitterFilterState: input.splitterFilterState,
    routingIndex: input.routingIndex,
  };
  return { stateSnapshot, deps };
}

export function decideConveyorTargetSelection<TSource>(stateSnapshot: ConveyorRoutingStateSnapshot, deps: ConveyorRoutingDeps<TSource>): ConveyorTargetDecision;
export function decideConveyorTargetSelection<TSource>(input: DecideConveyorTargetSelectionInput<TSource>): ConveyorTargetDecision;
export function decideConveyorTargetSelection<TSource>(
  stateSnapshotOrInput: ConveyorRoutingStateSnapshot | DecideConveyorTargetSelectionInput<TSource>,
  depsArg?: ConveyorRoutingDeps<TSource>,
): ConveyorTargetDecision {
  const { stateSnapshot, deps } = depsArg
    ? { stateSnapshot: stateSnapshotOrInput as ConveyorRoutingStateSnapshot, deps: depsArg }
    : splitDecideConveyorTargetSelectionInput(stateSnapshotOrInput as DecideConveyorTargetSelectionInput<TSource>);

  const state = stateSnapshot.state;
  const liveState = stateSnapshot.liveState;
  const { convId, convAsset, currentItem, conveyors, warehouseInventories, smithy, movedThisTick } = stateSnapshot;
  const { isValidWarehouseInput, resolveBuildingSource, getCraftingSourceInventory, getSourceCapacity, getWarehouseCapacity, splitterRouteState, splitterFilterState } = deps;
  const routingIndex = deps.routingIndex ?? buildConveyorRoutingIndex(state);
  const convZone = state.buildingZoneIds[convId] ?? null;
  const itemKey = currentItem as keyof Inventory;
  const warehouseCapacity = getWarehouseCapacity(state.mode);
  const zoneOk = (assetId: string) => isConveyorZoneCompatible(routingIndex, convZone, state.buildingZoneIds[assetId] ?? null);
  const nextConveyorEligibility = (targetId: string) => {
    const nextQueue = conveyors[targetId]?.queue ?? [];
    return classifyConveyorTargetEligibility([
      { condition: !movedThisTick.has(targetId), blockReason: "next_conveyor_already_moved" },
      { condition: zoneOk(targetId), blockReason: "next_conveyor_zone_incompatible" },
      { condition: nextQueue.length < CONVEYOR_TILE_CAPACITY, blockReason: "next_conveyor_full" },
    ]);
  };
  const nextConveyorDecision = (targetId: string) => {
    const eligibility = nextConveyorEligibility(targetId);
    return eligibility.eligible ? targetNextConveyor(targetId) : blockedNextConveyor(targetId, eligibility.blockReason);
  };

  const convTileId = cellKey(convAsset.x, convAsset.y) as TileId;
  const warehouseInputTiles = routingIndex.warehouseInputTilesByItemId.get(currentItem);
  const warehouseInputTargetId = warehouseInputTiles?.has(convTileId) ? (routingIndex.warehouseIdByInputTileId.get(convTileId) ?? null) : null;
  if (warehouseInputTargetId) {
    const warehouseAsset = state.assets[warehouseInputTargetId];
    if (isWarehouseStorageAsset(warehouseAsset) && warehouseAsset.status !== "deconstructing") {
      const whInv = warehouseInventories[warehouseInputTargetId];
      const eligibility = classifyConveyorTargetEligibility([
        { condition: zoneOk(warehouseInputTargetId), blockReason: "warehouse_input_tile_zone_incompatible" },
        { condition: !!whInv, blockReason: "warehouse_input_tile_missing_inventory" },
        { condition: !!whInv && (whInv[itemKey] as number) < warehouseCapacity, blockReason: "warehouse_input_tile_full" },
      ]);
      return eligibility.eligible ? targetConveyorDestination("warehouse_input_tile", warehouseInputTargetId) : blockedConveyorDestination("warehouse_input_tile", warehouseInputTargetId, eligibility.blockReason);
    }
  }

  if (convAsset.type === "conveyor_splitter") {
    const splitterId = convId;
    const routeState = splitterRouteState ?? getSplitterRouteState();
    const filterState = splitterFilterState ?? state.splitterFilterState;
    const orderedSides: ["left", "right"] | ["right", "left"] = routeState[splitterId]?.lastSide === "left" ? ["right", "left"] : ["left", "right"];
    for (const side of orderedSides) {
      const sideFilter = getSplitterFilter(filterState, splitterId, side);
      if (sideFilter !== null && sideFilter !== currentItem) continue;
      const arm = getConveyorSplitterOutputCell(convAsset, side);
      if (arm.x < 0 || arm.x >= GRID_W || arm.y < 0 || arm.y >= GRID_H) continue;
      const nextAssetId = state.cellMap[cellKey(arm.x, arm.y)] ?? null;
      if (!nextAssetId) continue;
      const nextAsset = state.assets[nextAssetId];
      if (!nextAsset || nextAsset.status === "deconstructing" || !canAssetReceiveFromConveyorSplitterOutput(convAsset, nextAsset)) continue;
      const eligibility = nextConveyorEligibility(nextAssetId);
      if (!eligibility.eligible) continue;
      if (splitterRouteState != null) splitterRouteState[splitterId] = { lastSide: side };
      else setSplitterLastSide(splitterId, side);
      return targetNextConveyor(nextAssetId);
    }
    return noConveyorTarget("no_supported_target");
  }

  if (convAsset.type === "conveyor_underground_in") {
    const peerId = state.conveyorUndergroundPeers[convId] ?? null;
    const peerAsset = peerId ? state.assets[peerId] : null;
    if (!peerId || !peerAsset || peerAsset.type !== "conveyor_underground_out" || peerAsset.status === "deconstructing") return noConveyorTarget("no_supported_target");
    return nextConveyorDecision(peerId);
  }

  const dir = convAsset.direction ?? "east";
  const [ox, oy] = directionOffset(dir);
  const nextX = convAsset.x + ox;
  const nextY = convAsset.y + oy;
  if (nextX < 0 || nextX >= GRID_W || nextY < 0 || nextY >= GRID_H) return noConveyorTarget("next_tile_out_of_bounds");
  const nextAssetId = state.cellMap[cellKey(nextX, nextY)] ?? null;
  const nextAsset = nextAssetId ? state.assets[nextAssetId] : null;
  if (isForwardConveyorTargetCompatible(convAsset, nextAsset, dir)) return nextAssetId ? nextConveyorDecision(nextAssetId) : noConveyorTarget("no_supported_target");
  if (nextAsset?.type === "conveyor" || nextAsset?.type === "conveyor_merger" || nextAsset?.type === "conveyor_splitter" || nextAsset?.type === "conveyor_underground_out") return noConveyorTarget("next_conveyor_direction_mismatch");

  if (nextAsset && isWarehouseStorageAsset(nextAsset) && nextAsset.status !== "deconstructing") {
    if (!isValidWarehouseInput(convAsset.x, convAsset.y, dir, nextAsset)) return noConveyorTarget("adjacent_warehouse_input_mismatch");
    const whInv = warehouseInventories[nextAsset.id];
    const eligibility = classifyConveyorTargetEligibility([
      { condition: zoneOk(nextAsset.id), blockReason: "adjacent_warehouse_zone_incompatible" },
      { condition: !!whInv, blockReason: "adjacent_warehouse_missing_inventory" },
      { condition: !!whInv && (whInv[itemKey] as number) < warehouseCapacity, blockReason: "adjacent_warehouse_full" },
    ]);
    return eligibility.eligible ? targetConveyorDestination("adjacent_warehouse", nextAsset.id) : blockedConveyorDestination("adjacent_warehouse", nextAsset.id, eligibility.blockReason);
  }

  if (nextAsset?.type === "workbench" && nextAsset.status !== "deconstructing") {
    const activeJobForWb = routingIndex.activeWorkbenchJobsByItemAndWorkbench.get(currentItem)?.get(nextAsset.id) ?? null;
    const eligibility = classifyConveyorTargetEligibility([
      { condition: !!activeJobForWb, blockReason: "workbench_no_active_job" },
      { condition: zoneOk(nextAsset.id), blockReason: "workbench_zone_incompatible" },
    ]);
    if (!eligibility.eligible) return blockedConveyorDestination("workbench", nextAsset.id, eligibility.blockReason);
    const wbSource = resolveBuildingSource(liveState, nextAsset.id);
    const wbSourceInv = getCraftingSourceInventory(liveState, wbSource);
    const wbCap = getSourceCapacity(liveState, wbSource);
    const capacityEligibility = classifyConveyorTargetEligibility([{ condition: (wbSourceInv[itemKey] as number) < wbCap, blockReason: "workbench_source_full" }]);
    if (!capacityEligibility.eligible) return blockedConveyorDestination("workbench", nextAsset.id, capacityEligibility.blockReason);
    return { kind: "target", targetType: "workbench", targetId: nextAsset.id, workbenchJob: { id: activeJobForWb!.id, status: activeJobForWb!.status } };
  }

  if (nextAsset?.type === "smithy" && nextAsset.status !== "deconstructing") {
    const smithyItemSupported = currentItem === "iron" || currentItem === "copper";
    const oreKey = currentItem === "iron" ? "iron" : "copper";
    const eligibility = classifyConveyorTargetEligibility([
      { condition: zoneOk(nextAsset.id), blockReason: "smithy_zone_incompatible" },
      { condition: smithyItemSupported, blockReason: "smithy_item_not_supported" },
      { condition: !smithyItemSupported || getSmithyOreAmount(smithy, oreKey) < 50, blockReason: "smithy_full" },
    ]);
    return eligibility.eligible ? { kind: "target", targetType: "smithy", targetId: nextAsset.id, smithyOreKey: oreKey } : blockedConveyorDestination("smithy", nextAsset.id, eligibility.blockReason);
  }

  return noConveyorTarget("no_supported_target");
}

export const decideRoutingFor = <TSource>(input: DecideConveyorTargetSelectionInput<TSource>): ConveyorTargetDecision => {
  const { stateSnapshot, deps } = splitDecideConveyorTargetSelectionInput(input);
  return decideConveyorTargetSelection(stateSnapshot, deps);
};

export const decideConveyorRouting = decideRoutingFor;