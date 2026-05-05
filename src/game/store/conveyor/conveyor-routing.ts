import { GRID_H, GRID_W } from "../../constants/grid";
import { ALL_ITEM_IDS } from "../../items/registry";
import type { ItemId } from "../../items/types";
import { areZonesTransportCompatible } from "../../logistics/conveyor-zone";
import type { CraftingJob } from "../../crafting/types";
import { CONVEYOR_TILE_CAPACITY } from "../conveyor/constants";
import { directionOffset } from "../utils/direction";
import type {
  ConveyorItem,
  ConveyorState,
  Direction,
  GameMode,
  GameState,
  Inventory,
  PlacedAsset,
  SmithyState,
} from "../types";
import {
  canAssetReceiveFromConveyorSplitterOutput,
  getConveyorMergerInputCell,
  getConveyorMergerInputSide,
  getConveyorSplitterOutputCell,
  isValidConveyorSplitterInput,
} from "./conveyor-geometry";
import {
  type SplitterRouteState,
  getSplitterRouteState,
  setSplitterLastSide,
} from "../slices/splitter-route-state";
import {
  getSplitterFilter,
  type SplitterFilterState,
} from "../slices/splitter-filter-state";

export type TileId = string;
export type ZoneId = string;
export type WorkbenchJob = CraftingJob;

/**
 * Per-LOGISTICS_TICK lookup bundle for conveyor routing decisions.
 *
 * The index is rebuilt once from the immutable tick-start GameState and then
 * shared by all conveyor target checks in that tick. Warehouse and workbench
 * routing therefore performs Map/Set lookups instead of scanning every asset
 * or job for each belt item. `null`/global zones remain implicit and are not
 * stored in `zoneCompatLookup`; they are compatible with every zone.
 */
export interface ConveyorRoutingIndex {
  /** Item id -> warehouse input tile ids that can physically receive that item. */
  readonly warehouseInputTilesByItemId: Map<ItemId, Set<TileId>>;
  /** Input item id -> active, non-terminal workbench jobs that require it. */
  readonly activeWorkbenchJobsByInputItem: Map<ItemId, WorkbenchJob[]>;
  /** Zone id -> compatible zone ids for belt handoff and destination checks. */
  readonly zoneCompatLookup: Map<ZoneId, Set<ZoneId>>;
  /** Resolves indexed warehouse input tiles back to their warehouse asset id. */
  readonly warehouseIdByInputTileId: Map<TileId, string>;
}

export function buildConveyorRoutingIndex(
  state: GameState,
): ConveyorRoutingIndex {
  const warehouseInputTilesByItemId = new Map<ItemId, Set<TileId>>();
  const activeWorkbenchJobsByInputItem = new Map<ItemId, WorkbenchJob[]>();
  const zoneCompatLookup = new Map<ZoneId, Set<ZoneId>>();
  const warehouseIdByInputTileId = new Map<TileId, string>();

  for (const itemId of ALL_ITEM_IDS) {
    warehouseInputTilesByItemId.set(itemId, new Set<TileId>());
  }

  for (const asset of Object.values(state.assets)) {
    if (!isWarehouseStorageAsset(asset)) continue;
    if (asset.status === "deconstructing") continue;

    const inputTileId = cellKey(
      asset.x,
      asset.y + assetHeight(asset),
    ) as TileId;
    warehouseIdByInputTileId.set(inputTileId, asset.id);

    for (const itemId of ALL_ITEM_IDS) {
      warehouseInputTilesByItemId.get(itemId)?.add(inputTileId);
    }
  }

  for (const job of state.crafting?.jobs ?? []) {
    if (job.status === "done" || job.status === "cancelled") continue;
    if (state.assets[job.workbenchId]?.status === "deconstructing") continue;

    for (const ingredient of job.ingredients) {
      const jobsForItem = activeWorkbenchJobsByInputItem.get(ingredient.itemId);
      if (jobsForItem) {
        jobsForItem.push(job);
      } else {
        activeWorkbenchJobsByInputItem.set(ingredient.itemId, [job]);
      }
    }
  }

  const zoneIds = new Set<ZoneId>(Object.keys(state.productionZones));
  for (const zoneId of Object.values(state.buildingZoneIds)) {
    zoneIds.add(zoneId);
  }

  for (const fromZone of zoneIds) {
    const compatibleZones = new Set<ZoneId>();
    for (const toZone of zoneIds) {
      if (areZonesTransportCompatible(fromZone, toZone)) {
        compatibleZones.add(toZone);
      }
    }
    zoneCompatLookup.set(fromZone, compatibleZones);
  }

  return {
    warehouseInputTilesByItemId,
    activeWorkbenchJobsByInputItem,
    zoneCompatLookup,
    warehouseIdByInputTileId,
  };
}

