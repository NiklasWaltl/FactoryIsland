import type {
  BuildingType,
  CollectableItemType,
  Inventory,
} from "../store/types";
import { BUILDING_COSTS } from "../store/constants/buildings/index";

const DECONSTRUCT_REFUND_KEYS: readonly CollectableItemType[] = [
  "wood",
  "stone",
  "iron",
  "copper",
];

function refundPortion(amount: number | undefined): number {
  return Math.max(1, Math.floor((amount ?? 0) / 3));
}

function deriveRefundForBuildingType(
  buildingType: BuildingType,
): Partial<Record<keyof Inventory, number>> {
  const costs = BUILDING_COSTS[buildingType];
  const refund: Partial<Record<keyof Inventory, number>> = {};
  for (const key of DECONSTRUCT_REFUND_KEYS) {
    const amount = costs[key] ?? 0;
    if (amount <= 0) continue;
    refund[key] = refundPortion(amount);
  }
  return refund;
}

export const DECONSTRUCT_REFUND: Record<
  BuildingType,
  Partial<Record<keyof Inventory, number>>
> = Object.fromEntries(
  (Object.keys(BUILDING_COSTS) as BuildingType[]).map((buildingType) => [
    buildingType,
    deriveRefundForBuildingType(buildingType),
  ]),
) as Record<BuildingType, Partial<Record<keyof Inventory, number>>>;

export function getDeconstructRefundForBuildingType(
  buildingType: BuildingType,
): Partial<Record<keyof Inventory, number>> {
  return { ...DECONSTRUCT_REFUND[buildingType] };
}
