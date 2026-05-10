import type { BuildingType } from "../../store/types";
import type { SaveGameV30, SaveGameV31 } from "./types";

/** All BuildingTypes that exist in the game. Used by v30->v31 migration to
 *  unlock everything for legacy saves so existing players keep their access. */
const ALL_BUILDING_TYPES_FOR_LEGACY_UNLOCK: readonly BuildingType[] = [
  "workbench",
  "warehouse",
  "smithy",
  "generator",
  "cable",
  "battery",
  "power_pole",
  "auto_miner",
  "conveyor",
  "conveyor_corner",
  "conveyor_merger",
  "conveyor_splitter",
  "conveyor_underground_in",
  "conveyor_underground_out",
  "manual_assembler",
  "auto_smelter",
  "auto_assembler",
  "service_hub",
  "dock_warehouse",
  "module_lab",
];

export function migrateV30ToV31(save: SaveGameV30): SaveGameV31 {
  // Strategy A: existing saves keep access to every building they had before
  // the unlock system existed. Fresh games start gated via TIER_0_UNLOCKED_BUILDINGS.
  return {
    ...save,
    version: 31,
    unlockedBuildings: [...ALL_BUILDING_TYPES_FOR_LEGACY_UNLOCK],
  };
}