export type ConveyorTickEligibilityDecision =
  | { kind: "blocked" }
  | { kind: "ready"; conveyorAsset: PlacedAsset };

export const decideConveyorTickEligibility = (input: {
  conveyorId: string;
  assets: Record<string, PlacedAsset>;
  connectedAssetIds: readonly string[];
  poweredSet: ReadonlySet<string>;
  movedThisTick: ReadonlySet<string>;
}): ConveyorTickEligibilityDecision => {
  const { conveyorId, assets, connectedAssetIds, poweredSet, movedThisTick } =
    input;

  if (movedThisTick.has(conveyorId)) return { kind: "blocked" };

  const conveyorAsset = assets[conveyorId];
  if (!conveyorAsset) return { kind: "blocked" };
  if (conveyorAsset.status === "deconstructing") return { kind: "blocked" };

  const isConnected = connectedAssetIds.includes(conveyorId);
  const isPowered = poweredSet.has(conveyorId);
  if (!isConnected || !isPowered) return { kind: "blocked" };

  return { kind: "ready", conveyorAsset };
};

export type ConveyorTargetType =
  | "warehouse_input_tile"
  | "next_conveyor"
  | "adjacent_warehouse"
  | "workbench"
  | "smithy";

export type ConveyorTargetBlockReason =
  | "warehouse_input_tile_zone_incompatible"
  | "warehouse_input_tile_missing_inventory"
  | "warehouse_input_tile_full"
  | "next_conveyor_already_moved"
  | "next_conveyor_zone_incompatible"
  | "next_conveyor_full"
  | "adjacent_warehouse_zone_incompatible"
  | "adjacent_warehouse_missing_inventory"
  | "adjacent_warehouse_full"
  | "workbench_no_active_job"
  | "workbench_zone_incompatible"
  | "workbench_source_full"
  | "smithy_zone_incompatible"
  | "smithy_item_not_supported"
  | "smithy_full";

export type ConveyorNoTargetReason =
  | "next_tile_out_of_bounds"
  | "next_conveyor_direction_mismatch"
  | "adjacent_warehouse_input_mismatch"
  | "no_supported_target";

export type ConveyorTargetDecision =
  | {
      kind: "target";
      targetType: "next_conveyor";
      targetId: string;
      nextAssetId: string;
    }
  | {
      kind: "target";
      targetType: "workbench";
      targetId: string;
      workbenchJob: Pick<CraftingJob, "id" | "status">;
    }
  | {
      kind: "target";
      targetType: Exclude<
        ConveyorTargetType,
        "smithy" | "next_conveyor" | "workbench"
      >;
      targetId: string;
    }
  | {
      kind: "target";
      targetType: "smithy";
      targetId: string;
      smithyOreKey: "iron" | "copper";
    }
  | {
      kind: "blocked";
      targetType: "next_conveyor";
      targetId: string;
      nextAssetId: string;
      blockReason: ConveyorTargetBlockReason;
    }
  | {
      kind: "blocked";
      targetType: Exclude<ConveyorTargetType, "next_conveyor">;
      targetId: string;
      blockReason: ConveyorTargetBlockReason;
    }
  | {
      kind: "no_target";
      blockReason: ConveyorNoTargetReason;
    };

