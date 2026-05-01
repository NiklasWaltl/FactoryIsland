import { debugLog } from "../../../debug/debugLogger";
import { finishCraftingJob } from "../job-lifecycle";
import type { TickInput } from "../../tick";
import type { CraftingTickState } from "./types";

export function progressCraftingPhase(
  state: CraftingTickState,
  input: TickInput,
): void {
  const phase1 = [];
  for (const job of state.jobs) {
    if (job.status !== "crafting") {
      phase1.push(job);
      continue;
    }
    const nextProgress = job.progress + 1;
    if (nextProgress < job.processingTime) {
      phase1.push({ ...job, progress: nextProgress });
      state.changed = true;
      continue;
    }
    // Completion: commit reservations, then wait for drone pickup.
    const completed = finishCraftingJob(
      job,
      state.warehouseInventories,
      state.globalInventory,
      state.serviceHubs,
      state.network,
    );
    state.warehouseInventories = completed.warehouseInventories;
    state.globalInventory = completed.globalInventory;
    state.serviceHubs = completed.serviceHubs;
    state.network = completed.network;
    phase1.push(completed.job);
    state.changed = true;
  }
  state.jobs = phase1;
}
