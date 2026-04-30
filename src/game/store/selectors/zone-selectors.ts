import type { GameState } from "../types";

/**
 * Returns IDs of non-warehouse buildings (crafting devices) assigned to a zone.
 */
export function getZoneBuildingIds(state: GameState, zoneId: string): string[] {
  const result: string[] = [];
  for (const [bid, zid] of Object.entries(state.buildingZoneIds)) {
    if (zid !== zoneId) continue;
    if (state.assets[bid] && state.assets[bid].type !== "warehouse") {
      result.push(bid);
    }
  }
  return result.sort();
}
