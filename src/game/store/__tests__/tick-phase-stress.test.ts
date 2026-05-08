import {
  cellKey,
  createInitialState,
  gameReducer,
  type AutoSmelterEntry,
  type ConveyorItem,
  type ConveyorState,
  type GameAction,
  type GameState,
  type Inventory,
  type PlacedAsset,
  type StarterDroneState,
} from "../reducer";
import type { CraftingJob } from "../../crafting/types";
import { computeConnectedAssetIds } from "../../logistics/connectivity";
import { getSmeltingRecipe } from "../../simulation/recipes";

const CONVEYOR_COUNT = 500;
const DRONE_COUNT = 50;
const PRODUCTION_BUILDING_COUNT = 200;
const AUTO_SMELTER_COUNT = 100;
const WORKBENCH_COUNT = PRODUCTION_BUILDING_COUNT - AUTO_SMELTER_COUNT;
const SIMULATED_TICKS = 100;

type PhaseName = "Power" | "Logistics" | "Drones" | "Crafting";

const PHASES: ReadonlyArray<{ name: PhaseName; action: GameAction }> = [
  { name: "Power", action: { type: "ENERGY_NET_TICK" } },
  { name: "Logistics", action: { type: "LOGISTICS_TICK" } },
  { name: "Drones", action: { type: "DRONE_TICK" } },
  { name: "Crafting", action: { type: "JOB_TICK" } },
];

function markAssetCells(
  cellMap: Record<string, string>,
  asset: PlacedAsset,
): void {
  const width = asset.width ?? asset.size;
  const height = asset.height ?? asset.size;
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      cellMap[cellKey(asset.x + dx, asset.y + dy)] = asset.id;
    }
  }
}

function makeStressInventory(base: Inventory): Inventory {
  return {
    ...base,
    coins: 1_000_000,
    wood: 1_000_000,
    stone: 1_000_000,
    iron: 1_000_000,
    copper: 1_000_000,
    ironIngot: 1_000_000,
    copperIngot: 1_000_000,
    metalPlate: 1_000_000,
    gear: 1_000_000,
  };
}

function addConveyorLine(input: {
  assets: Record<string, PlacedAsset>;
  cellMap: Record<string, string>;
  conveyors: Record<string, ConveyorState>;
}): string[] {
  const conveyorIds: string[] = [];

  for (let index = 0; index < CONVEYOR_COUNT; index++) {
    const row = Math.floor(index / 80);
    const offset = index % 80;
    const x = row % 2 === 0 ? offset : 79 - offset;
    const y = row * 2;
    const id = `stress-conveyor-${index}`;
    const direction = row % 2 === 0 ? "east" : "west";
    const asset: PlacedAsset = {
      id,
      type: "conveyor",
      x,
      y,
      size: 1,
      direction,
      priority: 3,
    };

    input.assets[id] = asset;
    input.conveyors[id] = { queue: ["iron"] };
    markAssetCells(input.cellMap, asset);
    conveyorIds.push(id);
  }

  return conveyorIds;
}

function addPowerNetwork(input: {
  assets: Record<string, PlacedAsset>;
  cellMap: Record<string, string>;
}): void {
  const generator: PlacedAsset = {
    id: "stress-generator",
    type: "generator",
    x: 0,
    y: 15,
    size: 2,
    priority: 1,
  };
  const seedPole: PlacedAsset = {
    id: "stress-power-pole-seed",
    type: "power_pole",
    x: 2,
    y: 15,
    size: 1,
  };
  const battery: PlacedAsset = {
    id: "stress-battery",
    type: "battery",
    x: 4,
    y: 15,
    size: 2,
  };

  for (const asset of [generator, seedPole, battery]) {
    input.assets[asset.id] = asset;
    markAssetCells(input.cellMap, asset);
  }

  for (let y = 1; y < 50; y += 3) {
    for (let x = 0; x < 80; x += 3) {
      const id = `stress-power-pole-${x}-${y}`;
      if (input.assets[id]) continue;
      input.assets[id] = {
        id,
        type: "power_pole",
        x,
        y,
        size: 1,
      };
    }
  }
}