export type ConveyorTargetEligibility =
  | { eligible: true }
  | { eligible: false; blockReason: ConveyorTargetBlockReason };

export interface ConveyorTargetEligibilityCheck {
  condition: boolean;
  blockReason: ConveyorTargetBlockReason;
}

export const classifyConveyorTargetEligibility = (
  checks: ReadonlyArray<ConveyorTargetEligibilityCheck>,
): ConveyorTargetEligibility => {
  for (const check of checks) {
    if (!check.condition) {
      return { eligible: false, blockReason: check.blockReason };
    }
  }
  return { eligible: true };
};

/**
 * LOGISTICS_TICK tie-break: a belt feeding a merger from the **right** input
 * defers this tick when the **left** input belt is eligible and still routes
 * into the same merger. Left thus wins simultaneous pushes without changing
 * `decideConveyorTargetSelection` return values (deferral is applied only when
 * committing `next_conveyor` handoff).
 */
export function shouldDeferRightMergerInputToLeft(input: {
  convId: string;
  conveyorAsset: PlacedAsset;
  targetMergerId: string;
  assets: Record<string, PlacedAsset>;
  cellMap: GameState["cellMap"];
  connectedAssetIds: readonly string[];
  poweredSet: ReadonlySet<string>;
  movedThisTick: ReadonlySet<string>;
  conveyors: Record<string, ConveyorState>;
  decideRoutingFor: (
    convId: string,
    conveyorAsset: PlacedAsset,
    currentItem: ConveyorItem,
  ) => ConveyorTargetDecision;
}): boolean {
  const {
    convId,
    conveyorAsset,
    targetMergerId,
    assets,
    cellMap,
    connectedAssetIds,
    poweredSet,
    movedThisTick,
    conveyors,
    decideRoutingFor,
  } = input;

  const mergerAsset = assets[targetMergerId];
  if (
    !mergerAsset ||
    mergerAsset.type !== "conveyor_merger" ||
    mergerAsset.status === "deconstructing"
  )
    return false;
  if (getConveyorMergerInputSide(conveyorAsset, mergerAsset) !== "right")
    return false;

  const leftInputCell = getConveyorMergerInputCell(mergerAsset, "left");
  const leftInputId =
    cellMap[cellKey(leftInputCell.x, leftInputCell.y)] ?? null;
  if (!leftInputId || leftInputId === convId) return false;

  const leftAsset = assets[leftInputId];
  if (!leftAsset) return false;
  if (leftAsset.status === "deconstructing") return false;

  const leftQueue = conveyors[leftInputId]?.queue ?? [];
  const leftItem = leftQueue[0] ?? null;
  if (!leftItem) return false;

  const leftPreflight = decideConveyorTickEligibility({
    conveyorId: leftInputId,
    movedThisTick,
    assets,
    connectedAssetIds,
    poweredSet,
  });
  if (leftPreflight.kind === "blocked") return false;

  const leftRoutingDecision = decideRoutingFor(
    leftInputId,
    leftPreflight.conveyorAsset,
    leftItem,
  );

  return (
    leftRoutingDecision.kind === "target" &&
    leftRoutingDecision.targetType === "next_conveyor" &&
    leftRoutingDecision.nextAssetId === targetMergerId
  );
}

export interface DecideConveyorTargetSelectionInput<TSource = unknown> {
  state: GameState;
  liveState: GameState;
  convId: string;
  convAsset: PlacedAsset;
  currentItem: ConveyorItem;
  conveyors: Record<string, ConveyorState>;
  warehouseInventories: Record<string, Inventory>;
  smithy: SmithyState;
  movedThisTick: ReadonlySet<string>;
  isValidWarehouseInput: (
    entityX: number,
    entityY: number,
    entityDir: Direction,
    warehouse: PlacedAsset,
  ) => boolean;
  resolveBuildingSource: (
    state: GameState,
    buildingId: string | null,
  ) => TSource;
  getCraftingSourceInventory: (state: GameState, source: TSource) => Inventory;
  getSourceCapacity: (state: GameState, source: TSource) => number;
  getWarehouseCapacity: (mode: GameMode) => number;
  /** Optional override for the splitter Round-Robin state. Falls back to module singleton. */
  splitterRouteState?: SplitterRouteState;
  /** Optional override for persisted per-splitter output filters. */
  splitterFilterState?: SplitterFilterState;
  /** Precomputed per-tick routing lookup. Omitted callers keep legacy API compatibility. */
  routingIndex?: ConveyorRoutingIndex;
}

