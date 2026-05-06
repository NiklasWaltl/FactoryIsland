// ============================================================
// Map shop offer constants/types.
// ------------------------------------------------------------
// Extracted from store/reducer.ts. This module contains only
// static shop/economy offer metadata.
//
// IMPORTANT: This module must NOT import runtime values from
// store/reducer.ts to avoid an ESM initialisation cycle.
// ============================================================

import type { BuildingType, Inventory } from "../../types";

export interface MapShopItem {
  key: string;
  label: string;
  emoji: string;
  costCoins: number;
  inventoryKey: keyof Inventory;
}

export const MAP_SHOP_ITEMS: MapShopItem[] = [
  {
    key: "axe",
    label: "Axt",
    emoji: "\u{1FA93}",
    costCoins: 10,
    inventoryKey: "axe",
  },
];

// ---------------------------------------------------------------------------
// Tier-0 unlocks
// ---------------------------------------------------------------------------
//
// Building unlocks were previously coin-based via MAP_SHOP_BUILDING_UNLOCKS.
// They are now item-based, gated by the in-world Research Lab building
// (see simulation/recipes/research-recipes.ts and ui/panels/ResearchLabPanel).

/**
 * BuildingTypes available from the start (tier 0). Players never need to
 * unlock these. Fresh games begin with this set; legacy saves keep their
 * full unlock set via the v30 -> v31 migration.
 *
 * `research_lab` is included so a fresh game can place the lab and begin
 * researching every other building.
 */
export const TIER_0_UNLOCKED_BUILDINGS: readonly BuildingType[] = [
  "workbench",
  "warehouse",
  "service_hub",
  "research_lab",
];
