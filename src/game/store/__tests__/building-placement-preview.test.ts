import { GRID_W } from "../../constants/grid";
import { cellKey } from "../utils/cell-key";
import { createInitialState } from "../initial-state";
import {
  isConveyorPreviewBuildingType,
  previewBuildingPlacementAtCell,
} from "../building-placement-preview";
import type { Direction, GameState, PlacedAsset } from "../types";

function ugIn(
  id: string,
  x: number,
  y: number,
  direction: Direction,
): PlacedAsset {
  return { id, type: "conveyor_underground_in", x, y, size: 1, direction };
}

function stateWithoutServiceHubs(base: GameState): GameState {
  const hubIds = new Set(
    Object.values(base.assets)
      .filter((a) => a.type === "service_hub")
      .map((a) => a.id),
  );
  const assets = { ...base.assets };
  for (const id of hubIds) {
    delete assets[id];
  }
  const cellMap = { ...base.cellMap };
  for (const [k, v] of Object.entries(cellMap)) {
    if (hubIds.has(v)) delete cellMap[k];
  }
  return { ...base, assets, cellMap };
}

function withPlacementResources(state: GameState): GameState {
  return {
    ...state,
    inventory: {
      ...state.inventory,
      wood: 999,
      stone: 999,
      iron: 999,
      copper: 999,
    },
  };
}

describe("isConveyorPreviewBuildingType", () => {
  test("true for conveyor-like types", () => {
    expect(isConveyorPreviewBuildingType("conveyor")).toBe(true);
    expect(isConveyorPreviewBuildingType("conveyor_underground_out")).toBe(
      true,
    );
  });

  test("false for unrelated types", () => {
    expect(isConveyorPreviewBuildingType("workbench")).toBe(false);
    expect(isConveyorPreviewBuildingType(null)).toBe(false);
  });
});

describe("previewBuildingPlacementAtCell", () => {
  test("conveyor ok when cell empty and resources available (no hub path)", () => {
    const base = stateWithoutServiceHubs(createInitialState("release"));
    const state: GameState = {
      ...base,
      inventory: { ...base.inventory, iron: 10 },
    };
    const r = previewBuildingPlacementAtCell(state, "conveyor", 9, 9, "east");
    expect(r).toEqual({ ok: true });
  });

  test("conveyor blocked when not enough resources without construction site", () => {
    const base = stateWithoutServiceHubs(createInitialState("release"));
    const state: GameState = {
      ...base,
      inventory: { ...base.inventory, iron: 0 },
    };
    const r = previewBuildingPlacementAtCell(state, "conveyor", 40, 25, "east");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("not_enough_resources");
      expect(r.message).toMatch(/Nicht genug Ressourcen/i);
    }
  });

  test("conveyor blocked when target cell occupied", () => {
    const occupiedAsset: PlacedAsset = {
      id: "occupied",
      type: "tree",
      x: 9,
      y: 9,
      size: 1,
    };
    const base: GameState = {
      ...withPlacementResources(createInitialState("release")),
      assets: { occupied: occupiedAsset },
      cellMap: { [cellKey(9, 9)]: "occupied" },
    };
    const r = previewBuildingPlacementAtCell(base, "conveyor", 9, 9, "east");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("cell_occupied");
      expect(r.message).toBe("Das Feld ist belegt.");
    }
  });

  test("out of bounds", () => {
    const base = createInitialState("release");
    const r = previewBuildingPlacementAtCell(
      base,
      "conveyor",
      GRID_W,
      10,
      "east",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("out_of_bounds");
      expect(r.message).toMatch(/Außerhalb/i);
    }
  });

  test("underground out ok when entrance in range and span in bounds", () => {
    const tin = ugIn("tin", 10, 10, "east");
    const base = withPlacementResources(createInitialState("release"));
    const state: GameState = {
      ...base,
      assets: { ...base.assets, tin },
      cellMap: {
        ...base.cellMap,
        [cellKey(10, 10)]: "tin",
      },
      conveyorUndergroundPeers: {},
    };
    const r = previewBuildingPlacementAtCell(
      state,
      "conveyor_underground_out",
      13,
      10,
      "east",
    );
    expect(r).toEqual({ ok: true });
  });

  test("underground out pairing message when no entrance", () => {
    const base = withPlacementResources(createInitialState("release"));
    const r = previewBuildingPlacementAtCell(
      base,
      "conveyor_underground_out",
      15,
      10,
      "east",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("ug_pairing");
      expect(r.message.length).toBeGreaterThan(10);
    }
  });

  test("underground in uses same resource rules as conveyor", () => {
    const base = stateWithoutServiceHubs(createInitialState("release"));
    const state: GameState = {
      ...base,
      inventory: { ...base.inventory, iron: 0 },
    };
    const r = previewBuildingPlacementAtCell(
      state,
      "conveyor_underground_in",
      30,
      20,
      "north",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("not_enough_resources");
  });
});
