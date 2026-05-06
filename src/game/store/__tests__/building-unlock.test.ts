// ============================================================
// Tests — MapShop building unlock system
// ============================================================
//
// Covers:
//   1. Save migration v30 -> v31 unlocks ALL buildings for legacy saves.
//   2. BUY_BUILDING_UNLOCK action: success, idempotent re-buy, insufficient coins.
//   3. BUILD_PLACE_BUILDING is rejected for locked building types.

import {
  gameReducer,
  createInitialState,
  addResources,
  cellKey,
} from "../reducer";
import type { GameState, PlacedAsset } from "../types";
import {
  CURRENT_SAVE_VERSION,
  migrateSave,
} from "../../simulation/save-migrations";
import { serializeState } from "../../simulation/save-codec";

function emptyInv() {
  return createInitialState("release").inventory;
}

// ---------------------------------------------------------------------------
// 1. Save migration v30 -> v31
// ---------------------------------------------------------------------------

describe("save migration v30 -> v31 (unlockedBuildings)", () => {
  it("unlocks every building type for a legacy v30 save", () => {
    const latest = serializeState(createInitialState("release"));
    // Drop the v31 field and pin to v30 so the migrator runs the new step.
    const {
      version: _ignoreVersion,
      unlockedBuildings: _dropUnlocks,
      ...legacyShape
    } = latest as any;
    const v30 = { ...legacyShape, version: 30 };

    const result = migrateSave(v30);

    expect(result).not.toBeNull();
    expect(result!.version).toBe(CURRENT_SAVE_VERSION);
    expect(result!.unlockedBuildings).toEqual(
      expect.arrayContaining([
        "workbench",
        "warehouse",
        "smithy",
        "generator",
        "cable",
        "battery",
        "power_pole",
        "auto_miner",
        "conveyor",
        "conveyor_corner",
        "conveyor_merger",
        "conveyor_splitter",
        "conveyor_underground_in",
        "conveyor_underground_out",
        "manual_assembler",
        "auto_smelter",
        "auto_assembler",
        "service_hub",
        "dock_warehouse",
        "module_lab",
      ]),
    );
    expect(result!.unlockedBuildings).toHaveLength(20);
  });
});

// ---------------------------------------------------------------------------
// 2. Shop action — BUY_BUILDING_UNLOCK
// ---------------------------------------------------------------------------

describe("BUY_BUILDING_UNLOCK", () => {
  function richState(): GameState {
    const base = createInitialState("release");
    return {
      ...base,
      inventory: { ...base.inventory, coins: 10_000 },
    };
  }

  it("unlocks a building, deducts coins, and is recorded in unlockedBuildings", () => {
    const before = richState();
    const coinsBefore = before.inventory.coins;
    expect(before.unlockedBuildings).not.toContain("smithy");

    const after = gameReducer(before, {
      type: "BUY_BUILDING_UNLOCK",
      buildingType: "smithy",
    });

    expect(after.unlockedBuildings).toContain("smithy");
    expect(after.inventory.coins).toBeLessThan(coinsBefore);
  });

  it("blocks a duplicate purchase without charging coins", () => {
    const start = richState();
    const first = gameReducer(start, {
      type: "BUY_BUILDING_UNLOCK",
      buildingType: "smithy",
    });
    const coinsAfterFirst = first.inventory.coins;
    const occurrencesAfterFirst = first.unlockedBuildings.filter(
      (b) => b === "smithy",
    ).length;

    const second = gameReducer(first, {
      type: "BUY_BUILDING_UNLOCK",
      buildingType: "smithy",
    });

    expect(second.inventory.coins).toBe(coinsAfterFirst);
    expect(second.unlockedBuildings.filter((b) => b === "smithy").length).toBe(
      occurrencesAfterFirst,
    );
    // An error notification should surface the rejection.
    expect(second.notifications.some((n) => n.kind === "error")).toBe(true);
  });

  it("rejects the purchase when coins are insufficient", () => {
    const start: GameState = {
      ...createInitialState("release"),
    };
    start.inventory = { ...start.inventory, coins: 1 };

    const after = gameReducer(start, {
      type: "BUY_BUILDING_UNLOCK",
      buildingType: "smithy",
    });

    expect(after.unlockedBuildings).not.toContain("smithy");
    expect(after.inventory.coins).toBe(1);
    expect(after.notifications.some((n) => n.kind === "error")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Place-building guard
// ---------------------------------------------------------------------------

describe("BUILD_PLACE_BUILDING locked-type guard", () => {
  function buildPlaceableState(): GameState {
    const base = createInitialState("release");
    const wh: PlacedAsset = {
      id: "wh-A",
      type: "warehouse",
      x: 11,
      y: 11,
      size: 2,
      direction: "south",
    };
    return {
      ...base,
      assets: { ...base.assets, "wh-A": wh },
      cellMap: {
        ...base.cellMap,
        [cellKey(11, 11)]: "wh-A",
        [cellKey(12, 11)]: "wh-A",
        [cellKey(11, 12)]: "wh-A",
        [cellKey(12, 12)]: "wh-A",
      },
      warehousesPlaced: 1,
      warehousesPurchased: 1,
      warehouseInventories: {
        ...base.warehouseInventories,
        "wh-A": emptyInv(),
      },
      inventory: addResources(emptyInv(), {
        wood: 200,
        stone: 200,
        iron: 200,
        copper: 200,
        ironIngot: 200,
        copperIngot: 200,
        coins: 1000,
      }),
    };
  }

  it("rejects placement when the building is not unlocked", () => {
    // Smithy is NOT in tier-0 unlocked set.
    const start: GameState = {
      ...buildPlaceableState(),
      selectedBuildingType: "smithy",
      buildMode: true,
    };
    expect(start.unlockedBuildings).not.toContain("smithy");

    const after = gameReducer(start, {
      type: "BUILD_PLACE_BUILDING",
      x: 20,
      y: 11,
    });

    const smithies = Object.values(after.assets).filter(
      (a) => a.type === "smithy",
    );
    expect(smithies).toHaveLength(0);
    expect(after.notifications.some((n) => n.kind === "error")).toBe(true);
  });

  it("allows placement after the building is unlocked via the shop", () => {
    const start: GameState = {
      ...buildPlaceableState(),
      selectedBuildingType: "smithy",
      buildMode: true,
    };

    const unlocked = gameReducer(start, {
      type: "BUY_BUILDING_UNLOCK",
      buildingType: "smithy",
    });
    expect(unlocked.unlockedBuildings).toContain("smithy");

    const placed = gameReducer(unlocked, {
      type: "BUILD_PLACE_BUILDING",
      x: 20,
      y: 11,
    });

    const smithies = Object.values(placed.assets).filter(
      (a) => a.type === "smithy",
    );
    expect(smithies).toHaveLength(1);
  });

  it("allows placing a tier-0 building (workbench) without any shop interaction", () => {
    const start: GameState = {
      ...buildPlaceableState(),
      selectedBuildingType: "workbench",
      buildMode: true,
    };
    expect(start.unlockedBuildings).toContain("workbench");

    const after = gameReducer(start, {
      type: "BUILD_PLACE_BUILDING",
      x: 20,
      y: 11,
    });

    const workbenches = Object.values(after.assets).filter(
      (a) => a.type === "workbench",
    );
    expect(workbenches).toHaveLength(1);
  });
});
