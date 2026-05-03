import type { ItemId } from "../items/types";
import type { RewardType, ShipReward } from "../store/types/ship-types";
import { MODULE_FRAGMENT_ITEM_ID } from "./ship-constants";

export const SHIP_REWARD_WEIGHTS: Record<RewardType, number> = {
  coins: 50,
  basic_resource: 25,
  rare_resource: 15,
  module_fragment: 8,
  complete_module: 2,
};

const BASIC_RESOURCE_ITEMS: readonly ItemId[] = ["wood", "stone"];
const RARE_RESOURCE_ITEMS: readonly ItemId[] = ["ironIngot", "copperIngot"];

const REWARD_LABELS: Record<RewardType, string> = {
  coins: "Coins",
  basic_resource: "Rohstoffe",
  rare_resource: "Seltene Ressourcen",
  module_fragment: "Modul-Fragment",
  complete_module: "Komplett-Modul",
};

function randomIntInclusive(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function drawFromList<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

export function getShipRewardQualityMultiplier(
  fulfillmentRatio: number,
): 1 | 1.5 | 2 {
  if (fulfillmentRatio >= 2) return 2;
  if (fulfillmentRatio >= 1.5) return 1.5;
  return 1;
}

export function getAdjustedShipRewardWeights(
  fulfillmentRatio: number,
): Record<RewardType, number> {
  const qualityMultiplier = getShipRewardQualityMultiplier(fulfillmentRatio);
  return {
    ...SHIP_REWARD_WEIGHTS,
    module_fragment: SHIP_REWARD_WEIGHTS.module_fragment * qualityMultiplier,
    complete_module: SHIP_REWARD_WEIGHTS.complete_module * qualityMultiplier,
  };
}

export function getShipRewardWeightTotal(fulfillmentRatio = 1): number {
  return Object.values(getAdjustedShipRewardWeights(fulfillmentRatio)).reduce(
    (sum, weight) => sum + weight,
    0,
  );
}

export function drawShipReward(
  fulfillmentRatio: number,
  pityGuaranteed: boolean,
): RewardType {
  if (pityGuaranteed) return "module_fragment";

  const weights = getAdjustedShipRewardWeights(fulfillmentRatio);
  const totalWeight = Object.values(weights).reduce(
    (sum, weight) => sum + weight,
    0,
  );
  let roll = Math.random() * totalWeight;

  for (const [kind, weight] of Object.entries(weights) as [RewardType, number][]) {
    if (roll < weight) return kind;
    roll -= weight;
  }

  return "complete_module";
}

function fulfillmentRatioForMultiplier(multiplier: 1 | 2 | 3): number {
  if (multiplier === 3) return 2;
  if (multiplier === 2) return 1.5;
  return 1;
}

export function drawReward(
  multiplier: 1 | 2 | 3,
  questPhase: number,
  pityGuaranteed = false,
): ShipReward {
  const kind = drawShipReward(
    fulfillmentRatioForMultiplier(multiplier),
    pityGuaranteed,
  );

  switch (kind) {
    case "coins":
      return {
        kind,
        itemId: "coins",
        label: REWARD_LABELS[kind],
        amount: Math.max(1, Math.round(50 * multiplier * questPhase)),
        multiplier,
      };
    case "basic_resource": {
      const itemId = drawFromList(BASIC_RESOURCE_ITEMS);
      return {
        kind,
        itemId,
        label: REWARD_LABELS[kind],
        amount: randomIntInclusive(5, 15),
        multiplier,
      };
    }
    case "rare_resource": {
      const itemId = drawFromList(RARE_RESOURCE_ITEMS);
      return {
        kind,
        itemId,
        label: REWARD_LABELS[kind],
        amount: randomIntInclusive(1, 3),
        multiplier,
      };
    }
    case "module_fragment":
      return {
        kind,
        itemId: MODULE_FRAGMENT_ITEM_ID,
        label: REWARD_LABELS[kind],
        amount: 1,
        multiplier,
      };
    case "complete_module":
      return {
        kind,
        itemId: "complete_module",
        label: REWARD_LABELS[kind],
        amount: 1,
        multiplier,
      };
  }
}