export const decideConveyorTargetSelection = <TSource>(
  input: DecideConveyorTargetSelectionInput<TSource>,
): ConveyorTargetDecision => {
  const routingIndex =
    input.routingIndex ?? buildConveyorRoutingIndex(input.state);
  const convZone = input.state.buildingZoneIds[input.convId] ?? null;
  const itemKey = input.currentItem as keyof Inventory;
  const warehouseCapacity = input.getWarehouseCapacity(input.state.mode);

  // Priority 1: conveyor stands directly on a warehouse input tile.
  const convTileId = cellKey(input.convAsset.x, input.convAsset.y) as TileId;
  const warehouseInputTiles = routingIndex.warehouseInputTilesByItemId.get(
    input.currentItem,
  );
  const warehouseInputTargetId = warehouseInputTiles?.has(convTileId)
    ? (routingIndex.warehouseIdByInputTileId.get(convTileId) ?? null)
    : null;
  if (warehouseInputTargetId) {
    const wAsset = input.state.assets[warehouseInputTargetId];
    if (isWarehouseStorageAsset(wAsset) && wAsset.status !== "deconstructing") {
      const whZone =
        input.state.buildingZoneIds[warehouseInputTargetId] ?? null;
      const whInv = input.warehouseInventories[warehouseInputTargetId];
      const warehouseInputEligibility = classifyConveyorTargetEligibility([
        {
          condition: areIndexedZonesCompatible(routingIndex, convZone, whZone),
          blockReason: "warehouse_input_tile_zone_incompatible",
        },
        {
          condition: !!whInv,
          blockReason: "warehouse_input_tile_missing_inventory",
        },
        {
          condition: !!whInv && (whInv[itemKey] as number) < warehouseCapacity,
          blockReason: "warehouse_input_tile_full",
        },
      ]);
      if (!warehouseInputEligibility.eligible) {
        return {
          kind: "blocked",
          targetType: "warehouse_input_tile",
          targetId: warehouseInputTargetId,
          blockReason: warehouseInputEligibility.blockReason,
        };
      }
      return {
        kind: "target",
        targetType: "warehouse_input_tile",
        targetId: warehouseInputTargetId,
      };
    }
  }

  if (input.convAsset.type === "conveyor_splitter") {
    const splitterId = input.convId;
    const routeState = input.splitterRouteState ?? getSplitterRouteState();
    const filterState =
      input.splitterFilterState ?? input.state.splitterFilterState;
    const lastSide = routeState[splitterId]?.lastSide ?? "right";
    const orderedSides: ["left", "right"] | ["right", "left"] =
      lastSide === "left" ? ["right", "left"] : ["left", "right"];

    for (const side of orderedSides) {
      const sideFilter = getSplitterFilter(filterState, splitterId, side);
      if (sideFilter !== null && sideFilter !== input.currentItem) continue;

      const arm = getConveyorSplitterOutputCell(input.convAsset, side);
      if (arm.x < 0 || arm.x >= GRID_W || arm.y < 0 || arm.y >= GRID_H)
        continue;

      const nextAssetId = input.state.cellMap[cellKey(arm.x, arm.y)] ?? null;
      const nextAsset = nextAssetId ? input.state.assets[nextAssetId] : null;
      if (
        !nextAsset ||
        nextAsset.status === "deconstructing" ||
        !canAssetReceiveFromConveyorSplitterOutput(input.convAsset, nextAsset)
      ) {
        continue;
      }

      const nextTileZone = nextAssetId
        ? (input.state.buildingZoneIds[nextAssetId] ?? null)
        : null;
      const beltToNextZoneOk = areIndexedZonesCompatible(
        routingIndex,
        convZone,
        nextTileZone,
      );
      const nextConv = input.conveyors[nextAssetId!];
      const nextQueue = nextConv?.queue ?? [];
      const nextConveyorEligibility = classifyConveyorTargetEligibility([
        {
          condition: !input.movedThisTick.has(nextAssetId!),
          blockReason: "next_conveyor_already_moved",
        },
        {
          condition: beltToNextZoneOk,
          blockReason: "next_conveyor_zone_incompatible",
        },
        {
          condition: nextQueue.length < CONVEYOR_TILE_CAPACITY,
          blockReason: "next_conveyor_full",
        },
      ]);
      if (!nextConveyorEligibility.eligible) continue;

      if (input.splitterRouteState != null) {
        input.splitterRouteState[splitterId] = { lastSide: side };
      } else {
        setSplitterLastSide(splitterId, side);
      }

      return {
        kind: "target",
        targetType: "next_conveyor",
        targetId: nextAssetId!,
        nextAssetId: nextAssetId!,
      };
    }

    return { kind: "no_target", blockReason: "no_supported_target" };
  }

  if (input.convAsset.type === "conveyor_underground_in") {
    const peerId = input.state.conveyorUndergroundPeers[input.convId] ?? null;
    if (!peerId) {
      return { kind: "no_target", blockReason: "no_supported_target" };
    }
    const peerAsset = input.state.assets[peerId];
    if (
      !peerAsset ||
      peerAsset.type !== "conveyor_underground_out" ||
      peerAsset.status === "deconstructing"
    ) {
      return { kind: "no_target", blockReason: "no_supported_target" };
    }
    const nextConv = input.conveyors[peerId];
    const nextQueue = nextConv?.queue ?? [];
    const peerZone = input.state.buildingZoneIds[peerId] ?? null;
    const beltToPeerZoneOk = areIndexedZonesCompatible(
      routingIndex,
      convZone,
      peerZone,
    );
    const peerEligibility = classifyConveyorTargetEligibility([
      {
        condition: !input.movedThisTick.has(peerId),
        blockReason: "next_conveyor_already_moved",
      },
      {
        condition: beltToPeerZoneOk,
        blockReason: "next_conveyor_zone_incompatible",
      },
      {
        condition: nextQueue.length < CONVEYOR_TILE_CAPACITY,
        blockReason: "next_conveyor_full",
      },
    ]);
    if (!peerEligibility.eligible) {
      return {
        kind: "blocked",
        targetType: "next_conveyor",
        targetId: peerId,
        nextAssetId: peerId,
        blockReason: peerEligibility.blockReason,
      };
    }
    return {
      kind: "target",
      targetType: "next_conveyor",
      targetId: peerId,
      nextAssetId: peerId,
    };
  }

  const dir = input.convAsset.direction ?? "east";
  const [ox, oy] = directionOffset(dir);
  const nextX = input.convAsset.x + ox;
  const nextY = input.convAsset.y + oy;
  if (nextX < 0 || nextX >= GRID_W || nextY < 0 || nextY >= GRID_H) {
    return { kind: "no_target", blockReason: "next_tile_out_of_bounds" };
  }

  const nextAssetId = input.state.cellMap[cellKey(nextX, nextY)] ?? null;
  const nextAsset = nextAssetId ? input.state.assets[nextAssetId] : null;

  const nextBeltCompatible =
    nextAsset?.status !== "deconstructing" &&
    (nextAsset?.type === "conveyor_corner" ||
      (nextAsset?.type === "conveyor" &&
        (nextAsset.direction ?? "east") === dir) ||
      (nextAsset?.type === "conveyor_underground_in" &&
        (nextAsset.direction ?? "east") === dir) ||
      (nextAsset?.type === "conveyor_merger" &&
        getConveyorMergerInputSide(input.convAsset, nextAsset) !== null) ||
      (nextAsset?.type === "conveyor_splitter" &&
        isValidConveyorSplitterInput(input.convAsset, nextAsset)));
  const nextTileZone = nextAssetId
    ? (input.state.buildingZoneIds[nextAssetId] ?? null)
    : null;
  const beltToNextZoneOk = areIndexedZonesCompatible(
    routingIndex,
    convZone,
    nextTileZone,
  );

  if (nextBeltCompatible) {
    const nextConveyorId = nextAssetId;
    if (!nextConveyorId) {
      return { kind: "no_target", blockReason: "no_supported_target" };
    }
    const nextConv = input.conveyors[nextConveyorId];
    const nextQueue = nextConv?.queue ?? [];
    const nextConveyorEligibility = classifyConveyorTargetEligibility([
      {
        condition: !input.movedThisTick.has(nextConveyorId),
        blockReason: "next_conveyor_already_moved",
      },
      {
        condition: beltToNextZoneOk,
        blockReason: "next_conveyor_zone_incompatible",
      },
      {
        condition: nextQueue.length < CONVEYOR_TILE_CAPACITY,
        blockReason: "next_conveyor_full",
      },
    ]);
    if (!nextConveyorEligibility.eligible) {
      return {
        kind: "blocked",
        targetType: "next_conveyor",
        targetId: nextConveyorId,
        nextAssetId: nextConveyorId,
        blockReason: nextConveyorEligibility.blockReason,
      };
    }
    return {
      kind: "target",
      targetType: "next_conveyor",
      targetId: nextConveyorId,
      nextAssetId: nextConveyorId,
    };
  }

  if (
    nextAsset?.type === "conveyor" ||
    nextAsset?.type === "conveyor_merger" ||
    nextAsset?.type === "conveyor_splitter" ||
    nextAsset?.type === "conveyor_underground_out"
  ) {
    return {
      kind: "no_target",
      blockReason: "next_conveyor_direction_mismatch",
    };
  }

  if (
    nextAsset &&
    isWarehouseStorageAsset(nextAsset) &&
    nextAsset.status !== "deconstructing"
  ) {
    if (
      !input.isValidWarehouseInput(
        input.convAsset.x,
        input.convAsset.y,
        dir,
        nextAsset,
      )
    ) {
      return {
        kind: "no_target",
        blockReason: "adjacent_warehouse_input_mismatch",
      };
    }
    const adjWhZone = input.state.buildingZoneIds[nextAsset.id] ?? null;
    const whInv = input.warehouseInventories[nextAsset.id];
    const adjacentWarehouseEligibility = classifyConveyorTargetEligibility([
      {
        condition: areIndexedZonesCompatible(routingIndex, convZone, adjWhZone),
        blockReason: "adjacent_warehouse_zone_incompatible",
      },
      {
        condition: !!whInv,
        blockReason: "adjacent_warehouse_missing_inventory",
      },
      {
        condition: !!whInv && (whInv[itemKey] as number) < warehouseCapacity,
        blockReason: "adjacent_warehouse_full",
      },
    ]);
    if (!adjacentWarehouseEligibility.eligible) {
      return {
        kind: "blocked",
        targetType: "adjacent_warehouse",
        targetId: nextAsset.id,
        blockReason: adjacentWarehouseEligibility.blockReason,
      };
    }
    return {
      kind: "target",
      targetType: "adjacent_warehouse",
      targetId: nextAsset.id,
    };
  }

  if (
    nextAsset?.type === "workbench" &&
    nextAsset.status !== "deconstructing"
  ) {
    const activeJobForWb = (
      routingIndex.activeWorkbenchJobsByInputItem.get(input.currentItem) ?? []
    ).find((job) => job.workbenchId === nextAsset.id);
    const workbenchJobEligibility = classifyConveyorTargetEligibility([
      {
        condition: !!activeJobForWb,
        blockReason: "workbench_no_active_job",
      },
    ]);
    if (!workbenchJobEligibility.eligible) {
      return {
        kind: "blocked",
        targetType: "workbench",
        targetId: nextAsset.id,
        blockReason: workbenchJobEligibility.blockReason,
      };
    }
    const wbZone = input.state.buildingZoneIds[nextAsset.id] ?? null;
    const workbenchZoneEligibility = classifyConveyorTargetEligibility([
      {
        condition: areIndexedZonesCompatible(routingIndex, convZone, wbZone),
        blockReason: "workbench_zone_incompatible",
      },
    ]);
    if (!workbenchZoneEligibility.eligible) {
      return {
        kind: "blocked",
        targetType: "workbench",
        targetId: nextAsset.id,
        blockReason: workbenchZoneEligibility.blockReason,
      };
    }
    const wbSource = input.resolveBuildingSource(input.liveState, nextAsset.id);
    const wbSourceInv = input.getCraftingSourceInventory(
      input.liveState,
      wbSource,
    );
    const wbCap = input.getSourceCapacity(input.liveState, wbSource);
    const workbenchCapacityEligibility = classifyConveyorTargetEligibility([
      {
        condition: (wbSourceInv[itemKey] as number) < wbCap,
        blockReason: "workbench_source_full",
      },
    ]);
    if (!workbenchCapacityEligibility.eligible) {
      return {
        kind: "blocked",
        targetType: "workbench",
        targetId: nextAsset.id,
        blockReason: workbenchCapacityEligibility.blockReason,
      };
    }
    return {
      kind: "target",
      targetType: "workbench",
      targetId: nextAsset.id,
      workbenchJob: { id: activeJobForWb!.id, status: activeJobForWb!.status },
    };
  }

  if (nextAsset?.type === "smithy" && nextAsset.status !== "deconstructing") {
    const smithyZone = input.state.buildingZoneIds[nextAsset.id] ?? null;
    const smithyItemSupported =
      input.currentItem === "iron" || input.currentItem === "copper";
    const oreKey = input.currentItem === "iron" ? "iron" : "copper";
    const smithyEligibility = classifyConveyorTargetEligibility([
      {
        condition: areIndexedZonesCompatible(
          routingIndex,
          convZone,
          smithyZone,
        ),
        blockReason: "smithy_zone_incompatible",
      },
      {
        condition: smithyItemSupported,
        blockReason: "smithy_item_not_supported",
      },
      {
        condition:
          !smithyItemSupported || getSmithyOreAmount(input.smithy, oreKey) < 50,
        blockReason: "smithy_full",
      },
    ]);
    if (!smithyEligibility.eligible) {
      return {
        kind: "blocked",
        targetType: "smithy",
        targetId: nextAsset.id,
        blockReason: smithyEligibility.blockReason,
      };
    }
    return {
      kind: "target",
      targetType: "smithy",
      targetId: nextAsset.id,
      smithyOreKey: oreKey,
    };
  }

  return { kind: "no_target", blockReason: "no_supported_target" };
};

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function areIndexedZonesCompatible(
  routingIndex: ConveyorRoutingIndex,
  fromZone: string | null,
  toZone: string | null,
): boolean {
  if (!fromZone || !toZone) return true;
  return routingIndex.zoneCompatLookup.get(fromZone)?.has(toZone) ?? false;
}

function getSmithyOreAmount(
  smithy: SmithyState,
  oreKey: "iron" | "copper",
): number {
  return oreKey === "iron" ? smithy.iron : smithy.copper;
}

function assetHeight(asset: Pick<PlacedAsset, "height" | "size">): number {
  return asset.height ?? asset.size;
}

function isWarehouseStorageAsset(
  asset: PlacedAsset | null | undefined,
): boolean {
  return (
    !!asset && (asset.type === "warehouse" || asset.isDockWarehouse === true)
  );
}
