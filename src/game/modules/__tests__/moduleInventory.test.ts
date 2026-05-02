import { createInitialState, gameReducer } from "../../store/reducer";
import { loadAndHydrate, serializeState } from "../../simulation/save";
import {
  FRAGMENT_TRADER_BASE_COST,
  FRAGMENT_TRADER_PITY_COST,
  PITY_THRESHOLD,
} from "../../ship/ship-constants";

function freshState() {
  return createInitialState("release");
}

describe("moduleInventory", () => {
  it("BUY_FRAGMENT with enough coins creates a tier-1 unequipped module", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 750 },
    };

    const next = gameReducer(state, { type: "BUY_FRAGMENT" });

    expect(next.inventory.coins).toBe(750 - FRAGMENT_TRADER_BASE_COST);
    expect(next.moduleInventory).toHaveLength(1);
    expect(next.moduleInventory[0].id).toEqual(expect.any(String));
    expect(next.moduleInventory[0].id.length).toBeGreaterThan(0);
    expect(next.moduleInventory[0]).toMatchObject({
      type: "miner-boost",
      tier: 1,
      equippedTo: null,
    });
  });

  it("BUY_FRAGMENT with pity at the threshold costs 250 and creates a module", () => {
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
    expect(next.moduleInventory).toHaveLength(1);
  });

  it("BUY_FRAGMENT with too few coins leaves state unchanged", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 499 },
    };

    const next = gameReducer(state, { type: "BUY_FRAGMENT" });

    expect(next).toBe(state);
    expect(next.inventory.coins).toBe(499);
    expect(next.moduleInventory).toHaveLength(0);
  });

  it("hydrates missing moduleInventory to an empty array", () => {
    const saveWithoutModules = {
      ...serializeState(freshState()),
      moduleInventory: undefined,
    };
    delete (saveWithoutModules as { moduleInventory?: unknown }).moduleInventory;

    const hydrated = loadAndHydrate(saveWithoutModules, "release");

    expect(hydrated.moduleInventory).toEqual([]);
  });
});
