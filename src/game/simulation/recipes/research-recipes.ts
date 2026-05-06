// ============================================================
// Research Lab — building unlock recipes.
// ------------------------------------------------------------
// Item-based, instant-research replacements for the previous
// coin-driven MAP_SHOP_BUILDING_UNLOCKS table. Consumed by the
// RESEARCH_BUILDING action handler and the ResearchLabPanel UI.
//
// Pure data, no runtime state. Type-only imports only.
// ============================================================

import type { BuildingType, Inventory } from "../../store/types";

export interface ResearchRecipe {
  /** Stable id used by the RESEARCH_BUILDING action and React keys. */
  readonly id: string;
  /** BuildingType this recipe unlocks. Doubles as registry key. */
  readonly buildingType: BuildingType;
  /** Tier label used purely for UI grouping. */
  readonly tier: 1 | 2 | 3;
  /** Item cost. Only resources listed here are required. */
  readonly cost: Partial<Record<keyof Inventory, number>>;
}

export const RESEARCH_RECIPES: readonly ResearchRecipe[] = Object.freeze([
  // Tier 1 — Energie & Schmieden basics
  {
    id: "research_generator",
    buildingType: "generator",
    tier: 1,
    cost: { ironIngot: 20 },
  },
  {
    id: "research_cable",
    buildingType: "cable",
    tier: 1,
    cost: { ironIngot: 20 },
  },
  {
    id: "research_power_pole",
    buildingType: "power_pole",
    tier: 1,
    cost: { ironIngot: 20 },
  },
  {
    id: "research_smithy",
    buildingType: "smithy",
    tier: 1,
    cost: { ironIngot: 20 },
  },
  {
    id: "research_manual_assembler",
    buildingType: "manual_assembler",
    tier: 1,
    cost: { ironIngot: 20 },
  },

  // Tier 2 — Automation
  {
    id: "research_auto_miner",
    buildingType: "auto_miner",
    tier: 2,
    cost: { metalPlate: 10, ironIngot: 20 },
  },
  {
    id: "research_auto_smelter",
    buildingType: "auto_smelter",
    tier: 2,
    cost: { metalPlate: 10, ironIngot: 20 },
  },
  {
    id: "research_battery",
    buildingType: "battery",
    tier: 2,
    cost: { metalPlate: 10, ironIngot: 20 },
  },
  {
    id: "research_conveyor",
    buildingType: "conveyor",
    tier: 2,
    cost: { metalPlate: 10, ironIngot: 20 },
  },
  {
    id: "research_conveyor_corner",
    buildingType: "conveyor_corner",
    tier: 2,
    cost: { metalPlate: 10, ironIngot: 20 },
  },

  // Tier 3 — Erweiterte Logistik & Module
  {
    id: "research_conveyor_merger",
    buildingType: "conveyor_merger",
    tier: 3,
    cost: { metalPlate: 20, gear: 10 },
  },
  {
    id: "research_conveyor_splitter",
    buildingType: "conveyor_splitter",
    tier: 3,
    cost: { metalPlate: 20, gear: 10 },
  },
  {
    id: "research_conveyor_underground_in",
    buildingType: "conveyor_underground_in",
    tier: 3,
    cost: { metalPlate: 20, gear: 10 },
  },
  {
    id: "research_conveyor_underground_out",
    buildingType: "conveyor_underground_out",
    tier: 3,
    cost: { metalPlate: 20, gear: 10 },
  },
  {
    id: "research_auto_assembler",
    buildingType: "auto_assembler",
    tier: 3,
    cost: { metalPlate: 20, gear: 10 },
  },
  {
    id: "research_module_lab",
    buildingType: "module_lab",
    tier: 3,
    cost: { metalPlate: 20, gear: 10 },
  },
]);

/** Returns the recipe with `id` or null if no such recipe exists. */
export function getResearchRecipe(id: string): ResearchRecipe | null {
  return RESEARCH_RECIPES.find((r) => r.id === id) ?? null;
}
