import type { ItemId } from "../items/types";
import type { RewardType, ShipQuest } from "../store/types/ship-types";

export const SHIP_DEFAULT_QUEST_PHASE = 1;
export const SHIP_MAX_QUEST_PHASE = 5;
export const SHIP_PITY_TRACKING_MIN_PHASE = 5;

export const SHIP_DOCK_WAIT_MIN_MS = 5 * 60 * 1_000;
export const SHIP_DOCK_WAIT_MAX_MS = 5 * 60 * 1_000;
export const SHIP_VOYAGE_MIN_MS = 3 * 60 * 1_000;
export const SHIP_VOYAGE_MAX_MS = 5 * 60 * 1_000;

export const FRAGMENT_TRADER_BALANCE = {
  baseCost: 500,
  pityCost: 250,
  pityThreshold: 10,
} as const;

export const SHIP_FRAGMENT_PITY_THRESHOLD = 31;

export const SHIP_REWARD_QUALITY_THRESHOLDS = {
  fulfilledRatio: 1,
  goodRatio: 1.5,
  excellentRatio: 2,
} as const;

export const SHIP_REWARD_QUALITY_WEIGHT_MULTIPLIERS = {
  fulfilled: 1,
  good: 1.5,
  excellent: 2,
} as const;

export const SHIP_FULFILLMENT_RATIO_BY_MULTIPLIER = {
  1: SHIP_REWARD_QUALITY_THRESHOLDS.fulfilledRatio,
  2: SHIP_REWARD_QUALITY_THRESHOLDS.goodRatio,
  3: SHIP_REWARD_QUALITY_THRESHOLDS.excellentRatio,
} as const satisfies Record<1 | 2 | 3, number>;

export const SHIP_EXPECTED_REWARD_PREVIEW_MULTIPLIER = 1;

export const SHIP_REWARD_WEIGHTS: Record<RewardType, number> = {
  coins: 50,
  basic_resource: 25,
  rare_resource: 15,
  module_fragment: 8,
  complete_module: 2,
};

export const SHIP_REWARD_AMOUNTS = {
  coins: {
    basePerPhase: 50,
    minimum: 1,
  },
  basic_resource: {
    min: 5,
    max: 15,
  },
  rare_resource: {
    min: 1,
    max: 3,
  },
  module_fragment: {
    min: 1,
    max: 1,
  },
  complete_module: {
    min: 1,
    max: 1,
  },
} as const;

export const SHIP_BASIC_RESOURCE_REWARD_ITEMS: readonly ItemId[] = [
  "wood",
  "stone",
];

export const SHIP_RARE_RESOURCE_REWARD_ITEMS: readonly ItemId[] = [
  "ironIngot",
  "copperIngot",
];

const PHASE_1_QUESTS: ShipQuest[] = [
  { itemId: "wood", amount: 30, label: "Holz", phase: 1 },
  { itemId: "stone", amount: 25, label: "Stein", phase: 1 },
  { itemId: "ironIngot", amount: 10, label: "Eisenbarren", phase: 1 },
  { itemId: "wood", amount: 50, label: "Holz", phase: 1 },
  { itemId: "stone", amount: 40, label: "Stein", phase: 1 },
  { itemId: "ironIngot", amount: 15, label: "Eisenbarren", phase: 1 },
];

const PHASE_2_QUESTS: ShipQuest[] = [
  { itemId: "metalPlate", amount: 8, label: "Metallplatte", phase: 2 },
  { itemId: "gear", amount: 8, label: "Zahnrad", phase: 2 },
  { itemId: "copperIngot", amount: 12, label: "Kupferbarren", phase: 2 },
  { itemId: "metalPlate", amount: 12, label: "Metallplatte", phase: 2 },
  { itemId: "gear", amount: 12, label: "Zahnrad", phase: 2 },
];

const PHASE_3_QUESTS: ShipQuest[] = [
  { itemId: "metalPlate", amount: 20, label: "Metallplatte", phase: 3 },
  { itemId: "gear", amount: 20, label: "Zahnrad", phase: 3 },
  { itemId: "copperIngot", amount: 25, label: "Kupferbarren", phase: 3 },
  { itemId: "ironIngot", amount: 30, label: "Eisenbarren", phase: 3 },
];

const PHASE_4_QUESTS: ShipQuest[] = [
  { itemId: "metalPlate", amount: 30, label: "Metallplatte", phase: 4 },
  { itemId: "gear", amount: 30, label: "Zahnrad", phase: 4 },
  { itemId: "metalPlate", amount: 40, label: "Metallplatte", phase: 4 },
  { itemId: "gear", amount: 40, label: "Zahnrad", phase: 4 },
  { itemId: "copperIngot", amount: 40, label: "Kupferbarren", phase: 4 },
  { itemId: "ironIngot", amount: 45, label: "Eisenbarren", phase: 4 },
];

const PHASE_5_QUESTS: ShipQuest[] = [
  { itemId: "metalPlate", amount: 60, label: "Metallplatte", phase: 5 },
  { itemId: "gear", amount: 60, label: "Zahnrad", phase: 5 },
  { itemId: "metalPlate", amount: 80, label: "Metallplatte", phase: 5 },
  { itemId: "gear", amount: 80, label: "Zahnrad", phase: 5 },
  { itemId: "copperIngot", amount: 70, label: "Kupferbarren", phase: 5 },
  { itemId: "ironIngot", amount: 75, label: "Eisenbarren", phase: 5 },
];

export const SHIP_QUEST_POOLS: Record<number, ShipQuest[]> = {
  [SHIP_DEFAULT_QUEST_PHASE]: PHASE_1_QUESTS,
  2: PHASE_2_QUESTS,
  3: PHASE_3_QUESTS,
  4: PHASE_4_QUESTS,
  [SHIP_MAX_QUEST_PHASE]: PHASE_5_QUESTS,
};
