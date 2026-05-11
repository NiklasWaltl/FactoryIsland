// ============================================================
// Tests – Workbench Resource Source (per-building, global vs. warehouse)
// ============================================================

import type { GameState, Inventory, PlacedAsset } from "../types";
import {
  gameReducer,
  createInitialState,
  addResources,
  cellKey,
} from "../reducer";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyInv(): Inventory {
  return createInitialState("release").inventory;
}

/**
 * Build a state with one workbench + two warehouses.
 */
function stateWithWorkbenchAndWarehouses(): GameState {
  const base = createInitialState("release");

  const wb1: PlacedAsset = {
    id: "wb-1",
    type: "workbench",
    x: 3,
    y: 3,
    size: 2,
  };
  const whA: PlacedAsset = {
    id: "wh-A",
    type: "warehouse",
    x: 11,
    y: 11,
    size: 2,
    direction: "south",
  };
  const whB: PlacedAsset = {
    id: "wh-B",
    type: "warehouse",
    x: 20,
    y: 11,
    size: 2,
    direction: "south",
  };

  const assets: Record<string, PlacedAsset> = {
    "wb-1": wb1,
    "wh-A": whA,
    "wh-B": whB,
  };
  const cellMap: Record<string, string> = {
    [cellKey(3, 3)]: "wb-1",
    [cellKey(4, 3)]: "wb-1",
    [cellKey(3, 4)]: "wb-1",
    [cellKey(4, 4)]: "wb-1",
    [cellKey(11, 11)]: "wh-A",
    [cellKey(12, 11)]: "wh-A",
    [cellKey(11, 12)]: "wh-A",
    [cellKey(12, 12)]: "wh-A",
    [cellKey(20, 11)]: "wh-B",
    [cellKey(21, 11)]: "wh-B",
    [cellKey(20, 12)]: "wh-B",
    [cellKey(21, 12)]: "wh-B",
  };

  return {
    ...base,
    assets,
    cellMap,
    placedBuildings: ["workbench"],
    warehousesPlaced: 2,
    warehousesPurchased: 2,
    warehouseInventories: { "wh-A": emptyInv(), "wh-B": emptyInv() },
    connectedAssetIds: ["wb-1", "wh-A", "wh-B"],
    poweredMachineIds: ["wb-1"],
    buildingSourceWarehouseIds: {},
    selectedCraftingBuildingId: "wb-1",
    inventory: addResources(emptyInv(), {
      wood: 999,
      stone: 999,
      iron: 999,
      copper: 999,
    }),
  };
}

/** Build a state with two warehouses and no workbench (for placement tests). */
function stateWithWarehousesOnly(): GameState {
  const base = createInitialState("release");

  const whA: PlacedAsset = {
    id: "wh-A",
    type: "warehouse",
    x: 11,
    y: 11,
    size: 2,
    direction: "south",
  };
  const whB: PlacedAsset = {
    id: "wh-B",
    type: "warehouse",
    x: 20,
    y: 11,
    size: 2,
    direction: "south",
  };

  return {
    ...base,
    assets: {
      "wh-A": whA,
      "wh-B": whB,
    },
    cellMap: {
      [cellKey(11, 11)]: "wh-A",
      [cellKey(12, 11)]: "wh-A",
      [cellKey(11, 12)]: "wh-A",
      [cellKey(12, 12)]: "wh-A",
      [cellKey(20, 11)]: "wh-B",
      [cellKey(21, 11)]: "wh-B",
      [cellKey(20, 12)]: "wh-B",
      [cellKey(21, 12)]: "wh-B",
    },
    warehousesPlaced: 2,
    warehousesPurchased: 2,
    warehouseInventories: { "wh-A": emptyInv(), "wh-B": emptyInv() },
    connectedAssetIds: ["wh-A", "wh-B"],
    poweredMachineIds: [],
    buildingSourceWarehouseIds: {},
    inventory: addResources(emptyInv(), {
      wood: 999,
      stone: 999,
      iron: 999,
      copper: 999,
    }),
  };
}

function enqueueWorkbenchJob(state: GameState, workbenchId: string): GameState {
  return gameReducer(state, {
    type: "JOB_ENQUEUE",
    recipeId: "wood_pickaxe",
    workbenchId,
    source: "player",
    priority: "high",
  });
}

function getSingleQueuedJob(state: GameState) {
  expect(state.crafting.jobs).toHaveLength(1);
  return state.crafting.jobs[0];
}

describe("Workbench source behavior", () => {
  it("buildingSourceWarehouseIds is set when assigning a warehouse", () => {
    const before = stateWithWorkbenchAndWarehouses();
    const assigned = gameReducer(before, {
      type: "SET_BUILDING_SOURCE",
      buildingId: "wb-1",
      warehouseId: "wh-A",
    });

    expect(assigned.buildingSourceWarehouseIds["wb-1"]).toBe("wh-A");

    const enqueued = enqueueWorkbenchJob(assigned, "wb-1");
    const job = getSingleQueuedJob(enqueued);
    expect(job.inventorySource.kind).toBe("warehouse");
    if (job.inventorySource.kind === "warehouse") {
      expect(job.inventorySource.warehouseId).toBe("wh-A");
    }
  });

  it("an unassigned workbench falls back to the nearest warehouse", () => {
    const before = stateWithWarehousesOnly();
    const placed = gameReducer(
      {
        ...before,
        buildMode: true,
        selectedBuildingType: "workbench",
      },
      {
        type: "BUILD_PLACE_BUILDING",
        x: 21,
        y: 14,
      },
    );

    const workbenchIds = Object.values(placed.assets)
      .filter((asset) => asset.type === "workbench")
      .map((asset) => asset.id);
    expect(workbenchIds).toHaveLength(1);
    const placedWorkbenchId = workbenchIds[0];

    expect(placed.buildingSourceWarehouseIds[placedWorkbenchId]).toBe("wh-B");

    const enqueued = enqueueWorkbenchJob(placed, placedWorkbenchId);
    const job = getSingleQueuedJob(enqueued);
    expect(job.inventorySource.kind).toBe("warehouse");
    if (job.inventorySource.kind === "warehouse") {
      expect(job.inventorySource.warehouseId).toBe("wh-B");
    }
  });

  it("reassigns source automatically after deleting the assigned warehouse", () => {
    const before = {
      ...stateWithWorkbenchAndWarehouses(),
      buildingSourceWarehouseIds: { "wb-1": "wh-A" },
    };

    const afterDelete = gameReducer(
      {
        ...before,
        buildMode: true,
      },
      {
        type: "BUILD_REMOVE_ASSET",
        assetId: "wh-A",
      },
    );

    expect(afterDelete.buildingSourceWarehouseIds["wb-1"]).toBe("wh-B");

    const enqueued = enqueueWorkbenchJob(afterDelete, "wb-1");
    const job = getSingleQueuedJob(enqueued);
    expect(job.inventorySource.kind).toBe("warehouse");
    if (job.inventorySource.kind === "warehouse") {
      expect(job.inventorySource.warehouseId).toBe("wh-B");
    }
  });
});
