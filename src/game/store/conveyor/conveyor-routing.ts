/* eslint-disable prettier/prettier */
import { GRID_H, GRID_W } from "../../constants/grid";
import { CONVEYOR_TILE_CAPACITY } from "../conveyor/constants";
import { directionOffset } from "../utils/direction";
import type { ConveyorItem, ConveyorState, Direction, GameMode, GameState, Inventory, PlacedAsset, SmithyState } from "../types";
import type { ConveyorTargetDecision } from "../types/conveyor-types";
import { canAssetReceiveFromConveyorSplitterOutput, getConveyorSplitterOutputCell } from "./conveyor-geometry";
import { type SplitterRouteState, getSplitterRouteState, setSplitterLastSide } from "../slices/splitter-route-state";
import { getSplitterFilter, type SplitterFilterState } from "../slices/splitter-filter-state";
import { blockedConveyorDestination, blockedNextConveyor, cellKey, classifyConveyorTargetEligibility, getSmithyOreAmount, isConveyorZoneCompatible, isForwardConveyorTargetCompatible, isWarehouseStorageAsset, noConveyorTarget, targetConveyorDestination, targetNextConveyor } from "./conveyor-helpers";
import { buildConveyorRoutingIndex, type ConveyorRoutingIndex, type TileId } from "./conveyor-index";

export type { ConveyorRoutingIndex, TileId, WorkbenchJob, ZoneId } from "./conveyor-index";
export { buildConveyorRoutingIndex } from "./conveyor-index";
export type { ConveyorTickEligibilityDecision } from "./conveyor-eligibility";
export { decideConveyorTickEligibility } from "./conveyor-eligibility";
export type { ConveyorTargetBlockReason, ConveyorTargetDecision, ConveyorTargetEligibility, ConveyorTargetEligibilityCheck, ConveyorTargetType, ConveyorNoTargetReason } from "../types/conveyor-types";
export { classifyConveyorTargetEligibility, shouldDeferRightMergerInputToLeft } from "./conveyor-helpers";

export type DecideConveyorTargetSelectionInput<TSource = unknown> = {
  state: GameState; liveState: GameState; convId: string; convAsset: PlacedAsset; currentItem: ConveyorItem;
  conveyors: Record<string, ConveyorState>; warehouseInventories: Record<string, Inventory>; smithy: SmithyState;
  movedThisTick: ReadonlySet<string>;
  isValidWarehouseInput: (entityX: number, entityY: number, entityDir: Direction, warehouse: PlacedAsset) => boolean;
  resolveBuildingSource: (state: GameState, buildingId: string | null) => TSource;
  getCraftingSourceInventory: (state: GameState, source: TSource) => Inventory;
  getSourceCapacity: (state: GameState, source: TSource) => number;
  getWarehouseCapacity: (mode: GameMode) => number;
  splitterRouteState?: SplitterRouteState; splitterFilterState?: SplitterFilterState; routingIndex?: ConveyorRoutingIndex;
};

