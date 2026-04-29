// ============================================================
// Factory Island - Crafting Tick Scheduler (Step 3)
// ------------------------------------------------------------
// Pure-ish state transition: given (warehouseInventories,
// network slice, crafting queue, assets), advance every job
// by exactly one tick. No I/O, no globals, no Date.now() except
// for informational `startedAt` / `finishesAt`.
//
// Three phases per tick — strict, deterministic order:
//   1. Progress active `crafting` jobs (commit ingredients + delivering)
//   2. Promote `queued` jobs that can reserve their ingredients
//      → `reserved`
//   3. Promote `reserved` jobs whose workbench is now free
//      → `crafting` (immediately finish crafting if processingTime===0)
//
// The reservation-before-promotion order means a freshly enqueued job
// can move all the way through queued → reserved → crafting → delivering in
// a single tick when ingredients are present and the workbench is free.
//
// File composition (Phase 4.2 split):
//   • tick/hub-inventory-view.ts          — Hub<->Inventory adapters & SourceView
//   • tick/source-selection.ts            — pickCraftingPhysicalSourceForIngredient
//   • tick/job-lifecycle.ts               — finish/cancel/release + DEV invariants
//   • tick/phases/phase-progress-crafting.ts — Phase 1
//   • tick/phases/phase-reserve-queued.ts    — Phase 2
//   • tick/phases/phase-promote-reserved.ts  — Phase 3
//   • this file                           — orchestrator
// ============================================================

import { debugLog } from "../debug/debugLogger";
import type { CraftingQueueState } from "./types";
import type { WarehouseId } from "../items/types";
import type { Inventory, PlacedAsset, ServiceHubEntry } from "../store/types";
import type { NetworkSlice } from "../inventory/reservationTypes";
import { assertCraftingNetworkCrossInvariants } from "./tick/job-lifecycle";
import { progressCraftingPhase } from "./tick/phases/phase-progress-crafting";
import { reserveQueuedPhase } from "./tick/phases/phase-reserve-queued";
import { promoteReservedPhase } from "./tick/phases/phase-promote-reserved";
import type { CraftingTickState } from "./tick/phases/types";

// ---------------------------------------------------------------------------
// Public re-exports — preserve the historical tick.ts surface.
// ---------------------------------------------------------------------------
export type {
  CraftingPhysicalSourceChoice,
  CraftingIngredientDecision,
} from "./tick/source-selection";
export { pickCraftingPhysicalSourceForIngredient } from "./tick/source-selection";
export {
  getGlobalHubWarehouseId,
  hubInventoryToInventoryView,
  inventoryViewToHubInventory,
} from "./tick/hub-inventory-view";
export { releaseJobReservations } from "./tick/job-lifecycle";

// ---------------------------------------------------------------------------
// Public input/output types
// ---------------------------------------------------------------------------

export interface TickInput {
  readonly warehouseInventories: Readonly<Record<WarehouseId, Inventory>>;
  readonly globalInventory: Inventory;
  readonly serviceHubs: Readonly<Record<string, ServiceHubEntry>>;
  readonly network: NetworkSlice;
  readonly crafting: CraftingQueueState;
  readonly assets: Readonly<Record<string, PlacedAsset>>;
  readonly readyWorkbenchIds?: ReadonlySet<string>;
  /** Wall-clock ms; used only for informational `startedAt`/`finishesAt`. */
  readonly now: number;
}

export interface TickOutput {
  readonly warehouseInventories: Readonly<Record<WarehouseId, Inventory>>;
  readonly globalInventory: Inventory;
  readonly serviceHubs: Readonly<Record<string, ServiceHubEntry>>;
  readonly network: NetworkSlice;
  readonly crafting: CraftingQueueState;
}

/**
 * Run one crafting tick. Returns the (possibly unchanged) inputs.
 * The function is referentially safe: if nothing changes, the same
 * object identities are returned and the outer reducer can short-circuit.
 */
export function tickCraftingJobs(input: TickInput): TickOutput {
  if (import.meta.env.DEV) {
    const jobs = input.crafting.jobs;
    if (jobs.some((job) => job.status !== "done" && job.status !== "cancelled")) {
      const queued = jobs.filter((job) => job.status === "queued").length;
      const reserved = jobs.filter((job) => job.status === "reserved").length;
      const crafting = jobs.filter((job) => job.status === "crafting").length;
      const delivering = jobs.filter((job) => job.status === "delivering").length;
      debugLog.general(`JOB_TICK sees ${queued} queued / ${reserved} reserved / ${crafting} crafting / ${delivering} delivering jobs`);
    }
  }

  const state: CraftingTickState = {
    warehouseInventories: input.warehouseInventories,
    globalInventory: input.globalInventory,
    serviceHubs: input.serviceHubs,
    network: input.network,
    jobs: input.crafting.jobs,
    changed: false,
  };

  progressCraftingPhase(state, input);
  reserveQueuedPhase(state, input);
  promoteReservedPhase(state, input);

  if (import.meta.env.DEV) {
    assertCraftingNetworkCrossInvariants(state.network, state.jobs);
  }

  if (!state.changed) return input;

  return {
    warehouseInventories: state.warehouseInventories,
    globalInventory: state.globalInventory,
    serviceHubs: state.serviceHubs,
    network: state.network,
    crafting: { ...input.crafting, jobs: state.jobs },
  };
}
