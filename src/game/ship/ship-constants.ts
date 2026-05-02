import type { ItemId } from "../items/types";

export const MODULE_FRAGMENT_ITEM_ID: ItemId = "gear";
export const FRAGMENT_TRADER_BASE_COST = 500;
export const FRAGMENT_TRADER_PITY_COST = 250;
export const PITY_THRESHOLD = 10;

export function getFragmentTraderCostForShipsSinceLastFragment(
	shipsSinceLastFragment: number,
): number {
	return shipsSinceLastFragment >= PITY_THRESHOLD
		? FRAGMENT_TRADER_PITY_COST
		: FRAGMENT_TRADER_BASE_COST;
}
