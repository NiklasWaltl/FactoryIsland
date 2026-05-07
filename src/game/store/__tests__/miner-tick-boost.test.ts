import type { Module } from "../../modules/module.types";
import {
  AUTO_MINER_BASE_OUTPUT,
  getMinerYieldMultiplier,
} from "../../simulation/mining-utils";
import {
  createInitialState,
  gameReducer,
  type AutoMinerEntry,
  type GameAction,
  type GameState,
  type PlacedAsset,
} from "../reducer";
import { AUTO_MINER_PRODUCE_TICKS } from "../constants/drone/drone-config";

type MinerResource = AutoMinerEntry["resource"];

function makeMinerAsset(
  id: string,
  x: number,
  y: number,
  moduleSlot: string | null = null,
): PlacedAsset {
  return {
    id,
    type: "auto_miner",
    x,
    y,
    size: 1,
    direction: "east",
    moduleSlot,
  };
}

function makeMinerEntry(resource: MinerResource): AutoMinerEntry {
  return {
    depositId: `${resource}-deposit`,
    resource,
    progress: AUTO_MINER_PRODUCE_TICKS,
  };
}

function makeModule(module: Partial<Module> & Pick<Module, "id">): Module {
  return {
    type: "miner-boost",
    tier: 1,
    equippedTo: null,
    ...module,
  };
}

function buildState(input: {
  miners: Array<{
    id: string;
    resource: MinerResource;
    x: number;
    y: number;
    moduleSlot?: string | null;
  }>;
  modules?: Module[];
}): GameState {
  const base = createInitialState("release");
  const minerAssets = Object.fromEntries(
    input.miners.map((miner) => [
      miner.id,
      makeMinerAsset(miner.id, miner.x, miner.y, miner.moduleSlot ?? null),
    ]),
  );
  const minerEntries = Object.fromEntries(
    input.miners.map((miner) => [miner.id, makeMinerEntry(miner.resource)]),
  );
  const minerCells = Object.fromEntries(
    input.miners.map((miner) => [`${miner.x},${miner.y}`, miner.id]),
  );
  const minerIds = input.miners.map((miner) => miner.id);

  return {
    ...base,
    assets: { ...base.assets, ...minerAssets },
    cellMap: { ...base.cellMap, ...minerCells },
    autoMiners: { ...base.autoMiners, ...minerEntries },
    connectedAssetIds: [...base.connectedAssetIds, ...minerIds],
    machinePowerRatio: {
      ...base.machinePowerRatio,
      ...Object.fromEntries(minerIds.map((id) => [id, 1])),
    },
    moduleInventory: input.modules ?? [],
  };
}

function runLogisticsTick(state: GameState): GameState {
  return gameReducer(state, { type: "LOGISTICS_TICK" } as GameAction);
}

function expectedOutput(module: Module | null): number {
  return Math.floor(AUTO_MINER_BASE_OUTPUT * getMinerYieldMultiplier(module));
}

describe("Auto-Miner miner-boost output", () => {
  it("produces base output without a module", () => {
    const state = buildState({
      miners: [{ id: "miner-1", resource: "iron", x: 5, y: 5 }],
    });

    const after = runLogisticsTick(state);

    expect(after.inventory.iron).toBe(expectedOutput(null));
    // Base: floor(10 * 1.0) = 10
    expect(after.inventory.iron).toBe(10);
  });

  it("produces floored Tier 1 miner-boost output", () => {
    const module = makeModule({
      id: "module-1",
      tier: 1,
      equippedTo: "miner-1",
    });
    const state = buildState({
      miners: [
        { id: "miner-1", resource: "iron", x: 5, y: 5, moduleSlot: module.id },
      ],
      modules: [module],
    });

    const after = runLogisticsTick(state);

    expect(after.inventory.iron).toBe(expectedOutput(module));
    // Tier 1 (+10%): floor(10 * 1.1) = 11
    expect(after.inventory.iron).toBe(11);
  });

  it("produces floored Tier 2 miner-boost output", () => {
    const module = makeModule({
      id: "module-1",
      tier: 2,
      equippedTo: "miner-1",
    });
    const state = buildState({
      miners: [
        { id: "miner-1", resource: "iron", x: 5, y: 5, moduleSlot: module.id },
      ],
      modules: [module],
    });

    const after = runLogisticsTick(state);

    expect(after.inventory.iron).toBe(expectedOutput(module));
    // Tier 2 (+25%): floor(10 * 1.25) = 12
    expect(after.inventory.iron).toBe(12);
  });

  it("produces floored Tier 3 miner-boost output", () => {
    const module = makeModule({
      id: "module-1",
      tier: 3,
      equippedTo: "miner-1",
    });
    const state = buildState({
      miners: [
        { id: "miner-1", resource: "iron", x: 5, y: 5, moduleSlot: module.id },
      ],
      modules: [module],
    });

    const after = runLogisticsTick(state);

    expect(after.inventory.iron).toBe(expectedOutput(module));
    // Tier 3 (+50%): floor(10 * 1.5) = 15
    expect(after.inventory.iron).toBe(15);
  });

  it("falls back to base output after the module is removed", () => {
    const module = makeModule({
      id: "module-1",
      tier: 1,
      equippedTo: "miner-1",
    });
    const state = buildState({
      miners: [
        { id: "miner-1", resource: "iron", x: 5, y: 5, moduleSlot: module.id },
      ],
      modules: [module],
    });
    const withoutModule = gameReducer(state, {
      type: "REMOVE_MODULE",
      moduleId: module.id,
    });

    const after = runLogisticsTick(withoutModule);

    expect(after.assets["miner-1"].moduleSlot).toBeNull();
    expect(after.inventory.iron).toBe(expectedOutput(null));
  });

  it("keeps adjacent miners independent when only one has a module", () => {
    const module = makeModule({
      id: "module-1",
      tier: 1,
      equippedTo: "miner-1",
    });
    const state = buildState({
      miners: [
        { id: "miner-1", resource: "iron", x: 5, y: 5, moduleSlot: module.id },
        { id: "miner-2", resource: "copper", x: 6, y: 5 },
      ],
      modules: [module],
    });

    const after = runLogisticsTick(state);

    expect(after.inventory.iron).toBe(expectedOutput(module));
    expect(after.inventory.copper).toBe(expectedOutput(null));
  });
});
