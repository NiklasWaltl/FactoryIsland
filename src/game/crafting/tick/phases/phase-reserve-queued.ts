import { debugLog } from "../../../debug/debugLogger";
import type {
  Inventory,
  PlacedAsset,
  ServiceHubEntry,
} from "../../../store/types";
import type { WarehouseId } from "../../../items/types";
import { applyNetworkAction } from "../../../inventory/reservations";
import type { NetworkSlice } from "../../../inventory/reservationTypes";
import { assertTransition, sortByPriorityFifo } from "../../queue/queue";
import type { CraftingJob } from "../../types";
import {
  getGlobalHubWarehouseId,
  getJobInventorySource,
  getSourceView,
  hubInventoryToInventoryView,
} from "../hub-inventory-view";
import { pickCraftingPhysicalSourceForIngredient } from "../source-selection";
import { getReservedAmountForCraftingOwnerItem } from "../job-lifecycle";
import type { TickInput } from "../../tick";
import type { CraftingTickState } from "./types";

export function reserveQueuedPhase(
  state: CraftingTickState,
  input: TickInput,
): void {
  const queuedSorted = sortByPriorityFifo(
    state.jobs.filter((j) => j.status === "queued"),
  );
  const idIndex = new Map<string, number>();
  state.jobs.forEach((j, i) => idIndex.set(j.id, i));
  const phase2: CraftingJob[] = [...state.jobs];

  for (const job of queuedSorted) {
    const reserve = reserveQueuedJobIngredients(
      job,
      state.warehouseInventories,
      state.globalInventory,
      state.serviceHubs,
      state.network,
      input.assets,
    );
    if (!reserve.ok) {
      // Stay queued; will retry on a future tick.
      continue;
    }
    state.network = reserve.network;
    assertTransition(job.status, "reserved");
    const reserved: CraftingJob = { ...job, status: "reserved" };
    if (import.meta.env.DEV) {
      debugLog.general(`Scheduler picked job ${job.id} -> reserved`);
    }
    const idx = idIndex.get(job.id)!;
    phase2[idx] = reserved;
    state.changed = true;
  }
  state.jobs = phase2;
}

function reserveQueuedJobIngredients(
  job: CraftingJob,
  warehouseInventories: Readonly<Record<WarehouseId, Inventory>>,
  globalInventory: Inventory,
  serviceHubs: Readonly<Record<string, ServiceHubEntry>>,
  network: NetworkSlice,
  assets: Readonly<Record<string, PlacedAsset>>,
): { ok: true; network: NetworkSlice } | { ok: false } {
  const source = getJobInventorySource(job);
  if (import.meta.env.DEV) {
    debugLog.general(
      `Craft availability check for recipe ${job.recipeId} (job ${job.id})`,
    );
  }

  if (source.kind === "global") {
    const sourceView = getSourceView(
      source,
      warehouseInventories,
      globalInventory,
      serviceHubs,
    );
    const result = applyNetworkAction(
      sourceView.warehouseInventories,
      network,
      {
        type: "NETWORK_RESERVE_BATCH",
        items: job.ingredients,
        ownerKind: "crafting_job",
        ownerId: job.reservationOwnerId,
        scopeKey: sourceView.scopeKey,
      },
    );
    if (result.network.lastError) {
      if (import.meta.env.DEV) {
        debugLog.general(
          `Job ${job.id} reserve blocked for workbench ${job.workbenchId}: ${result.network.lastError.message}`,
        );
      }
      return { ok: false };
    }
    return { ok: true, network: result.network };
  }

  let nextNetwork = network;
  for (const ingredient of job.ingredients) {
    const decision = pickCraftingPhysicalSourceForIngredient({
      source,
      itemId: ingredient.itemId,
      required: ingredient.count,
      warehouseInventories,
      serviceHubs,
      network: nextNetwork,
      assets,
      preferredFromAssetId: job.workbenchId,
    });

    if (!decision.source) {
      if (import.meta.env.DEV) {
        debugLog.general(
          `Ingredient ${ingredient.itemId}: nearby warehouses insufficient` +
            (decision.status === "reserved"
              ? " (blocked by reservations)"
              : ", no fallback hub can fully supply"),
        );
        debugLog.general(
          `Enqueue rejected because: ingredient ${ingredient.itemId} unavailable for job ${job.id}`,
        );
      }
      return { ok: false };
    }

    if (import.meta.env.DEV) {
      const usedFallbackHub = decision.source.kind === "hub";
      if (usedFallbackHub) {
        debugLog.general(
          `Ingredient ${ingredient.itemId}: nearby warehouses insufficient`,
        );
        debugLog.general(
          `Ingredient ${ingredient.itemId}: fallback hub ${decision.source.hubId} available with ${decision.source.free}`,
        );
      }
      debugLog.general(
        `Reservation source chosen: ${decision.source.kind} ${
          decision.source.kind === "warehouse"
            ? decision.source.warehouseId
            : decision.source.hubId
        }`,
      );
    }

    const reservedBefore = getReservedAmountForCraftingOwnerItem(
      nextNetwork,
      job.reservationOwnerId,
      ingredient.itemId,
    );

    const scopedInventories: Record<WarehouseId, Inventory> = {};
    if (decision.source.kind === "warehouse") {
      const inventory = warehouseInventories[decision.source.warehouseId];
      if (!inventory) {
        if (import.meta.env.DEV) {
          debugLog.general(
            `Enqueue rejected because: selected warehouse ${decision.source.warehouseId} is missing`,
          );
        }
        return { ok: false };
      }
      scopedInventories[decision.source.warehouseId] = inventory;
    } else {
      const hub = serviceHubs[decision.source.hubId];
      if (!hub) {
        if (import.meta.env.DEV) {
          debugLog.general(
            `Enqueue rejected because: selected fallback hub ${decision.source.hubId} is missing`,
          );
        }
        return { ok: false };
      }
      scopedInventories[getGlobalHubWarehouseId(decision.source.hubId)] =
        hubInventoryToInventoryView(hub.inventory);
    }

    const reserveResult = applyNetworkAction(scopedInventories, nextNetwork, {
      type: "NETWORK_RESERVE_BATCH",
      items: [ingredient],
      ownerKind: "crafting_job",
      ownerId: job.reservationOwnerId,
      scopeKey: decision.source.scopeKey,
    });

    if (reserveResult.network.lastError) {
      if (import.meta.env.DEV) {
        debugLog.general(
          `Enqueue rejected because: ${reserveResult.network.lastError.message} (job ${job.id}, ingredient ${ingredient.itemId})`,
        );
      }
      return { ok: false };
    }

    nextNetwork = reserveResult.network;

    if (import.meta.env.DEV) {
      const reservedAfter = getReservedAmountForCraftingOwnerItem(
        nextNetwork,
        job.reservationOwnerId,
        ingredient.itemId,
      );
      const delta = reservedAfter - reservedBefore;
      if (delta !== ingredient.count) {
        throw new Error(
          `[crafting] Invariant violated: reserve delta ${delta} does not match requested ${ingredient.count} for owner "${job.reservationOwnerId}" item "${ingredient.itemId}".`,
        );
      }
    }
  }

  if (import.meta.env.DEV) {
    debugLog.general(
      `Recipe ${job.recipeId} craftable via fallback source evaluation`,
    );
  }
  return { ok: true, network: nextNetwork };
}