function makeRunningAutoSmelter(index: number): AutoSmelterEntry {
  const recipe = getSmeltingRecipe("iron");
  if (!recipe) throw new Error("Expected iron smelting recipe in stress test.");

  return {
    inputBuffer: Array.from({ length: 20 }, () => "iron" as ConveyorItem),
    processing: {
      inputItem: "iron",
      outputItem: recipe.outputItem as ConveyorItem,
      progressMs: index % 1_000,
      durationMs: recipe.processingTime * 1_000,
    },
    pendingOutput: [],
    status: "PROCESSING",
    lastRecipeInput: recipe.inputItem,
    lastRecipeOutput: recipe.outputItem,
    throughputEvents: [],
    selectedRecipe: "iron",
  };
}

function makeCraftingJob(index: number, workbenchId: string): CraftingJob {
  return {
    id: `stress-crafting-job-${index}`,
    recipeId: "wood_pickaxe",
    workbenchId,
    inventorySource: { kind: "global" },
    status: "crafting",
    priority: "normal",
    source: "automation",
    enqueuedAt: index + 1,
    startedAt: 0,
    finishesAt: null,
    progress: index % 100,
    ingredients: [{ itemId: "wood", count: 5 }],
    output: { itemId: "wood_pickaxe", count: 1 },
    processingTime: 1_000,
    reservationOwnerId: `stress-crafting-job-${index}`,
  };
}

function addProductionBuildings(input: {
  assets: Record<string, PlacedAsset>;
  cellMap: Record<string, string>;
  autoSmelters: Record<string, AutoSmelterEntry>;
  jobs: CraftingJob[];
}): string[] {
  const productionIds: string[] = [];
  let workbenchIndex = 0;

  for (let index = 0; index < PRODUCTION_BUILDING_COUNT; index++) {
    const x = (index % 40) * 2;
    const y = 20 + Math.floor(index / 40);
    const isSmelter = index < AUTO_SMELTER_COUNT;
    const id = isSmelter
      ? `stress-auto-smelter-${index}`
      : `stress-workbench-${workbenchIndex}`;
    const asset: PlacedAsset = isSmelter
      ? {
          id,
          type: "auto_smelter",
          x,
          y,
          size: 2,
          width: 2,
          height: 1,
          direction: "east",
          priority: 3,
        }
      : {
          id,
          type: "workbench",
          x,
          y,
          size: 1,
        };

    input.assets[id] = asset;
    markAssetCells(input.cellMap, asset);
    productionIds.push(id);

    if (isSmelter) {
      input.autoSmelters[id] = makeRunningAutoSmelter(index);
    } else {
      input.jobs.push(makeCraftingJob(workbenchIndex, id));
      workbenchIndex += 1;
    }
  }

  expect(workbenchIndex).toBe(WORKBENCH_COUNT);
  return productionIds;
}

function addActiveDrones(input: {
  collectionNodes: GameState["collectionNodes"];
  drones: Record<string, StarterDroneState>;
}): void {
  for (let index = 0; index < DRONE_COUNT; index++) {
    const droneId = `stress-drone-${index}`;
    const nodeId = `stress-node-${index}`;
    const targetX = index % 50;
    const targetY = 35 + (index % 10);

    input.collectionNodes[nodeId] = {
      id: nodeId,
      itemType: "wood",
      amount: 100,
      tileX: targetX,
      tileY: targetY,
      collectable: true,
      createdAt: 0,
      reservedByDroneId: droneId,
    };

    input.drones[droneId] = {
      status: "moving_to_collect",
      tileX: 79 - (index % 20),
      tileY: 49 - (index % 10),
      targetNodeId: nodeId,
      cargo: null,
      ticksRemaining: 1_000,
      hubId: null,
      currentTaskType: "construction_supply",
      deliveryTargetId: `stress-workbench-${index % WORKBENCH_COUNT}`,
      craftingJobId: null,
      droneId,
      role: "auto",
      deconstructRefund: null,
    };
  }
}

