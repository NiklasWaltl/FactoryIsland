import { gameReducer, createInitialState } from "../../store/reducer";
import { DOCK_WAREHOUSE_ID } from "../../store/bootstrap/apply-dock-warehouse-layout";
import { WAREHOUSE_CAPACITY } from "../../store/constants/buildings";
import {
  FRAGMENT_TRADER_BASE_COST,
  FRAGMENT_TRADER_PITY_COST,
  MODULE_FRAGMENT_ITEM_ID,
  PITY_THRESHOLD,
} from "../ship-constants";

function freshState() {
  return createInitialState("release");
}

describe("fragment trader", () => {
  it("BUY_FRAGMENT spends 500 coins, stages a fragment, and resets pity", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 750 },
      ship: { ...freshState().ship, shipsSinceLastFragment: 4 },
    };

    const next = gameReducer(state, { type: "BUY_FRAGMENT" });

    expect(next.inventory.coins).toBe(750 - FRAGMENT_TRADER_BASE_COST);
    expect(next.moduleInventory).toHaveLength(0);
    expect(
      next.warehouseInventories[DOCK_WAREHOUSE_ID][MODULE_FRAGMENT_ITEM_ID],
    ).toBe(1);
    expect(next.ship.shipsSinceLastFragment).toBe(0);
  });

  it("BUY_FRAGMENT is a no-op when coins are below the current price", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 499 },
    };

    const next = gameReducer(state, { type: "BUY_FRAGMENT" });

    expect(next).toBe(state);
  });

  it("BUY_FRAGMENT uses the 250 coin pity price at the threshold", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 250 },
      ship: {
        ...freshState().ship,
        shipsSinceLastFragment: PITY_THRESHOLD,
      },
    };

    const next = gameReducer(state, { type: "BUY_FRAGMENT" });

    expect(next.inventory.coins).toBe(250 - FRAGMENT_TRADER_PITY_COST);
    expect(
      next.warehouseInventories[DOCK_WAREHOUSE_ID][MODULE_FRAGMENT_ITEM_ID],
    ).toBe(1);
    expect(next.ship.shipsSinceLastFragment).toBe(0);
  });

  it("BUY_FRAGMENT does not use dock warehouse capacity as a guard", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 750 },
      warehouseInventories: {
        ...freshState().warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...freshState().warehouseInventories[DOCK_WAREHOUSE_ID],
          [MODULE_FRAGMENT_ITEM_ID]: WAREHOUSE_CAPACITY,
        },
      },
    };

    const next = gameReducer(state, { type: "BUY_FRAGMENT" });

    expect(next).not.toBe(state);
    expect(next.inventory.coins).toBe(750 - FRAGMENT_TRADER_BASE_COST);
    expect(next.moduleInventory).toHaveLength(0);
    expect(
      next.warehouseInventories[DOCK_WAREHOUSE_ID][MODULE_FRAGMENT_ITEM_ID],
    ).toBe(WAREHOUSE_CAPACITY + 1);
  });
});