export const decideRoutingFor = <TSource>(input: DecideConveyorTargetSelectionInput<TSource>): ConveyorTargetDecision => {
  const routingIndex = input.routingIndex ?? buildConveyorRoutingIndex(input.state);
  const convZone = input.state.buildingZoneIds[input.convId] ?? null;
  const itemKey = input.currentItem as keyof Inventory;
  const warehouseCapacity = input.getWarehouseCapacity(input.state.mode);
  const zoneOk = (assetId: string) => isConveyorZoneCompatible(routingIndex, convZone, input.state.buildingZoneIds[assetId] ?? null);
  const nextConveyorEligibility = (targetId: string) => {
    const nextQueue = input.conveyors[targetId]?.queue ?? [];
    return classifyConveyorTargetEligibility([
      { condition: !input.movedThisTick.has(targetId), blockReason: "next_conveyor_already_moved" },
      { condition: zoneOk(targetId), blockReason: "next_conveyor_zone_incompatible" },
      { condition: nextQueue.length < CONVEYOR_TILE_CAPACITY, blockReason: "next_conveyor_full" },
    ]);
  };
  const nextConveyorDecision = (targetId: string) => {
    const eligibility = nextConveyorEligibility(targetId);
    return eligibility.eligible ? targetNextConveyor(targetId) : blockedNextConveyor(targetId, eligibility.blockReason);
  };

  const convTileId = cellKey(input.convAsset.x, input.convAsset.y) as TileId;
  const warehouseInputTiles = routingIndex.warehouseInputTilesByItemId.get(input.currentItem);
  const warehouseInputTargetId = warehouseInputTiles?.has(convTileId) ? (routingIndex.warehouseIdByInputTileId.get(convTileId) ?? null) : null;
  if (warehouseInputTargetId) {
    const warehouseAsset = input.state.assets[warehouseInputTargetId];
    if (isWarehouseStorageAsset(warehouseAsset) && warehouseAsset.status !== "deconstructing") {
      const whInv = input.warehouseInventories[warehouseInputTargetId];
      const eligibility = classifyConveyorTargetEligibility([
        { condition: zoneOk(warehouseInputTargetId), blockReason: "warehouse_input_tile_zone_incompatible" },
        { condition: !!whInv, blockReason: "warehouse_input_tile_missing_inventory" },
        { condition: !!whInv && (whInv[itemKey] as number) < warehouseCapacity, blockReason: "warehouse_input_tile_full" },
      ]);
      return eligibility.eligible ? targetConveyorDestination("warehouse_input_tile", warehouseInputTargetId) : blockedConveyorDestination("warehouse_input_tile", warehouseInputTargetId, eligibility.blockReason);
    }
  }

  if (input.convAsset.type === "conveyor_splitter") {
    const splitterId = input.convId;
    const routeState = input.splitterRouteState ?? getSplitterRouteState();
    const filterState = input.splitterFilterState ?? input.state.splitterFilterState;
    const orderedSides: ["left", "right"] | ["right", "left"] = routeState[splitterId]?.lastSide === "left" ? ["right", "left"] : ["left", "right"];
    for (const side of orderedSides) {
      const sideFilter = getSplitterFilter(filterState, splitterId, side);
      if (sideFilter !== null && sideFilter !== input.currentItem) continue;
      const arm = getConveyorSplitterOutputCell(input.convAsset, side);
      if (arm.x < 0 || arm.x >= GRID_W || arm.y < 0 || arm.y >= GRID_H) continue;
      const nextAssetId = input.state.cellMap[cellKey(arm.x, arm.y)] ?? null;
      if (!nextAssetId) continue;
      const nextAsset = input.state.assets[nextAssetId];
      if (!nextAsset || nextAsset.status === "deconstructing" || !canAssetReceiveFromConveyorSplitterOutput(input.convAsset, nextAsset)) continue;
      const eligibility = nextConveyorEligibility(nextAssetId);
      if (!eligibility.eligible) continue;
      if (input.splitterRouteState != null) input.splitterRouteState[splitterId] = { lastSide: side };
      else setSplitterLastSide(splitterId, side);
      return targetNextConveyor(nextAssetId);
    }
    return noConveyorTarget("no_supported_target");
  }

  if (input.convAsset.type === "conveyor_underground_in") {
    const peerId = input.state.conveyorUndergroundPeers[input.convId] ?? null;
    const peerAsset = peerId ? input.state.assets[peerId] : null;
    if (!peerId || !peerAsset || peerAsset.type !== "conveyor_underground_out" || peerAsset.status === "deconstructing") return noConveyorTarget("no_supported_target");
    return nextConveyorDecision(peerId);
  }

  const dir = input.convAsset.direction ?? "east";
  const [ox, oy] = directionOffset(dir);
  const nextX = input.convAsset.x + ox;
  const nextY = input.convAsset.y + oy;
  if (nextX < 0 || nextX >= GRID_W || nextY < 0 || nextY >= GRID_H) return noConveyorTarget("next_tile_out_of_bounds");
  const nextAssetId = input.state.cellMap[cellKey(nextX, nextY)] ?? null;
  const nextAsset = nextAssetId ? input.state.assets[nextAssetId] : null;
  if (isForwardConveyorTargetCompatible(input.convAsset, nextAsset, dir)) return nextAssetId ? nextConveyorDecision(nextAssetId) : noConveyorTarget("no_supported_target");
  if (nextAsset?.type === "conveyor" || nextAsset?.type === "conveyor_merger" || nextAsset?.type === "conveyor_splitter" || nextAsset?.type === "conveyor_underground_out") return noConveyorTarget("next_conveyor_direction_mismatch");

  if (nextAsset && isWarehouseStorageAsset(nextAsset) && nextAsset.status !== "deconstructing") {
    if (!input.isValidWarehouseInput(input.convAsset.x, input.convAsset.y, dir, nextAsset)) return noConveyorTarget("adjacent_warehouse_input_mismatch");
    const whInv = input.warehouseInventories[nextAsset.id];
    const eligibility = classifyConveyorTargetEligibility([
      { condition: zoneOk(nextAsset.id), blockReason: "adjacent_warehouse_zone_incompatible" },
      { condition: !!whInv, blockReason: "adjacent_warehouse_missing_inventory" },
      { condition: !!whInv && (whInv[itemKey] as number) < warehouseCapacity, blockReason: "adjacent_warehouse_full" },
    ]);
    return eligibility.eligible ? targetConveyorDestination("adjacent_warehouse", nextAsset.id) : blockedConveyorDestination("adjacent_warehouse", nextAsset.id, eligibility.blockReason);
  }

  if (nextAsset?.type === "workbench" && nextAsset.status !== "deconstructing") {
    const activeJobForWb = routingIndex.activeWorkbenchJobsByItemAndWorkbench.get(input.currentItem)?.get(nextAsset.id) ?? null;
    const eligibility = classifyConveyorTargetEligibility([
      { condition: !!activeJobForWb, blockReason: "workbench_no_active_job" },
      { condition: zoneOk(nextAsset.id), blockReason: "workbench_zone_incompatible" },
    ]);
    if (!eligibility.eligible) return blockedConveyorDestination("workbench", nextAsset.id, eligibility.blockReason);
    const wbSource = input.resolveBuildingSource(input.liveState, nextAsset.id);
    const wbSourceInv = input.getCraftingSourceInventory(input.liveState, wbSource);
    const wbCap = input.getSourceCapacity(input.liveState, wbSource);
    const capacityEligibility = classifyConveyorTargetEligibility([{ condition: (wbSourceInv[itemKey] as number) < wbCap, blockReason: "workbench_source_full" }]);
    if (!capacityEligibility.eligible) return blockedConveyorDestination("workbench", nextAsset.id, capacityEligibility.blockReason);
    return { kind: "target", targetType: "workbench", targetId: nextAsset.id, workbenchJob: { id: activeJobForWb!.id, status: activeJobForWb!.status } };
  }

  if (nextAsset?.type === "smithy" && nextAsset.status !== "deconstructing") {
    const smithyItemSupported = input.currentItem === "iron" || input.currentItem === "copper";
    const oreKey = input.currentItem === "iron" ? "iron" : "copper";
    const eligibility = classifyConveyorTargetEligibility([
      { condition: zoneOk(nextAsset.id), blockReason: "smithy_zone_incompatible" },
      { condition: smithyItemSupported, blockReason: "smithy_item_not_supported" },
      { condition: !smithyItemSupported || getSmithyOreAmount(input.smithy, oreKey) < 50, blockReason: "smithy_full" },
    ]);
    return eligibility.eligible ? { kind: "target", targetType: "smithy", targetId: nextAsset.id, smithyOreKey: oreKey } : blockedConveyorDestination("smithy", nextAsset.id, eligibility.blockReason);
  }

  return noConveyorTarget("no_supported_target");
};

export const decideConveyorRouting = decideRoutingFor;
export const decideConveyorTargetSelection = decideConveyorRouting;