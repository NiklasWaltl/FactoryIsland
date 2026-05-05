import type { CraftingJob } from "../../crafting/types";
import { AUTO_MINER_PRODUCE_TICKS } from "../constants/drone/drone-config";
import {
  cellKey,
  createInitialState,
  gameReducer,
  type AutoMinerEntry,
  type ConveyorState,
  type GameState,
  type GeneratorState,
  type Inventory,
  type PlacedAsset,
} from "../reducer";

function emptyInventory(): Inventory {
  return createInitialState("release").inventory;
}

function assetWidth(asset: PlacedAsset): number {
  return asset.width ?? asset.size;
}

function assetHeight(asset: PlacedAsset): number {
  return asset.height ?? asset.size;
}

function cellMapForAssets(
  assets: readonly PlacedAsset[],
): Record<string, string> {
  const cellMap: Record<string, string> = {};
  for (const asset of assets) {
    for (let offsetY = 0; offsetY < assetHeight(asset); offsetY += 1) {
      for (let offsetX = 0; offsetX < assetWidth(asset); offsetX += 1) {
        cellMap[cellKey(asset.x + offsetX, asset.y + offsetY)] = asset.id;
      }
    }
  }
  return cellMap;
}

function stateWithAssets(assets: readonly PlacedAsset[]): GameState {
  const base = createInitialState("release");
  return {
    ...base,
    assets: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    cellMap: cellMapForAssets(assets),
    connectedAssetIds: assets.map((asset) => asset.id),
  };
}