function createStressState(): GameState {
  const base = createInitialState("debug");
  const assets: Record<string, PlacedAsset> = {};
  const cellMap: Record<string, string> = {};
  const conveyors: Record<string, ConveyorState> = {};
  const autoSmelters: Record<string, AutoSmelterEntry> = {};
  const jobs: CraftingJob[] = [];
  const collectionNodes: GameState["collectionNodes"] = {};
  const drones: Record<string, StarterDroneState> = {};

  addConveyorLine({ assets, cellMap, conveyors });
  addPowerNetwork({ assets, cellMap });
  addProductionBuildings({ assets, cellMap, autoSmelters, jobs });
  addActiveDrones({ collectionNodes, drones });

  const state: GameState = {
    ...base,
    mode: "debug",
    assets,
    cellMap,
    inventory: makeStressInventory(base.inventory),
    warehouseInventories: {},
    warehousesPlaced: 0,
    serviceHubs: {},
    constructionSites: {},
    conveyors,
    autoMiners: {},
    autoSmelters,
    autoAssemblers: {},
    generators: {
      "stress-generator": {
        fuel: 1_000_000,
        progress: 0,
        running: true,
        requestedRefill: 0,
      },
    },
    battery: { stored: 1_000_000, capacity: 1_000_000 },
    collectionNodes,
    drones,
    crafting: {
      jobs,
      nextJobSeq: jobs.length + 1,
      lastError: null,
    },
    network: { ...base.network, reservations: [], lastError: null },
    keepStockByWorkbench: {},
    recipeAutomationPolicies: {},
    connectedAssetIds: [],
    poweredMachineIds: [],
    machinePowerRatio: {},
    notifications: [],
    autoDeliveryLog: [],
  };

  return {
    ...state,
    connectedAssetIds: computeConnectedAssetIds(state),
  };
}

function measurePhase(
  state: GameState,
  action: GameAction,
): { nextState: GameState; elapsedMs: number } {
  const start = performance.now();
  const nextState = gameReducer(state, action);
  return {
    nextState,
    elapsedMs: performance.now() - start,
  };
}

describe("Factory Island tick phase stress test", () => {
  jest.setTimeout(30_000);

  it("measures 100 large-state ticks and reports the slowest phase", () => {
    let state = createStressState();
    const totals: Record<PhaseName, number> = {
      Power: 0,
      Logistics: 0,
      Drones: 0,
      Crafting: 0,
    };

    expect(Object.keys(state.conveyors)).toHaveLength(CONVEYOR_COUNT);
    expect(Object.keys(state.drones)).toHaveLength(DRONE_COUNT);
    expect(
      Object.values(state.assets).filter(
        (asset) => asset.type === "auto_smelter" || asset.type === "workbench",
      ),
    ).toHaveLength(PRODUCTION_BUILDING_COUNT);

    for (let tick = 0; tick < SIMULATED_TICKS; tick++) {
      for (const phase of PHASES) {
        const measured = measurePhase(state, phase.action);
        state = measured.nextState;
        totals[phase.name] += measured.elapsedMs;
      }
    }

    const slowest = PHASES.map((phase) => ({
      name: phase.name,
      elapsedMs: totals[phase.name],
    })).sort((left, right) => right.elapsedMs - left.elapsedMs)[0];
    const summary = PHASES.map(
      (phase) => `${phase.name}=${totals[phase.name].toFixed(2)}ms`,
    ).join(", ");

    // eslint-disable-next-line no-console -- this stress test is intentionally diagnostic.
    console.info(
      `[stress] slowest tick phase over ${SIMULATED_TICKS} ticks: ${slowest.name} ` +
        `(${slowest.elapsedMs.toFixed(2)}ms total). ${summary}`,
    );

    expect(Number.isFinite(slowest.elapsedMs)).toBe(true);
    expect(slowest.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});
