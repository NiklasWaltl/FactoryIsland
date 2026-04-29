import { debugLog } from "../../../debug/debugLogger";
import { assertTransition, sortByPriorityFifo } from "../../queue/queue";
import type { CraftingJob } from "../../types";
import { cancelReservedJob, finishCraftingJob, hasBufferedIngredients } from "../job-lifecycle";
import type { TickInput } from "../../tick";
import type { CraftingTickState } from "./types";

export function promoteReservedPhase(state: CraftingTickState, input: TickInput): void {
  const reservedSorted = sortByPriorityFifo(
    state.jobs.filter((j) => j.status === "reserved"),
  );
  const busyByWorkbench = new Set<string>();
  for (const j of state.jobs) {
    if (j.status === "crafting" || j.status === "delivering") busyByWorkbench.add(j.workbenchId);
  }
  const idIndex = new Map<string, number>();
  state.jobs.forEach((j, i) => idIndex.set(j.id, i));
  const phase3: CraftingJob[] = [...state.jobs];

  for (const job of reservedSorted) {
    if (busyByWorkbench.has(job.workbenchId)) {
      if (import.meta.env.DEV) {
        debugLog.general(`Job ${job.id} waiting: workbench ${job.workbenchId} already busy`);
      }
      continue;
    }
    // Sanity: workbench must still exist.
    const wb = input.assets[job.workbenchId];
    if (!wb || wb.type !== "workbench") {
      // The workbench was destroyed while the job was reserved.
      const canc = cancelReservedJob(job, state.network);
      state.network = canc.network;
      if (import.meta.env.DEV) {
        debugLog.general(`Job ${job.id} cancelled: workbench ${job.workbenchId} missing`);
      }
      const idx = idIndex.get(job.id)!;
      phase3[idx] = canc.job;
      state.changed = true;
      continue;
    }
    if (!hasBufferedIngredients(job)) {
      if (import.meta.env.DEV) {
        debugLog.general(`Job ${job.id} waiting: workbench ${job.workbenchId} missing delivered input`);
      }
      continue;
    }
    if (input.readyWorkbenchIds && !input.readyWorkbenchIds.has(job.workbenchId)) {
      if (import.meta.env.DEV) {
        debugLog.general(`Job ${job.id} waiting: workbench ${job.workbenchId} not ready`);
      }
      continue;
    }
    assertTransition(job.status, "crafting");
    let promoted: CraftingJob = {
      ...job,
      status: "crafting",
      progress: 0,
      startedAt: input.now,
      finishesAt: input.now,
    };
    if (import.meta.env.DEV) {
      debugLog.general(`Job ${job.id} moved to crafting on workbench ${job.workbenchId}`);
    }
    // For 0-tick recipes, finish crafting immediately in the same tick.
    if (promoted.processingTime === 0) {
      const completed = finishCraftingJob(
        promoted,
        state.warehouseInventories,
        state.globalInventory,
        state.serviceHubs,
        state.network,
      );
      state.warehouseInventories = completed.warehouseInventories;
      state.globalInventory = completed.globalInventory;
      state.serviceHubs = completed.serviceHubs;
      state.network = completed.network;
      promoted = completed.job;
      busyByWorkbench.add(job.workbenchId);
    } else {
      busyByWorkbench.add(job.workbenchId);
    }
    const idx = idIndex.get(job.id)!;
    phase3[idx] = promoted;
    state.changed = true;
  }
  state.jobs = phase3;
}
