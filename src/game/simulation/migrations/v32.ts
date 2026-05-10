import type { SaveGameV31, SaveGameV32 } from "./types";

export function migrateV31ToV32(save: SaveGameV31): SaveGameV32 {
  // No-op: replacing the coin-based MapShop unlocks with the Research Lab
  // building did not change the persisted state shape. The research_lab
  // BuildingType is already part of TIER_0_UNLOCKED_BUILDINGS for fresh games.
  // Existing saves additionally need it appended (idempotent) so the lab can
  // be placed without first researching it.
  const unlocked = save.unlockedBuildings ?? [];
  return {
    ...save,
    version: 32,
    unlockedBuildings: unlocked.includes("research_lab")
      ? [...unlocked]
      : [...unlocked, "research_lab"],
  };
}
