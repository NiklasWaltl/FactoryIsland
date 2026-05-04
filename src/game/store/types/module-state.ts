import type { Module, ModuleType } from "../../modules/module.types";

export type ModuleFragmentCount = number;

/**
 * The single in-flight module crafting job at the Module Lab.
 * Only one job may exist at a time across all labs (the lab is non-stackable).
 * Time is tracked in wall-clock ms (Date.now), not engine ticks, mirroring
 * how the smithy/manual-assembler progress fields work today.
 */
export interface ModuleLabJob {
  /** Recipe id from MODULE_FRAGMENT_RECIPES. */
  recipeId: string;
  /** Output module type. */
  moduleType: ModuleType;
  /** Output tier. */
  tier: 1 | 2 | 3;
  /** Fragments consumed up-front when the job started (3 / 5 / 8). */
  fragmentsRequired: number;
  /** Date.now() at job start. */
  startedAt: number;
  /** Total job duration in ms. */
  durationMs: number;
  /**
   * Lifecycle state:
   *  - "crafting": still ticking down
   *  - "done":     ready to be collected via COLLECT_MODULE
   */
  status: "crafting" | "done";
}

export interface ModuleState {
  moduleInventory: Module[];
  moduleFragments: ModuleFragmentCount;
  moduleLabJob: ModuleLabJob | null;
}
