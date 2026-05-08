import { createInitialState } from "../../store/initial-state";
import type { Inventory } from "../../store/types";
import { ALL_ITEM_IDS } from "../../items/registry";
import {
  addItem,
  getAllItems,
  getItemCount,
  hasItem,
  removeItem,
} from "../helpers";

function emptyInventory(): Inventory {
  return createInitialState("release").inventory;
}

function makeInventory(overrides: Partial<Inventory>): Inventory {
  return { ...emptyInventory(), ...overrides };
}

describe("inventory helpers", () => {
  describe("getItemCount", () => {
    it("returns current amount for known items", () => {
      const inventory = makeInventory({ wood: 7, iron: 2 });
      expect(getItemCount(inventory, "wood")).toBe(7);
      expect(getItemCount(inventory, "iron")).toBe(2);
    });

    it("returns 0 for runtime-missing entries", () => {
      const inventory = makeInventory({ wood: 5 });
      const broken = { ...inventory };
      Reflect.deleteProperty(broken, "wood");

      expect(getItemCount(broken, "wood")).toBe(0);
    });
  });

  describe("hasItem", () => {
    it("is true when enough stock exists", () => {
      const inventory = makeInventory({ copper: 4 });
      expect(hasItem(inventory, "copper", 3)).toBe(true);
    });

    it("is false when stock is insufficient", () => {
      const inventory = makeInventory({ copper: 2 });
      expect(hasItem(inventory, "copper", 3)).toBe(false);
    });

    it("is true for non-positive requested amount", () => {
      const inventory = makeInventory({ copper: 0 });
      expect(hasItem(inventory, "copper", 0)).toBe(true);
      expect(hasItem(inventory, "copper", -2)).toBe(true);
    });
  });

  describe("addItem", () => {
    it("adds amount to the selected item", () => {
      const inventory = makeInventory({ ironIngot: 3 });
      const next = addItem(inventory, "ironIngot", 5);

      expect(next.ironIngot).toBe(8);
      expect(next.wood).toBe(inventory.wood);
    });

    it("returns same object for non-positive amounts", () => {
      const inventory = makeInventory({ stone: 9 });
      expect(addItem(inventory, "stone", 0)).toBe(inventory);
      expect(addItem(inventory, "stone", -4)).toBe(inventory);
    });
  });

  describe("removeItem", () => {
    it("subtracts amount when enough stock exists", () => {
      const inventory = makeInventory({ gear: 6 });
      const next = removeItem(inventory, "gear", 4);

      expect(next).not.toBeNull();
      expect(next?.gear).toBe(2);
      expect(next?.iron).toBe(inventory.iron);
    });

    it("returns null when stock is insufficient", () => {
      const inventory = makeInventory({ gear: 1 });
      expect(removeItem(inventory, "gear", 2)).toBeNull();
    });

    it("returns same object for non-positive amounts", () => {
      const inventory = makeInventory({ gear: 1 });
      expect(removeItem(inventory, "gear", 0)).toBe(inventory);
      expect(removeItem(inventory, "gear", -3)).toBe(inventory);
    });
  });

  describe("getAllItems", () => {
    it("returns one entry per ItemId in registry order", () => {
      const inventory = makeInventory({ wood: 9, copperIngot: 2 });
      const items = getAllItems(inventory);

      expect(items).toHaveLength(ALL_ITEM_IDS.length);
      expect(items[0].itemId).toBe(ALL_ITEM_IDS[0]);

      const woodRow = items.find((row) => row.itemId === "wood");
      const copperIngotRow = items.find((row) => row.itemId === "copperIngot");

      expect(woodRow?.count).toBe(9);
      expect(copperIngotRow?.count).toBe(2);
    });
  });
});
