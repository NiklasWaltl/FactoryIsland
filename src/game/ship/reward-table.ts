import type { ItemId } from "../items/types";
import type {
  RewardType,
  ShipQuest,
  ShipReward,
} from "../store/types/ship-types";
import {
  SHIP_BASIC_RESOURCE_REWARD_ITEMS,
  SHIP_EXPECTED_REWARD_PREVIEW_MULTIPLIER,
  SHIP_FULFILLMENT_RATIO_BY_MULTIPLIER,
  SHIP_RARE_RESOURCE_REWARD_ITEMS,
  SHIP_REWARD_AMOUNTS,
  SHIP_REWARD_QUALITY_THRESHOLDS,
  SHIP_REWARD_QUALITY_WEIGHT_MULTIPLIERS,
  SHIP_REWARD_WEIGHTS,
} from "./ship-balance";
import { MODULE_FRAGMENT_ITEM_ID } from "./ship-constants";

export { SHIP_REWARD_WEIGHTS };

const REWARD_LABELS: Record<RewardType, string> = {
  coins: "Coins",
  basic_resource: "Rohstoffe",
  rare_resource: "Seltene Ressourcen",
  module_fragment: "Modul-Fragment",
  complete_module: "Komplett-Modul",
};

export interface ShipRewardTable {
  weights: Record<RewardType, number>;
  labels: Record<RewardType, string>;
  basicResourceItems: readonly ItemId[];
  rareResourceItems: readonly ItemId[];
  amounts: typeof SHIP_REWARD_AMOUNTS;
}

export interface ExpectedRewardRange {
  min: number;
  max: number;
  likely: {
    kind: RewardType;
    label: string;
  };
}

export const SHIP_REWARD_TABLE: ShipRewardTable = {
  weights: SHIP_REWARD_WEIGHTS,
  labels: REWARD_LABELS,
  basicResourceItems: SHIP_BASIC_RESOURCE_REWARD_ITEMS,
  rareResourceItems: SHIP_RARE_RESOURCE_REWARD_ITEMS,
  amounts: SHIP_REWARD_AMOUNTS,
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
  if (fulfillmentRatio >= SHIP_REWARD_QUALITY_THRESHOLDS.excellentRatio) {
    return SHIP_REWARD_QUALITY_WEIGHT_MULTIPLIERS.excellent;
  }
  if (fulfillmentRatio >= SHIP_REWARD_QUALITY_THRESHOLDS.goodRatio) {
    return SHIP_REWARD_QUALITY_WEIGHT_MULTIPLIERS.good;
  }
  return SHIP_REWARD_QUALITY_WEIGHT_MULTIPLIERS.fulfilled;
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

  for (const [kind, weight] of Object.entries(weights) as [
    RewardType,
    number,
  ][]) {
    if (roll < weight) return kind;
    roll -= weight;
  }

  return "complete_module";
}

function fulfillmentRatioForMultiplier(multiplier: 1 | 2 | 3): number {
  return SHIP_FULFILLMENT_RATIO_BY_MULTIPLIER[multiplier];
}

function getMostLikelyRewardKind(rewardTable: ShipRewardTable): RewardType {
  const entries = Object.entries(rewardTable.weights) as [RewardType, number][];
  return entries.reduce((best, current) =>
    current[1] > best[1] ? current : best,
  )[0];
}

function getRewardAmountRange(
  kind: RewardType,
  questPhase: number,
  multiplier: 1 | 2 | 3,
  rewardTable: ShipRewardTable,
): Pick<ExpectedRewardRange, "min" | "max"> {
  switch (kind) {
    case "coins": {
      const amount = Math.max(
        rewardTable.amounts.coins.minimum,
        Math.round(
          rewardTable.amounts.coins.basePerPhase * multiplier * questPhase,
        ),
      );
      return { min: amount, max: amount };
    }
    case "basic_resource":
      return rewardTable.amounts.basic_resource;
    case "rare_resource":
      return rewardTable.amounts.rare_resource;
    case "module_fragment":
      return rewardTable.amounts.module_fragment;
    case "complete_module":
      return rewardTable.amounts.complete_module;
  }
}

export function getExpectedRewardRange(
  quest: ShipQuest,
  rewardTable: ShipRewardTable,
): ExpectedRewardRange {
  const kind = getMostLikelyRewardKind(rewardTable);
  const range = getRewardAmountRange(
    kind,
    quest.phase,
    SHIP_EXPECTED_REWARD_PREVIEW_MULTIPLIER,
    rewardTable,
  );

  return {
    ...range,
    likely: {
      kind,
      label: rewardTable.labels[kind],
    },
  };
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
        amount: getRewardAmountRange(
          kind,
          questPhase,
          multiplier,
          SHIP_REWARD_TABLE,
        ).min,
        multiplier,
      };
    case "basic_resource": {
      const itemId = drawFromList(SHIP_REWARD_TABLE.basicResourceItems);
      return {
        kind,
        itemId,
        label: REWARD_LABELS[kind],
        amount: randomIntInclusive(
          SHIP_REWARD_TABLE.amounts.basic_resource.min,
          SHIP_REWARD_TABLE.amounts.basic_resource.max,
        ),
        multiplier,
      };
    }
    case "rare_resource": {
      const itemId = drawFromList(SHIP_REWARD_TABLE.rareResourceItems);
      return {
        kind,
        itemId,
        label: REWARD_LABELS[kind],
        amount: randomIntInclusive(
          SHIP_REWARD_TABLE.amounts.rare_resource.min,
          SHIP_REWARD_TABLE.amounts.rare_resource.max,
        ),
        multiplier,
      };
    }
    case "module_fragment":
      return {
        kind,
        itemId: MODULE_FRAGMENT_ITEM_ID,
        label: REWARD_LABELS[kind],
        amount: SHIP_REWARD_TABLE.amounts.module_fragment.min,
        multiplier,
      };
    case "complete_module":
      return {
        kind,
        itemId: "complete_module",
        label: REWARD_LABELS[kind],
        amount: SHIP_REWARD_TABLE.amounts.complete_module.min,
        multiplier,
      };
  }
}
