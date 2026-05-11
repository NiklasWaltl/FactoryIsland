import { createInitialState } from "../../store/initial-state";
import { gameReducer } from "../../store/reducer";
import {
  allocateEnergyByPriority,
  buildEnergyTickPhase1Snapshot,
} from "../../store/energy/energy-tick-phases";
import type {
  AssetType,
  GameState,
  MachinePriority,
  PlacedAsset,
} from "../../store/types";

type EnergyConsumerType = Extract<
  AssetType,
  | "smithy"
  | "auto_miner"
  | "conveyor"
  | "conveyor_corner"
  | "conveyor_merger"
  | "conveyor_splitter"
  | "conveyor_underground_in"
  | "conveyor_underground_out"
  | "auto_smelter"
  | "auto_assembler"
>;

interface BuildEnergyStateOptions {
  generators?: Array<{
    id?: string;
    running?: boolean;
    status?: PlacedAsset["status"];
  }>;
  consumers?: Array<{
    id: string;
    type: EnergyConsumerType;
    priority?: MachinePriority;
    status?: PlacedAsset["status"];
    processing?: boolean;
  }>;
  battery?: {
    id?: string;
    stored?: number;
    capacity?: number;
    status?: PlacedAsset["status"];
    underConstruction?: boolean;
  };
}

function buildEnergyState({
  generators = [],
  consumers = [],
  battery,
}: BuildEnergyStateOptions = {}): GameState {
  const state = createInitialState("release");
  const assets: Record<string, PlacedAsset> = {};
  const connectedAssetIds: string[] = [];
  let nextX = 1;

  const addAsset = (asset: PlacedAsset): void => {
    assets[asset.id] = asset;
    connectedAssetIds.push(asset.id);
    nextX += asset.width ?? asset.size;
  };

  if (generators.length > 0) {
    addAsset({
      id: "power-pole",
      type: "power_pole",
      x: nextX,
      y: 1,
      size: 1,
    });
  }

  generators.forEach((generator, index) => {
    const id = generator.id ?? `generator-${index + 1}`;
    addAsset({
      id,
      type: "generator",
      x: nextX,
      y: 1,
      size: 2,
      status: generator.status,
    });
    state.generators[id] = {
      fuel: 0,
      progress: 0,
      running: generator.running ?? true,
    };
  });

  if (battery) {
    const id = battery.id ?? "battery";
    addAsset({
      id,
      type: "battery",
      x: nextX,
      y: 1,
      size: 2,
      status: battery.status,
    });
    state.battery = {
      stored: battery.stored ?? 0,
      capacity: battery.capacity ?? 100,
    };
    if (battery.underConstruction) {
      state.constructionSites[id] = {
        buildingType: "battery",
        remaining: { wood: 1 },
      };
    }
  }

  consumers.forEach((consumer) => {
    addAsset({
      id: consumer.id,
      type: consumer.type,
      x: nextX,
      y: 1,
      size:
        consumer.type === "auto_smelter" || consumer.type === "auto_assembler"
          ? 2
          : 1,
      width:
        consumer.type === "auto_smelter" || consumer.type === "auto_assembler"
          ? 2
          : undefined,
      height: 1,
      priority: consumer.priority,
      status: consumer.status,
    });

    if (consumer.type === "auto_smelter") {
      state.autoSmelters[consumer.id] = {
        inputBuffer: [],
        processing: consumer.processing
          ? {
              inputItem: "iron",
              outputItem: "ironIngot",
              progressMs: 0,
              durationMs: 1000,
            }
          : null,
        pendingOutput: [],
        status: consumer.processing ? "PROCESSING" : "IDLE",
        lastRecipeInput: null,
        lastRecipeOutput: null,
        throughputEvents: [],
        selectedRecipe: "iron",
      };
    }

    if (consumer.type === "auto_assembler") {
      state.autoAssemblers[consumer.id] = {
        ironIngotBuffer: 0,
        processing: consumer.processing
          ? {
              outputItem: "metalPlate",
              progressMs: 0,
              durationMs: 1000,
            }
          : null,
        pendingOutput: [],
        status: consumer.processing ? "PROCESSING" : "IDLE",
        selectedRecipe: "metal_plate",
      };
    }

    if (consumer.type.startsWith("conveyor")) {
      state.conveyors[consumer.id] = { queue: [] };
    }
  });

  return {
    ...state,
    assets,
    cellMap: {},
    connectedAssetIds,
    poweredMachineIds: [],
    machinePowerRatio: {},
  };
}

