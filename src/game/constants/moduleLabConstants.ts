// ============================================================
// Module Lab — recipe table and timing constants.
// ------------------------------------------------------------
// The Module Lab consumes accumulated module fragments (from
// state.moduleFragments) and crafts an OwnedModule into
// state.moduleInventory after a fixed wall-clock duration.
//
// Only one job may be active across all labs at any time.
// Module Lab is non-stackable on the registry side, so this
// constraint is naturally enforced.
// ============================================================

import type { ModuleType } from "../modules/module.types";

type ModuleTier = 1 | 2 | 3;
type MinerYieldEffect = { readonly yieldMultiplier: number };
type SmelterSpeedEffect = { readonly speedMultiplier: number };
type ModuleEffect = MinerYieldEffect | SmelterSpeedEffect;

/** Footprint side length in cells (Module Lab is 2×2). */
export const MODULE_LAB_SIZE = { w: 2, h: 2 } as const;

/** Tick interval for the Module Lab job-progress check. */
export const MODULE_LAB_TICK_MS = 500;

export const MODULE_EFFECTS = {
  "miner-boost": {
    1: { yieldMultiplier: 1.1 },
    2: { yieldMultiplier: 1.25 },
    3: { yieldMultiplier: 1.5 },
  },
  "smelter-boost": {
    1: { speedMultiplier: 1.1 },
    2: { speedMultiplier: 1.25 },
    3: { speedMultiplier: 1.5 },
  },
} as const satisfies Record<ModuleType, Record<ModuleTier, ModuleEffect>>;

export interface ModuleLabRecipe {
  readonly id: string;
  readonly inputs: readonly {
    readonly item: "module_fragment";
    readonly count: number;
  }[];
  readonly outputTier: 1 | 2 | 3;
  readonly outputModuleType: ModuleType;
  readonly durationMs: number;
}

/**
 * Fragment-to-module recipe table.
 *
 * The output module type for each tier is a placeholder mapping for
 * V1 — the on-chain NFT/effect side comes later. What matters for
 * this commit is that each tier produces a Module instance that
 * lands in state.moduleInventory and can be placed/removed.
 */
export const MODULE_FRAGMENT_RECIPES: readonly ModuleLabRecipe[] = [
  {
    id: "module_tier1",
    inputs: [{ item: "module_fragment", count: 3 }],
    outputTier: 1,
    outputModuleType: "miner-boost",
    durationMs: 10_000,
  },
  {
    id: "module_tier2",
    inputs: [{ item: "module_fragment", count: 5 }],
    outputTier: 2,
    outputModuleType: "smelter-boost",
    durationMs: 20_000,
  },
  {
    id: "module_tier3",
    inputs: [{ item: "module_fragment", count: 8 }],
    outputTier: 3,
    outputModuleType: "miner-boost",
    durationMs: 40_000,
  },
];

export function getModuleLabRecipe(recipeId: string): ModuleLabRecipe | null {
  return MODULE_FRAGMENT_RECIPES.find((r) => r.id === recipeId) ?? null;
}

export function getRecipeFragmentCost(recipe: ModuleLabRecipe): number {
  return recipe.inputs.reduce((sum, i) => sum + i.count, 0);
}
