import { ALL_ITEM_IDS } from "../../items/registry";
import type { ItemId } from "../../items/types";
import { areZonesTransportCompatible } from "../../logistics/conveyor-zone";
import type { CraftingJob, WorkbenchId } from "../../crafting/types";
import type { GameState } from "../types";
import {
  assetHeight,
  cellKey,
  isWarehouseStorageAsset,
} from "./conveyor-helpers";

export type TileId = string;
export type ZoneId = string;
export type WorkbenchJob = CraftingJob;

export interface ConveyorRoutingIndex {
  readonly warehouseInputTilesByItemId: Map<ItemId, Set<TileId>>;
  readonly activeWorkbenchJobsByInputItem: Map<ItemId, WorkbenchJob[]>;
  readonly activeWorkbenchJobsByItemAndWorkbench: Map<
    ItemId,
    Map<WorkbenchId, WorkbenchJob>
  >;
  readonly zoneCompatLookup: Map<ZoneId, Set<ZoneId>>;
  readonly warehouseIdByInputTileId: Map<TileId, string>;
  readonly assetsRef: Record<string, unknown>;
}

export function buildConveyorRoutingIndex(
  state: GameState,
): ConveyorRoutingIndex {
  const warehouseInputTilesByItemId = new Map<ItemId, Set<TileId>>();
  const activeWorkbenchJobsByInputItem = new Map<ItemId, WorkbenchJob[]>();
  const activeWorkbenchJobsByItemAndWorkbench = new Map<
    ItemId,
    Map<WorkbenchId, WorkbenchJob>
  >();
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

      let jobsByWorkbench = activeWorkbenchJobsByItemAndWorkbench.get(
        ingredient.itemId,
      );
      if (!jobsByWorkbench) {
        jobsByWorkbench = new Map<WorkbenchId, WorkbenchJob>();
        activeWorkbenchJobsByItemAndWorkbench.set(
          ingredient.itemId,
          jobsByWorkbench,
        );
      }
      if (!jobsByWorkbench.has(job.workbenchId)) {
        jobsByWorkbench.set(job.workbenchId, job);
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
    activeWorkbenchJobsByItemAndWorkbench,
    zoneCompatLookup,
    warehouseIdByInputTileId,
    assetsRef: state.assets,
  };
}
