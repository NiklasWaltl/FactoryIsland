// ============================================================
// Tests — Building unlock pipeline (Research Lab era)
// ============================================================
//
// Covers:
//   1. Save migration v30 -> v31 unlocks every building that
//      existed pre-Research-Lab for legacy saves.
//   2. Save migration v31 -> v32 idempotently appends
//      research_lab to legacy save unlocks (no other shape change).
//   3. BUILD_PLACE_BUILDING is rejected for locked building types
//      and accepted once the building has been researched.
//
// The dedicated RESEARCH_BUILDING action surface (success / idempotent /
// missing items) lives in research.test.ts.

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
  it("unlocks every pre-Research-Lab building type for a legacy v30 save", () => {
    const latest = serializeState(createInitialState("release"));
    // Drop the v31/v32 fields and pin to v30 so the migrator runs the new step.
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
        "research_lab",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Save migration v31 -> v32 (research_lab back-fill)
// ---------------------------------------------------------------------------

describe("save migration v31 -> v32 (research_lab back-fill)", () => {
  it("appends research_lab to existing unlockedBuildings (idempotent)", () => {
    const latest = serializeState(createInitialState("release"));
    const v31 = {
      ...(latest as any),
      version: 31,
      unlockedBuildings: ["workbench", "warehouse", "service_hub"],
    };

    const result = migrateSave(v31);
    expect(result).not.toBeNull();
    expect(result!.version).toBe(CURRENT_SAVE_VERSION);
    expect(result!.unlockedBuildings).toContain("research_lab");
  });

  it("does not duplicate research_lab when it already exists", () => {
    const latest = serializeState(createInitialState("release"));
    const v31 = {
      ...(latest as any),
      version: 31,
      unlockedBuildings: ["workbench", "research_lab"],
    };

    const result = migrateSave(v31);
    expect(result).not.toBeNull();
    const occurrences = result!.unlockedBuildings.filter(
      (b) => b === "research_lab",
    ).length;
    expect(occurrences).toBe(1);
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

  it("allows placement after the building is unlocked", () => {
    const base = buildPlaceableState();
    const start: GameState = {
      ...base,
      selectedBuildingType: "smithy",
      buildMode: true,
      unlockedBuildings: [...base.unlockedBuildings, "smithy"],
    };

    const placed = gameReducer(start, {
      type: "BUILD_PLACE_BUILDING",
      x: 20,
      y: 11,
    });

    const smithies = Object.values(placed.assets).filter(
      (a) => a.type === "smithy",
    );
    expect(smithies).toHaveLength(1);
  });

  it("allows placing a tier-0 building (workbench) without any unlock interaction", () => {
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

  it("includes research_lab in TIER_0 so a fresh save can place it", () => {
    const start = createInitialState("release");
    expect(start.unlockedBuildings).toContain("research_lab");
  });
});
