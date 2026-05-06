import type { ItemId } from "../items/types";
import {
  FRAGMENT_TRADER_BALANCE,
  SHIP_DOCK_WAIT_MAX_MS,
  SHIP_FRAGMENT_PITY_THRESHOLD as BALANCED_SHIP_FRAGMENT_PITY_THRESHOLD,
} from "./ship-balance";

export const MODULE_FRAGMENT_ITEM_ID: ItemId = "gear";
export const FRAGMENT_TRADER_BASE_COST = FRAGMENT_TRADER_BALANCE.baseCost;
export const FRAGMENT_TRADER_PITY_COST = FRAGMENT_TRADER_BALANCE.pityCost;
export const PITY_THRESHOLD = FRAGMENT_TRADER_BALANCE.pityThreshold;
export const SHIP_FRAGMENT_PITY_THRESHOLD =
  BALANCED_SHIP_FRAGMENT_PITY_THRESHOLD;
export const SHIP_WAIT_DURATION_MS = SHIP_DOCK_WAIT_MAX_MS;

export function getFragmentTraderCostForShipsSinceLastFragment(
  shipsSinceLastFragment: number,
): number {
  return shipsSinceLastFragment >= PITY_THRESHOLD
    ? FRAGMENT_TRADER_PITY_COST
    : FRAGMENT_TRADER_BASE_COST;
}
