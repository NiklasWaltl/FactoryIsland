import { createInitialState, gameReducer } from "../../store/reducer";
import { loadAndHydrate, serializeState } from "../../simulation/save";
import { DOCK_WAREHOUSE_ID } from "../../store/bootstrap/apply-dock-warehouse-layout";
import {
  FRAGMENT_TRADER_BASE_COST,
  FRAGMENT_TRADER_PITY_COST,
  MODULE_FRAGMENT_ITEM_ID,
  PITY_THRESHOLD,
} from "../../ship/ship-constants";

function freshState() {
  return createInitialState("release");
}

describe("moduleInventory", () => {
  it("BUY_FRAGMENT with enough coins stages one fragment item in the dock warehouse", () => {
    const state = {
      ...freshState(),
      inventory: { ...freshState().inventory, coins: 750 },
    };

    const next = gameReducer(state, { type: "BUY_FRAGMENT" });

    expect(next.inventory.coins).toBe(750 - FRAGMENT_TRADER_BASE_COST);
    expect(next.moduleInventory).toHaveLength(0);
    expect(
      next.warehouseInventories[DOCK_WAREHOUSE_ID][MODULE_FRAGMENT_ITEM_ID],
    ).toBe(1);
  });

  it("BUY_FRAGMENT with pity at the threshold costs 250 and stages a fragment", () => {
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
    expect(next.moduleFragments).toBe(0);
  });

  it("hydrates missing moduleInventory to an empty array", () => {
    const saveWithoutModules = {
      ...serializeState(freshState()),
      moduleInventory: undefined,
    };
    delete (saveWithoutModules as { moduleInventory?: unknown })
      .moduleInventory;

    const hydrated = loadAndHydrate(saveWithoutModules, "release");

    expect(hydrated.moduleInventory).toEqual([]);
  });

  it("hydrates an empty moduleInventory array as empty", () => {
    const save = {
      ...serializeState(freshState()),
      moduleInventory: [],
    };

    const hydrated = loadAndHydrate(save, "release");

    expect(hydrated.moduleInventory).toEqual([]);
  });

  it("drops moduleInventory entries with unknown module types", () => {
    const save = {
      ...serializeState(freshState()),
      moduleInventory: [
        { id: "valid-miner", type: "miner-boost", tier: 1, equippedTo: null },
        { id: "legacy", type: "archived-boost", tier: 1, equippedTo: null },
      ],
    };

    const hydrated = loadAndHydrate(save, "release");

    expect(hydrated.moduleInventory).toEqual([
      { id: "valid-miner", type: "miner-boost", tier: 1, equippedTo: null },
    ]);
  });

  it("hydrates mixed moduleInventory arrays by keeping only valid entries", () => {
    const save = {
      ...serializeState(freshState()),
      moduleInventory: [
        { id: "valid-miner", type: "miner-boost", tier: 1, equippedTo: null },
        null,
        "not-an-object",
        { id: "", type: "miner-boost", tier: 1, equippedTo: null },
        { id: null, type: "miner-boost", tier: 1, equippedTo: null },
        { id: "missing-type", tier: 1, equippedTo: null },
        { id: "bad-type", type: "unknown", tier: 1, equippedTo: null },
        { id: "bad-tier", type: "miner-boost", tier: 4, equippedTo: null },
        {
          id: "bad-equipped-to",
          type: "smelter-boost",
          tier: 2,
          equippedTo: { assetId: "smelter-1" },
        },
        {
          id: "valid-smelter",
          type: "smelter-boost",
          tier: 3,
          equippedTo: "smelter-1",
        },
      ],
    };

    const hydrated = loadAndHydrate(save, "release");

    expect(hydrated.moduleInventory).toEqual([
      { id: "valid-miner", type: "miner-boost", tier: 1, equippedTo: null },
      {
        id: "valid-smelter",
        type: "smelter-boost",
        tier: 3,
        equippedTo: "smelter-1",
      },
    ]);
  });

  it("normalizes undefined equippedTo to null during moduleInventory hydration", () => {
    const save = {
      ...serializeState(freshState()),
      moduleInventory: [{ id: "free-module", type: "miner-boost", tier: 2 }],
    };

    const hydrated = loadAndHydrate(save, "release");

    expect(hydrated.moduleInventory).toEqual([
      { id: "free-module", type: "miner-boost", tier: 2, equippedTo: null },
    ]);
  });

  it("COLLECT_FRAGMENT with gear in dock warehouse increments fragments and removes one gear", () => {
    const state = {
      ...freshState(),
      warehouseInventories: {
        ...freshState().warehouseInventories,
        [DOCK_WAREHOUSE_ID]: {
          ...freshState().warehouseInventories[DOCK_WAREHOUSE_ID],
          [MODULE_FRAGMENT_ITEM_ID]: 2,
        },
      },
    };

    const next = gameReducer(state, { type: "COLLECT_FRAGMENT" });

    expect(next.moduleFragments).toBe(1);
    expect(
      next.warehouseInventories[DOCK_WAREHOUSE_ID][MODULE_FRAGMENT_ITEM_ID],
    ).toBe(1);
  });

  it("COLLECT_FRAGMENT without gear in dock warehouse leaves state unchanged", () => {
    const state = freshState();

    const next = gameReducer(state, { type: "COLLECT_FRAGMENT" });

    expect(next).toBe(state);
    expect(next.moduleFragments).toBe(0);
  });
});