describe("deconstructing assets in tick systems", () => {
  it("pauses auto-miner production and resumes when status clears", () => {
    const minerAsset: PlacedAsset = {
      id: "miner-1",
      type: "auto_miner",
      x: 5,
      y: 5,
      size: 1,
      direction: "east",
      status: "deconstructing",
    };
    const minerEntry: AutoMinerEntry = {
      depositId: "iron-deposit",
      resource: "iron",
      progress: AUTO_MINER_PRODUCE_TICKS,
    };
    const state = {
      ...stateWithAssets([minerAsset]),
      autoMiners: { [minerAsset.id]: minerEntry },
      machinePowerRatio: { [minerAsset.id]: 1 },
    };

    const paused = gameReducer(state, { type: "LOGISTICS_TICK" });

    expect(paused.inventory.iron).toBe(0);
    expect(paused.autoMiners[minerAsset.id].progress).toBe(
      AUTO_MINER_PRODUCE_TICKS,
    );

    const { status: _status, ...activeMinerAsset } = minerAsset;
    const resumed = gameReducer(
      {
        ...paused,
        assets: { ...paused.assets, [minerAsset.id]: activeMinerAsset },
      },
      { type: "LOGISTICS_TICK" },
    );

    expect(resumed.inventory.iron).toBeGreaterThan(0);
    expect(resumed.autoMiners[minerAsset.id].progress).toBe(0);
  });

  it("does not store conveyor items in a deconstructing warehouse", () => {
    const warehouseAsset: PlacedAsset = {
      id: "warehouse-1",
      type: "warehouse",
      x: 5,
      y: 5,
      size: 2,
      direction: "south",
      status: "deconstructing",
    };
    const conveyorAsset: PlacedAsset = {
      id: "conveyor-1",
      type: "conveyor",
      x: 5,
      y: 7,
      size: 1,
      direction: "east",
    };
    const conveyorState: ConveyorState = { queue: ["wood"] };
    const state = {
      ...stateWithAssets([warehouseAsset, conveyorAsset]),
      conveyors: { [conveyorAsset.id]: conveyorState },
      poweredMachineIds: [conveyorAsset.id],
      warehouseInventories: { [warehouseAsset.id]: emptyInventory() },
    };

    const paused = gameReducer(state, { type: "LOGISTICS_TICK" });

    expect(paused.conveyors[conveyorAsset.id].queue).toEqual(["wood"]);
    expect(paused.warehouseInventories[warehouseAsset.id].wood).toBe(0);

    const { status: _status, ...activeWarehouseAsset } = warehouseAsset;
    const resumed = gameReducer(
      {
        ...paused,
        assets: {
          ...paused.assets,
          [warehouseAsset.id]: activeWarehouseAsset,
        },
      },
      { type: "LOGISTICS_TICK" },
    );

    expect(resumed.conveyors[conveyorAsset.id].queue).toEqual([]);
    expect(resumed.warehouseInventories[warehouseAsset.id].wood).toBe(1);
  });

  it("excludes deconstructing consumers from the energy tick", () => {
    const generatorAsset: PlacedAsset = {
      id: "generator-1",
      type: "generator",
      x: 1,
      y: 1,
      size: 2,
    };
    const poleAsset: PlacedAsset = {
      id: "pole-1",
      type: "power_pole",
      x: 3,
      y: 1,
      size: 1,
    };
    const minerAsset: PlacedAsset = {
      id: "miner-1",
      type: "auto_miner",
      x: 4,
      y: 1,
      size: 1,
      direction: "east",
      status: "deconstructing",
    };
    const runningGenerator: GeneratorState = {
      fuel: 5,
      progress: 0,
      running: true,
    };
    const state = {
      ...stateWithAssets([generatorAsset, poleAsset, minerAsset]),
      generators: { [generatorAsset.id]: runningGenerator },
    };

    const paused = gameReducer(state, { type: "ENERGY_NET_TICK" });

    expect(paused.poweredMachineIds).not.toContain(minerAsset.id);
    expect(paused.machinePowerRatio[minerAsset.id]).toBeUndefined();

    const { status: _status, ...activeMinerAsset } = minerAsset;
    const resumed = gameReducer(
      {
        ...paused,
        assets: { ...paused.assets, [minerAsset.id]: activeMinerAsset },
      },
      { type: "ENERGY_NET_TICK" },
    );

    expect(resumed.poweredMachineIds).toContain(minerAsset.id);
    expect(resumed.machinePowerRatio[minerAsset.id]).toBe(1);
  });

  it("pauses generator fuel burn and resumes when status clears", () => {
    const generatorAsset: PlacedAsset = {
      id: "generator-1",
      type: "generator",
      x: 5,
      y: 5,
      size: 2,
      status: "deconstructing",
    };
    const runningGenerator: GeneratorState = {
      fuel: 5,
      progress: 0,
      running: true,
    };
    const state = {
      ...stateWithAssets([generatorAsset]),
      generators: { [generatorAsset.id]: runningGenerator },
    };

    const paused = gameReducer(state, { type: "GENERATOR_TICK" });

    expect(paused.generators[generatorAsset.id]).toEqual(runningGenerator);

    const { status: _status, ...activeGeneratorAsset } = generatorAsset;
    const resumed = gameReducer(
      {
        ...paused,
        assets: {
          ...paused.assets,
          [generatorAsset.id]: activeGeneratorAsset,
        },
      },
      { type: "GENERATOR_TICK" },
    );

    expect(resumed.generators[generatorAsset.id].progress).toBeGreaterThan(0);
  });

  it("pauses active workbench jobs and resumes when status clears", () => {
    const workbenchAsset: PlacedAsset = {
      id: "workbench-1",
      type: "workbench",
      x: 5,
      y: 5,
      size: 1,
      status: "deconstructing",
    };
    const job: CraftingJob = {
      id: "job-1",
      recipeId: "wood_plank",
      workbenchId: workbenchAsset.id,
      inventorySource: { kind: "global" },
      status: "crafting",
      priority: "normal",
      source: "player",
      enqueuedAt: 1,
      startedAt: 1,
      finishesAt: 3,
      progress: 1,
      ingredients: [],
      output: { itemId: "wood", count: 1 },
      processingTime: 3,
      reservationOwnerId: "job-1",
    };
    const state = {
      ...stateWithAssets([workbenchAsset]),
      crafting: { jobs: [job], nextJobSeq: 2, lastError: null },
    };

    const paused = gameReducer(state, { type: "JOB_TICK" });

    expect(paused.crafting.jobs[0].status).toBe("crafting");
    expect(paused.crafting.jobs[0].progress).toBe(1);

    const { status: _status, ...activeWorkbenchAsset } = workbenchAsset;
    const resumed = gameReducer(
      {
        ...paused,
        assets: {
          ...paused.assets,
          [workbenchAsset.id]: activeWorkbenchAsset,
        },
      },
      { type: "JOB_TICK" },
    );

    expect(resumed.crafting.jobs[0].status).toBe("crafting");
    expect(resumed.crafting.jobs[0].progress).toBe(2);
  });
});
