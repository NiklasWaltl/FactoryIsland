import type { ShipReward } from "../store/types/ship-types";

interface RewardEntry {
  kind: ShipReward["kind"];
  itemId: string;
  label: string;
  /** Base amount before multiplier */
  baseAmount: number;
  /** Cumulative probability weight (out of 100) */
  weight: number;
}

const REWARD_TABLE: RewardEntry[] = [
  // ~50% coins
  { kind: "coins",           itemId: "coins",       label: "Coins",         baseAmount: 50,  weight: 50 },
  // ~25% basic resources
  { kind: "basic_resource",  itemId: "wood",        label: "Holz",          baseAmount: 20,  weight: 62 },
  { kind: "basic_resource",  itemId: "stone",       label: "Stein",         baseAmount: 20,  weight: 75 },
  // ~15% rare resources (ingots)
  { kind: "rare_resource",   itemId: "ironIngot",   label: "Eisenbarren",   baseAmount: 8,   weight: 83 },
  { kind: "rare_resource",   itemId: "copperIngot", label: "Kupferbarren",  baseAmount: 8,   weight: 90 },
  // ~8% module fragment
  { kind: "module_fragment", itemId: "gear",        label: "Modul-Fragment",baseAmount: 1,   weight: 98 },
  // ~2% complete module
  { kind: "complete_module", itemId: "metalPlate",  label: "Komplett-Modul",baseAmount: 1,   weight: 100 },
];

const TOTAL_WEIGHT = 100;

/**
 * Draw a reward from the weighted table.
 * multiplier scales both coins and amounts.
 * questPhase scales coin amounts (higher phases reward more).
 */
export function drawReward(multiplier: 1 | 2 | 3, questPhase: number): ShipReward {
  const roll = Math.random() * TOTAL_WEIGHT;
  const entry = REWARD_TABLE.find((e) => roll < e.weight) ?? REWARD_TABLE[REWARD_TABLE.length - 1];

  const phaseBonus = entry.kind === "coins" ? questPhase : 1;
  const amount = Math.max(1, Math.round(entry.baseAmount * multiplier * phaseBonus));

  return {
    kind: entry.kind,
    itemId: entry.itemId,
    label: entry.label,
    amount,
    multiplier,
  };
}
