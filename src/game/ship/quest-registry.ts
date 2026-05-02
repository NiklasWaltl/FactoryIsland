import type { ShipQuest } from "../store/types/ship-types";

const PHASE_1_QUESTS: ShipQuest[] = [
  { itemId: "wood",       amount: 30, label: "Holz",         phase: 1 },
  { itemId: "stone",      amount: 25, label: "Stein",        phase: 1 },
  { itemId: "ironIngot",  amount: 10, label: "Eisenbarren",  phase: 1 },
  { itemId: "wood",       amount: 50, label: "Holz",         phase: 1 },
  { itemId: "stone",      amount: 40, label: "Stein",        phase: 1 },
  { itemId: "ironIngot",  amount: 15, label: "Eisenbarren",  phase: 1 },
];

const PHASE_2_QUESTS: ShipQuest[] = [
  { itemId: "metalPlate",    amount: 8,  label: "Metallplatte",    phase: 2 },
  { itemId: "gear",          amount: 8,  label: "Zahnrad",         phase: 2 },
  { itemId: "copperIngot",   amount: 12, label: "Kupferbarren",    phase: 2 },
  { itemId: "metalPlate",    amount: 12, label: "Metallplatte",    phase: 2 },
  { itemId: "gear",          amount: 12, label: "Zahnrad",         phase: 2 },
];

const PHASE_3_QUESTS: ShipQuest[] = [
  { itemId: "metalPlate",    amount: 20, label: "Metallplatte",    phase: 3 },
  { itemId: "gear",          amount: 20, label: "Zahnrad",         phase: 3 },
  { itemId: "copperIngot",   amount: 25, label: "Kupferbarren",    phase: 3 },
  { itemId: "ironIngot",     amount: 30, label: "Eisenbarren",     phase: 3 },
];

// TODO: Phase 4-5 quests — unlocked with ship loop progression
const PHASE_4_QUESTS: ShipQuest[] = [];

// TODO: Phase 4-5 quests — unlocked with ship loop progression
const PHASE_5_QUESTS: ShipQuest[] = [];

const QUEST_POOLS: Record<number, ShipQuest[]> = {
  1: PHASE_1_QUESTS,
  2: PHASE_2_QUESTS,
  3: PHASE_3_QUESTS,
  4: PHASE_4_QUESTS,
  5: PHASE_5_QUESTS,
};

/**
 * Draw a random quest from the pool for the given phase.
 * Falls back to phase 1 if the phase pool is empty.
 */
export function drawQuest(phase: number): ShipQuest {
  const pool = QUEST_POOLS[phase];
  const effective = pool && pool.length > 0 ? pool : PHASE_1_QUESTS;
  return effective[Math.floor(Math.random() * effective.length)];
}

export { QUEST_POOLS };