describe("energy tick phases", () => {
  it("sortiert Verbraucher nach Prioritaet, allocation-rank und Einfuegereihenfolge und versorgt nur voll abgedeckte Verbraucher", () => {
    const state = buildEnergyState({
      consumers: [
        { id: "miner", type: "auto_miner", priority: 3 },
        { id: "conveyor-a", type: "conveyor", priority: 3 },
        { id: "assembler", type: "auto_assembler", priority: 1 },
        { id: "conveyor-b", type: "conveyor", priority: 3 },
      ],
    });

    const snapshot = buildEnergyTickPhase1Snapshot(state);

    expect(
      snapshot.prioritizedConsumers.map((entry) => entry.asset.id),
    ).toEqual(["assembler", "conveyor-a", "conveyor-b", "miner"]);

    const availableEnergy =
      snapshot.prioritizedConsumers[0].drain +
      snapshot.prioritizedConsumers[1].drain;
    const allocation = allocateEnergyByPriority(
      availableEnergy,
      snapshot.prioritizedConsumers,
    );

    expect(allocation.poweredMachineIds).toEqual(["assembler", "conveyor-a"]);
    expect(allocation.poweredMachineIds).not.toContain("conveyor-b");
    expect(allocation.poweredMachineIds).not.toContain("miner");
  });
});

describe("energy net tick battery behavior", () => {
  it("laedt die Batterie nur bei Ueberschuss und wenn das Asset nicht im Bau ist", () => {
    const chargingState = buildEnergyState({
      generators: [{}],
      consumers: [{ id: "conveyor", type: "conveyor" }],
      battery: { stored: 2, capacity: 100 },
    });

    const charged = gameReducer(chargingState, { type: "ENERGY_NET_TICK" });

    expect(charged.battery.stored).toBeGreaterThan(
      chargingState.battery.stored,
    );

    const underConstructionState = buildEnergyState({
      generators: [{}],
      consumers: [{ id: "conveyor", type: "conveyor" }],
      battery: { stored: 2, capacity: 100, underConstruction: true },
    });

    const unchanged = gameReducer(underConstructionState, {
      type: "ENERGY_NET_TICK",
    });

    expect(unchanged.battery.stored).toBe(
      underConstructionState.battery.stored,
    );
  });

  it("entlaedt die Batterie nur bei Produktion unter Bedarf und wenn das Asset nicht im Bau ist", () => {
    const dischargingState = buildEnergyState({
      consumers: [{ id: "miner", type: "auto_miner" }],
      battery: { stored: 4, capacity: 100 },
    });

    const discharged = gameReducer(dischargingState, {
      type: "ENERGY_NET_TICK",
    });

    expect(discharged.battery.stored).toBeLessThan(
      dischargingState.battery.stored,
    );

    const underConstructionState = buildEnergyState({
      consumers: [{ id: "miner", type: "auto_miner" }],
      battery: { stored: 4, capacity: 100, underConstruction: true },
    });

    const unchanged = gameReducer(underConstructionState, {
      type: "ENERGY_NET_TICK",
    });

    expect(unchanged.battery.stored).toBe(
      underConstructionState.battery.stored,
    );
  });

  it("laesst die Batterie unveraendert wenn das Batterie-Asset deconstructing ist", () => {
    const state = buildEnergyState({
      generators: [{}],
      consumers: [{ id: "conveyor", type: "conveyor" }],
      battery: { stored: 7, capacity: 100, status: "deconstructing" },
    });

    const next = gameReducer(state, { type: "ENERGY_NET_TICK" });

    expect(next.battery.stored).toBe(state.battery.stored);
  });
});

describe("energy net tick machine power ratio", () => {
  it("setzt powerRatio auf 1.0 bei Vollversorgung", () => {
    const state = buildEnergyState({
      generators: [{}],
      consumers: [{ id: "miner", type: "auto_miner" }],
    });

    const next = gameReducer(state, { type: "ENERGY_NET_TICK" });

    expect(next.poweredMachineIds).toContain("miner");
    expect(next.machinePowerRatio["miner"]).toBe(1);
  });

  it("setzt powerRatio bei Teilversorgung exakt auf allocation geteilt durch demand", () => {
    const state = buildEnergyState({
      consumers: [{ id: "miner", type: "auto_miner" }],
      battery: { stored: 2, capacity: 100 },
    });
    const snapshot = buildEnergyTickPhase1Snapshot(state);
    const demand = snapshot.prioritizedConsumers[0].drain;

    const next = gameReducer(state, { type: "ENERGY_NET_TICK" });

    expect(next.poweredMachineIds).not.toContain("miner");
    expect(next.machinePowerRatio["miner"]).toBeLessThan(1);
    expect(next.machinePowerRatio["miner"]).toBeCloseTo(2 / demand);
  });
});
