import { ALL_ITEM_IDS } from "../items/registry";
import type { ItemId } from "../items/types";
import type { Inventory } from "../store/types";

export function getItemCount(inventory: Inventory, itemId: ItemId): number {
  const value = inventory[itemId];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function hasItem(
  inventory: Inventory,
  itemId: ItemId,
  amount: number,
): boolean {
  if (amount <= 0) return true;
  return getItemCount(inventory, itemId) >= amount;
}

export function addItem(
  inventory: Inventory,
  itemId: ItemId,
  amount: number,
): Inventory {
  if (amount <= 0) return inventory;
  return {
    ...inventory,
    [itemId]: getItemCount(inventory, itemId) + amount,
  };
}

export function removeItem(
  inventory: Inventory,
  itemId: ItemId,
  amount: number,
): Inventory | null {
  if (amount <= 0) return inventory;

  const current = getItemCount(inventory, itemId);
  if (current < amount) return null;

  return {
    ...inventory,
    [itemId]: current - amount,
  };
}

export function getAllItems(
  inventory: Inventory,
): Array<{ itemId: ItemId; count: number }> {
  return ALL_ITEM_IDS.map((itemId) => ({
    itemId,
    count: getItemCount(inventory, itemId),
  }));
}
