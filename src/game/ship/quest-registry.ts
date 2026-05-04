import type { ShipQuest } from "../store/types/ship-types";
import { SHIP_DEFAULT_QUEST_PHASE, SHIP_QUEST_POOLS } from "./ship-balance";

const QUEST_POOLS = SHIP_QUEST_POOLS;
export const SHIP_QUEST_HISTORY_SIZE = 5;

export function getQuestId(
  quest: Pick<ShipQuest, "phase" | "itemId" | "amount">,
): string {
  return `${quest.phase}:${quest.itemId}:${quest.amount}`;
}

/**
 * Draw a random quest from the pool for the given phase.
 * Falls back to phase 1 if the phase pool is empty.
 */
export function drawQuest(
  phase: number,
  recentQuestIds: readonly string[] = [],
): ShipQuest {
  const pool = QUEST_POOLS[phase];
  const fallbackPool = QUEST_POOLS[SHIP_DEFAULT_QUEST_PHASE];
  const effective = pool && pool.length > 0 ? pool : fallbackPool;

  const blocked = new Set(
    recentQuestIds.filter((id): id is string => typeof id === "string"),
  );
  const candidates =
    blocked.size > 0
      ? effective.filter((quest) => !blocked.has(getQuestId(quest)))
      : effective;
  const source = candidates.length > 0 ? candidates : effective;

  return source[Math.floor(Math.random() * source.length)];
}

export { QUEST_POOLS };
