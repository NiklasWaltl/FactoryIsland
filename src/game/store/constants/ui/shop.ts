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
// Building unlocks (map shop)
// ---------------------------------------------------------------------------

export interface MapShopBuildingUnlock {
  /** BuildingType this entry unlocks. Doubles as registry key. */
  readonly buildingType: BuildingType;
  /** Display label shown in the shop (German UI). */
  readonly label: string;
  /** Emoji shown next to the entry. */
  readonly emoji: string;
  /** Coin cost to unlock. */
  readonly costCoins: number;
  /** Tier label for grouping/UX hints. */
  readonly tier: 1 | 2 | 3;
}

/**
 * BuildingTypes available from the start (tier 0). Players never need to
 * unlock these. Migration v30 -> v31 unlocks ALL buildings for legacy saves
 * (strategy A); fresh games begin with this set only.
 */
export const TIER_0_UNLOCKED_BUILDINGS: readonly BuildingType[] = [
  "workbench",
  "warehouse",
  "service_hub",
];

export const MAP_SHOP_BUILDING_UNLOCKS: readonly MapShopBuildingUnlock[] =
  Object.freeze([
    // Tier 1 — Energy & Smelting basics
    {
      buildingType: "generator",
      label: "Holz-Generator",
      emoji: "\u{1F525}",
      costCoins: 60,
      tier: 1,
    },
    {
      buildingType: "cable",
      label: "Stromleitung",
      emoji: "\u{1F50C}",
      costCoins: 50,
      tier: 1,
    },
    {
      buildingType: "power_pole",
      label: "Stromknoten",
      emoji: "⚡",
      costCoins: 80,
      tier: 1,
    },
    {
      buildingType: "smithy",
      label: "Schmiede",
      emoji: "\u{1F528}",
      costCoins: 80,
      tier: 1,
    },
    {
      buildingType: "manual_assembler",
      label: "Manueller Assembler",
      emoji: "\u{1F527}",
      costCoins: 100,
      tier: 1,
    },

    // Tier 2 — Automation
    {
      buildingType: "auto_miner",
      label: "Auto-Miner",
      emoji: "⛏️",
      costCoins: 250,
      tier: 2,
    },
    {
      buildingType: "auto_smelter",
      label: "Auto Smelter",
      emoji: "\u{1F3ED}",
      costCoins: 300,
      tier: 2,
    },
    {
      buildingType: "battery",
      label: "Batterie",
      emoji: "\u{1F50B}",
      costCoins: 200,
      tier: 2,
    },
    {
      buildingType: "conveyor",
      label: "Förderband",
      emoji: "➡️",
      costCoins: 200,
      tier: 2,
    },
    {
      buildingType: "conveyor_corner",
      label: "Förderband-Ecke",
      emoji: "↪️",
      costCoins: 250,
      tier: 2,
    },
    {
      buildingType: "auto_assembler",
      label: "Auto-Assembler",
      emoji: "⚙️",
      costCoins: 400,
      tier: 2,
    },

    // Tier 3 — Advanced logistics & modules
    {
      buildingType: "conveyor_merger",
      label: "Förderband-Merger",
      emoji: "\u{1F500}",
      costCoins: 500,
      tier: 3,
    },
    {
      buildingType: "conveyor_splitter",
      label: "Förderband-Splitter",
      emoji: "\u{1F501}",
      costCoins: 500,
      tier: 3,
    },
    {
      buildingType: "conveyor_underground_in",
      label: "Untergrund-Eingang",
      emoji: "⬇️",
      costCoins: 700,
      tier: 3,
    },
    {
      buildingType: "conveyor_underground_out",
      label: "Untergrund-Ausgang",
      emoji: "⬆️",
      costCoins: 700,
      tier: 3,
    },
    {
      buildingType: "module_lab",
      label: "Modul-Labor",
      emoji: "\u{1F9EA}",
      costCoins: 1000,
      tier: 3,
    },
  ]);
