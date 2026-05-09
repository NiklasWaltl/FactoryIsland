import {
  cellKey,
  createInitialState,
  gameReducer,
  type GameState,
  type Inventory,
  type PlacedAsset,
} from "../../../store/reducer";
import type { CraftingJob } from "../../../crafting/types";
import { AUTO_MINER_PRODUCE_TICKS } from "../../../store/constants/drone/drone-config";
import { buildProductionTransparency } from "../productionTransparency";

const WB = "wb-ui";
const WH = "wh-ui";

function buildJob(overrides: Partial<CraftingJob> = {}): CraftingJob {
  const id = overrides.id ?? "job-ui";
  return {
    id,
    recipeId: "wood_pickaxe",
    workbenchId: WB,
    inventorySource: { kind: "global" },
    inputBuffer: [],
    status: "queued",
    priority: "normal",
    source: "player",
    enqueuedAt: 1,
    startedAt: null,
    finishesAt: null,
    progress: 0,
    ingredients: [{ itemId: "wood", count: 1 }],
    output: { itemId: "wood_pickaxe", count: 1 },
    processingTime: 1,
    reservationOwnerId: id,
    ...overrides,
  };
}

function withJobs(state: GameState, jobs: readonly CraftingJob[]): GameState {
  return {
    ...state,
    crafting: {
      ...state.crafting,
      jobs,
    },
  };
}

function getReason(state: GameState, jobId: string): string | undefined {
  return buildProductionTransparency(state).jobs.find(
    (entry) => entry.id === `craft:${jobId}`,
  )?.reason;
}

function getMachineReason(state: GameState, rowId: string): string | undefined {
  return buildProductionTransparency(state).jobs.find(
    (entry) => entry.id === rowId,
  )?.reason;
}

function buildState(overrides?: Partial<Inventory>): GameState {
  const base = createInitialState("release");
  const workbench: PlacedAsset = {
    id: WB,
    type: "workbench",
    x: 4,
    y: 4,
    size: 1,
  };
  const warehouse: PlacedAsset = {
    id: WH,
    type: "warehouse",
    x: 8,
    y: 8,
    size: 2,
  };

  return {
    ...base,
    assets: {
      ...base.assets,
      [WB]: workbench,
      [WH]: warehouse,
    },
    cellMap: {
      ...base.cellMap,
      [cellKey(4, 4)]: WB,
      [cellKey(8, 8)]: WH,
      [cellKey(9, 8)]: WH,
      [cellKey(8, 9)]: WH,
      [cellKey(9, 9)]: WH,
    },
    warehouseInventories: {
      [WH]: {
        ...base.inventory,
        ...(overrides ?? {}),
      },
    },
    buildingSourceWarehouseIds: {
      [WB]: WH,
    },
  };
}

describe("productionTransparency", () => {
  it("reuses the snapshot when unrelated state slices change", () => {
    const state = buildState({ wood: 20, wood_pickaxe: 0 });

    const first = buildProductionTransparency(state);
    const second = buildProductionTransparency({
      ...state,
      openPanel: "warehouse",
    });

    expect(second).toBe(first);
  });

  it("rebuilds the snapshot when relevant slices change", () => {
    const state = buildState({ wood: 20, wood_pickaxe: 0 });

    const first = buildProductionTransparency(state);
    const next = gameReducer(state, {
      type: "JOB_ENQUEUE",
      recipeId: "wood_pickaxe",
      workbenchId: WB,
      source: "player",
      priority: "high",
    });
    const second = buildProductionTransparency(next);

    expect(second).not.toBe(first);
  });

  it("rebuilds the snapshot when auto assembler slice changes", () => {
    const state = buildState({ ironIngot: 5 });

    const first = buildProductionTransparency(state);
    const second = buildProductionTransparency({
      ...state,
      autoAssemblers: {
        ...state.autoAssemblers,
      },
    });

    expect(second).not.toBe(first);
  });

  it("shows construction entries", () => {
    let state = buildState({ wood: 0 });
    state = {
      ...state,
      assets: {
        ...state.assets,
        "build-1": { id: "build-1", type: "warehouse", x: 12, y: 12, size: 2 },
      },
      constructionSites: {
        ...state.constructionSites,
        "build-1": {
          buildingType: "warehouse",
          remaining: { wood: 4 },
        },
      },
    };

    const snapshot = buildProductionTransparency(state);
    const row = snapshot.jobs.find((entry) => entry.type === "construction");

    expect(row).toBeDefined();
    expect(row?.targetLabel).toContain("build-1");
  });

  it("shows upgrade entries", () => {
    let state = buildState({ wood: 0 });
    state = {
      ...state,
      assets: {
        ...state.assets,
        "hub-up": { id: "hub-up", type: "service_hub", x: 14, y: 14, size: 2 },
      },
      serviceHubs: {
        ...state.serviceHubs,
        "hub-up": {
          inventory: { wood: 0, stone: 0, iron: 0, copper: 0 },
          targetStock: { wood: 0, stone: 0, iron: 0, copper: 0 },
          tier: 1,
          droneIds: [],
          pendingUpgrade: { wood: 20 },
        },
      },
      constructionSites: {
        ...state.constructionSites,
        "hub-up": {
          buildingType: "service_hub",
          remaining: { wood: 4 },
        },
      },
    };

    const snapshot = buildProductionTransparency(state);
    const row = snapshot.jobs.find((entry) => entry.type === "upgrade");

    expect(row).toBeDefined();
    expect(row?.targetLabel).toContain("hub-up");
  });

  it("shows deconstruct requests with waiting/active status in request sequence order", () => {
    let state = buildState({ wood: 0 });

    const starterReserved = {
      ...state.drones.starter,
      status: "moving_to_collect" as const,
      currentTaskType: "deconstruct" as const,
      targetNodeId: "dec-reserved",
      deliveryTargetId: "dec-reserved",
      ticksRemaining: 3,
      cargo: null,
      deconstructRefund: null,
    };
    const droneActive = {
      ...state.drones.starter,
      droneId: "drone-2",
      status: "collecting" as const,
      currentTaskType: "deconstruct" as const,
      targetNodeId: "dec-active",
      deliveryTargetId: "dec-active",
      ticksRemaining: 2,
      cargo: null,
      deconstructRefund: null,
    };

    state = {
      ...state,
      assets: {
        ...state.assets,
        "dec-open": {
          id: "dec-open",
          type: "workbench",
          x: 18,
          y: 8,
          size: 1,
          status: "deconstructing",
          deconstructRequestSeq: 3,
        },
        "dec-reserved": {
          id: "dec-reserved",
          type: "warehouse",
          x: 20,
          y: 8,
          size: 2,
          status: "deconstructing",
          deconstructRequestSeq: 1,
        },
        "dec-active": {
          id: "dec-active",
          type: "smithy",
          x: 22,
          y: 8,
          size: 1,
          status: "deconstructing",
          deconstructRequestSeq: 2,
        },
      },
      drones: {
        ...state.drones,
        starter: starterReserved,
        "drone-2": droneActive,
      },
    };

    const snapshot = buildProductionTransparency(state);
    const open = snapshot.deconstructRequests.find(
      (entry) => entry.assetId === "dec-open",
    );
    const reserved = snapshot.deconstructRequests.find(
      (entry) => entry.assetId === "dec-reserved",
    );
    const active = snapshot.deconstructRequests.find(
      (entry) => entry.assetId === "dec-active",
    );

    expect(snapshot.deconstructRequests.map((entry) => entry.assetId)).toEqual([
      "dec-reserved",
      "dec-active",
      "dec-open",
    ]);

    expect(open).toBeDefined();
    expect(open?.deconstructRequestSeq).toBe(3);
    expect(open?.queueStatus).toBe("waiting");
    expect(open?.assignedDroneId).toBeUndefined();
    expect(open?.tickOrderIndex).toBeUndefined();

    expect(reserved).toBeDefined();
    expect(reserved?.deconstructRequestSeq).toBe(1);
    expect(reserved?.queueStatus).toBe("active");
    expect(reserved?.assignedDroneId).toBe("starter");
    expect(reserved?.tickOrderIndex).toBe(1);

    expect(active).toBeDefined();
    expect(active?.deconstructRequestSeq).toBe(2);
    expect(active?.queueStatus).toBe("active");
    expect(active?.assignedDroneId).toBe("drone-2");
    expect(active?.tickOrderIndex).toBe(2);
  });

  it("shows keep-in-stock target rows", () => {
    let state = buildState({ wood: 20, wood_pickaxe: 0 });
    state = gameReducer(state, {
      type: "SET_KEEP_STOCK_TARGET",
      workbenchId: WB,
      recipeId: "wood_pickaxe",
      amount: 2,
      enabled: true,
    });

    const snapshot = buildProductionTransparency(state);
    const row = snapshot.keepStock.find(
      (entry) => entry.recipeId === "wood_pickaxe",
    );

    expect(row).toBeDefined();
    expect(row?.targetAmount).toBe(2);
  });

  it("shows a waiting reason for queued jobs", () => {
    let state = buildState({ wood: 0 });
    state = gameReducer(state, {
      type: "JOB_ENQUEUE",
      recipeId: "wood_pickaxe",
      workbenchId: WB,
      source: "player",
      priority: "high",
    });

    const snapshot = buildProductionTransparency(state);
    const row = snapshot.jobs.find(
      (entry) => entry.type === "player-craft" && entry.status === "queued",
    );

    expect(row).toBeDefined();
    expect(row?.reason).toContain("wartet");
  });

  it("shows no-power blocker for unpowered energy consumers", () => {
    const machineId = "smithy-no-power";
    let state = buildState({ wood: 5 });
    state = withJobs(
      {
        ...state,
        assets: {
          ...state.assets,
          [machineId]: {
            id: machineId,
            type: "smithy",
            x: 12,
            y: 4,
            size: 1,
          },
        },
        poweredMachineIds: [],
      },
      [
        buildJob({
          id: "job-no-power",
          workbenchId: machineId,
          status: "crafting",
        }),
      ],
    );

    expect(getReason(state, "job-no-power")).toBe("⚡ Kein Strom");
  });

  it("shows output-full blocker for delivering jobs", () => {
    const state = withJobs(buildState({ wood: 5 }), [
      buildJob({ id: "job-output-full", status: "delivering" }),
    ]);

    expect(getReason(state, "job-output-full")).toBe("📦 Output voll");
  });

  it("shows the first missing input item for reserved jobs", () => {
    const state = withJobs(buildState({ wood: 0 }), [
      buildJob({
        id: "job-missing-input",
        status: "reserved",
        ingredients: [{ itemId: "wood", count: 2 }],
        inputBuffer: [],
      }),
    ]);

    expect(getReason(state, "job-missing-input")).toBe(
      "⏳ Wartet auf Input: Wood",
    );
  });

  it("shows reserved-resource blocker for queued jobs", () => {
    let state = buildState({ wood: 5 });
    state = withJobs(
      {
        ...state,
        network: {
          ...state.network,
          reservations: [
            {
              id: "res-blocking-wood",
              itemId: "wood",
              amount: 5,
              ownerKind: "system_request",
              ownerId: "other-system",
              scopeKey: `crafting:warehouse:${WH}`,
              createdAt: 1,
            },
          ],
        },
      },
      [
        buildJob({
          id: "job-reserved-resource",
          status: "queued",
          inventorySource: { kind: "warehouse", warehouseId: WH },
          ingredients: [{ itemId: "wood", count: 5 }],
        }),
      ],
    );

    expect(getReason(state, "job-reserved-resource")).toBe(
      "🔒 Ressource reserviert",
    );
  });

  it("shows no-drone blocker when no free role-compatible drone can deliver input", () => {
    let state = buildState({ wood: 1 });
    state = withJobs(
      {
        ...state,
        drones: {
          ...state.drones,
          starter: {
            ...state.drones.starter,
            status: "moving_to_collect",
            currentTaskType: "hub_restock",
          },
        },
        network: {
          ...state.network,
          reservations: [
            {
              id: "res-input-wood",
              itemId: "wood",
              amount: 1,
              ownerKind: "crafting_job",
              ownerId: "job-no-drone",
              scopeKey: `crafting:warehouse:${WH}`,
              createdAt: 1,
            },
          ],
        },
      },
      [
        buildJob({
          id: "job-no-drone",
          status: "reserved",
          inventorySource: { kind: "warehouse", warehouseId: WH },
          ingredients: [{ itemId: "wood", count: 1 }],
          inputBuffer: [],
        }),
      ],
    );

    expect(getReason(state, "job-no-drone")).toBe("🚁 Keine Drohne verfügbar");
  });

  it("shows wrong-zone blocker when global stock can satisfy a zone miss", () => {
    const zoneId = "zone-wrong";
    let state = buildState({ wood: 0 });
    state = withJobs(
      {
        ...state,
        inventory: {
          ...state.inventory,
          wood: 5,
        },
        productionZones: {
          ...state.productionZones,
          [zoneId]: { id: zoneId, name: "Wrong Zone" },
        },
        buildingZoneIds: {
          ...state.buildingZoneIds,
          [WB]: zoneId,
          [WH]: zoneId,
        },
      },
      [
        buildJob({
          id: "job-wrong-zone",
          status: "queued",
          inventorySource: {
            kind: "zone",
            zoneId,
            warehouseIds: [WH],
          },
          ingredients: [{ itemId: "wood", count: 5 }],
        }),
      ],
    );

    expect(getReason(state, "job-wrong-zone")).toBe("❌ Falsche Zone");
  });

  it("shows keep-in-stock skip reason when higher-priority jobs are open", () => {
    let state = buildState({ wood: 20, wood_pickaxe: 0 });
    state = gameReducer(state, {
      type: "JOB_ENQUEUE",
      recipeId: "wood_pickaxe",
      workbenchId: WB,
      source: "player",
      priority: "high",
    });
    state = gameReducer(state, {
      type: "SET_KEEP_STOCK_TARGET",
      workbenchId: WB,
      recipeId: "wood_pickaxe",
      amount: 2,
      enabled: true,
    });

    const snapshot = buildProductionTransparency(state);
    const row = snapshot.keepStock.find(
      (entry) => entry.recipeId === "wood_pickaxe",
    );

    expect(row).toBeDefined();
    expect(row?.decision).toBe("skip");
    expect(row?.decisionReason).toContain("hoeher priorisierte Jobs offen");
  });

  it("shows keep-in-stock policy skip reason", () => {
    let state = buildState({ wood: 20, wood_pickaxe: 0 });
    state = gameReducer(state, {
      type: "SET_KEEP_STOCK_TARGET",
      workbenchId: WB,
      recipeId: "wood_pickaxe",
      amount: 2,
      enabled: true,
    });
    state = gameReducer(state, {
      type: "SET_RECIPE_AUTOMATION_POLICY",
      recipeId: "wood_pickaxe",
      patch: { keepInStockAllowed: false },
    });

    const snapshot = buildProductionTransparency(state);
    const row = snapshot.keepStock.find(
      (entry) => entry.recipeId === "wood_pickaxe",
    );

    expect(row).toBeDefined();
    expect(row?.decision).toBe("skip");
    expect(row?.decisionReason).toContain("keep-in-stock disabled");
  });

  it("shows no-power blocker for unpowered auto smelters", () => {
    const smelterId = "smelter-no-power";
    let state = buildState({ iron: 50 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [smelterId]: {
          id: smelterId,
          type: "auto_smelter",
          x: 16,
          y: 6,
          size: 2,
        },
      },
      autoSmelters: {
        ...state.autoSmelters,
        [smelterId]: {
          inputBuffer: [],
          processing: null,
          pendingOutput: [],
          status: "IDLE",
          lastRecipeInput: null,
          lastRecipeOutput: null,
          throughputEvents: [],
          selectedRecipe: "iron",
        },
      },
      poweredMachineIds: [],
    };

    expect(getMachineReason(state, `auto_smelter:${smelterId}`)).toBe(
      "⚡ Kein Strom",
    );
  });

  it("shows output-full blocker for auto smelter rows", () => {
    const smelterId = "smelter-output-blocked";
    let state = buildState({ iron: 50 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [smelterId]: {
          id: smelterId,
          type: "auto_smelter",
          x: 17,
          y: 6,
          size: 2,
        },
      },
      autoSmelters: {
        ...state.autoSmelters,
        [smelterId]: {
          inputBuffer: ["iron"],
          processing: null,
          pendingOutput: ["iron"],
          status: "OUTPUT_BLOCKED",
          lastRecipeInput: "iron",
          lastRecipeOutput: "ironIngot",
          throughputEvents: [],
          selectedRecipe: "iron",
        },
      },
      poweredMachineIds: [smelterId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [smelterId]: 1,
      },
    };

    expect(getMachineReason(state, `auto_smelter:${smelterId}`)).toBe(
      "📦 Output voll",
    );
  });

  it("shows missing-input blocker for auto smelter rows", () => {
    const smelterId = "smelter-missing-input";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [smelterId]: {
          id: smelterId,
          type: "auto_smelter",
          x: 18,
          y: 6,
          size: 2,
        },
      },
      autoSmelters: {
        ...state.autoSmelters,
        [smelterId]: {
          inputBuffer: [],
          processing: null,
          pendingOutput: [],
          status: "IDLE",
          lastRecipeInput: null,
          lastRecipeOutput: null,
          throughputEvents: [],
          selectedRecipe: "iron",
        },
      },
      poweredMachineIds: [smelterId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [smelterId]: 1,
      },
    };

    expect(getMachineReason(state, `auto_smelter:${smelterId}`)).toBe(
      "⏳ Wartet auf Input: Iron Ore",
    );
  });

  it("shows no-power blocker for unpowered auto assemblers", () => {
    const assemblerId = "auto-assembler-no-power";
    let state = buildState({ ironIngot: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [assemblerId]: {
          id: assemblerId,
          type: "auto_assembler",
          x: 19,
          y: 6,
          size: 2,
        },
      },
      autoAssemblers: {
        ...state.autoAssemblers,
        [assemblerId]: {
          ironIngotBuffer: 0,
          processing: null,
          pendingOutput: [],
          status: "IDLE",
          selectedRecipe: "metal_plate",
        },
      },
      poweredMachineIds: [],
    };

    expect(getMachineReason(state, `auto_assembler:${assemblerId}`)).toBe(
      "⚡ Kein Strom",
    );
  });

  it("shows output-full blocker for auto assembler rows", () => {
    const assemblerId = "auto-assembler-output-blocked";
    let state = buildState({ ironIngot: 5 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [assemblerId]: {
          id: assemblerId,
          type: "auto_assembler",
          x: 20,
          y: 6,
          size: 2,
        },
      },
      autoAssemblers: {
        ...state.autoAssemblers,
        [assemblerId]: {
          ironIngotBuffer: 3,
          processing: null,
          pendingOutput: ["gear"],
          status: "OUTPUT_BLOCKED",
          selectedRecipe: "gear",
        },
      },
      poweredMachineIds: [assemblerId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [assemblerId]: 1,
      },
    };

    expect(getMachineReason(state, `auto_assembler:${assemblerId}`)).toBe(
      "📦 Output voll",
    );
  });

  it("shows missing-input blocker for auto assembler rows", () => {
    const assemblerId = "auto-assembler-waiting-input";
    let state = buildState({ ironIngot: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [assemblerId]: {
          id: assemblerId,
          type: "auto_assembler",
          x: 21,
          y: 6,
          size: 2,
        },
      },
      autoAssemblers: {
        ...state.autoAssemblers,
        [assemblerId]: {
          ironIngotBuffer: 0,
          processing: null,
          pendingOutput: [],
          status: "IDLE",
          selectedRecipe: "gear",
        },
      },
      poweredMachineIds: [assemblerId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [assemblerId]: 1,
      },
      buildingSourceWarehouseIds: {
        ...state.buildingSourceWarehouseIds,
        [assemblerId]: WH,
      },
    };

    expect(getMachineReason(state, `auto_assembler:${assemblerId}`)).toBe(
      "⏳ Wartet auf Input: Iron Ingot",
    );
  });

  it("shows output-full blocker for module lab rows", () => {
    const moduleLabId = "module-lab-output-full";
    let state = buildState({ gear: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [moduleLabId]: {
          id: moduleLabId,
          type: "module_lab",
          x: 21,
          y: 10,
          size: 2,
        },
      },
      moduleLabJob: {
        recipeId: "module_tier1",
        moduleType: "miner-boost",
        tier: 1,
        fragmentsRequired: 3,
        startedAt: 1,
        durationMs: 10000,
        status: "done",
      },
    };

    expect(getMachineReason(state, `module_lab:${moduleLabId}`)).toBe(
      "📦 Output voll",
    );
  });

  it("shows missing-input blocker for module lab rows with item label", () => {
    const moduleLabId = "module-lab-missing-fragment";
    let state = buildState({ gear: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [moduleLabId]: {
          id: moduleLabId,
          type: "module_lab",
          x: 22,
          y: 10,
          size: 2,
        },
      },
      moduleLabJob: null,
      moduleFragments: 0,
    };

    expect(getMachineReason(state, `module_lab:${moduleLabId}`)).toBe(
      "⏳ Wartet auf Input: Modul-Fragment",
    );
  });

  it("shows output-full blocker for research lab rows", () => {
    const researchLabId = "research-lab-output-full";
    let state = buildState({ gear: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [researchLabId]: {
          id: researchLabId,
          type: "research_lab",
          x: 23,
          y: 10,
          size: 2,
        },
      },
      notifications: [
        ...state.notifications,
        {
          id: "n-research-ready",
          resource: "research_unlock",
          displayName: "smithy freigeschaltet",
          amount: 1,
          expiresAt: Date.now() + 1000,
          kind: "success",
        },
      ],
    };

    expect(getMachineReason(state, `research_lab:${researchLabId}`)).toBe(
      "📦 Output voll",
    );
  });

  it("shows output-full blocker for conveyor rows when output is blocked", () => {
    const conveyorId = "conveyor-output-blocked";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [conveyorId]: {
          id: conveyorId,
          type: "conveyor",
          x: 0,
          y: 0,
          size: 1,
          direction: "west",
        },
      },
      conveyors: {
        ...state.conveyors,
        [conveyorId]: {
          queue: ["iron"],
        },
      },
      connectedAssetIds: [...state.connectedAssetIds, conveyorId],
      poweredMachineIds: [...state.poweredMachineIds, conveyorId],
    };

    expect(getMachineReason(state, `conveyor:${conveyorId}`)).toBe(
      "📦 Output voll",
    );
  });

  it("shows idle conveyor rows without reason", () => {
    const conveyorId = "conveyor-idle";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [conveyorId]: {
          id: conveyorId,
          type: "conveyor_splitter",
          x: 10,
          y: 10,
          size: 1,
          direction: "east",
        },
      },
      conveyors: {
        ...state.conveyors,
        [conveyorId]: {
          queue: [],
        },
      },
    };

    const row = buildProductionTransparency(state).jobs.find(
      (entry) => entry.id === `conveyor:${conveyorId}`,
    );

    expect(row).toBeDefined();
    expect(row?.status).toBe("waiting");
    expect(row?.reason).toBeUndefined();
  });

  it("shows output-full blocker for generator rows", () => {
    const generatorId = "generator-output-full";
    const batteryId = "battery-output-full";
    let state = buildState({ wood: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [generatorId]: {
          id: generatorId,
          type: "generator",
          x: 20,
          y: 6,
          size: 2,
        },
        [batteryId]: {
          id: batteryId,
          type: "battery",
          x: 20,
          y: 9,
          size: 2,
        },
      },
      generators: {
        ...state.generators,
        [generatorId]: {
          fuel: 5,
          progress: 0.25,
          running: true,
          requestedRefill: 0,
        },
      },
      connectedAssetIds: [generatorId, batteryId],
      battery: {
        ...state.battery,
        stored: state.battery.capacity,
      },
      poweredMachineIds: [],
      machinePowerRatio: {},
    };

    expect(getMachineReason(state, `generator:${generatorId}`)).toBe(
      "📦 Output voll",
    );
  });

  it("shows missing-input blocker for generator rows without fuel", () => {
    const generatorId = "generator-no-fuel";
    let state = buildState({ wood: 5 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [generatorId]: {
          id: generatorId,
          type: "generator",
          x: 21,
          y: 6,
          size: 2,
        },
      },
      generators: {
        ...state.generators,
        [generatorId]: {
          fuel: 0,
          progress: 0,
          running: false,
          requestedRefill: 0,
        },
      },
    };

    expect(getMachineReason(state, `generator:${generatorId}`)).toBe(
      "⏳ Wartet auf Input: Wood",
    );
  });

  it("shows initializing reason for generator rows with fuel but not running", () => {
    const generatorId = "generator-initializing";
    let state = buildState({ wood: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [generatorId]: {
          id: generatorId,
          type: "generator",
          x: 22,
          y: 6,
          size: 2,
        },
      },
      generators: {
        ...state.generators,
        [generatorId]: {
          fuel: 3,
          progress: 0,
          running: false,
          requestedRefill: 0,
        },
      },
    };

    expect(getMachineReason(state, `generator:${generatorId}`)).toBe(
      "⚙️ Initialisiert",
    );
  });

  it("shows output-full blocker for manual assembler rows", () => {
    const manualAssemblerId = "manual-assembler-output-full";
    let state = buildState({ metalPlate: 1, gear: 999 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [manualAssemblerId]: {
          id: manualAssemblerId,
          type: "manual_assembler",
          x: 22,
          y: 10,
          size: 2,
        },
      },
      manualAssembler: {
        ...state.manualAssembler,
        processing: false,
        recipe: "gear",
        progress: 0,
        buildingId: manualAssemblerId,
      },
      buildingSourceWarehouseIds: {
        ...state.buildingSourceWarehouseIds,
        [manualAssemblerId]: WH,
      },
    };

    expect(
      getMachineReason(state, `manual_assembler:${manualAssemblerId}`),
    ).toBe("📦 Output voll");
  });

  it("shows missing-input blocker for manual assembler rows with item label", () => {
    const manualAssemblerId = "manual-assembler-waiting-input";
    let state = buildState({ metalPlate: 0, gear: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [manualAssemblerId]: {
          id: manualAssemblerId,
          type: "manual_assembler",
          x: 24,
          y: 10,
          size: 2,
        },
      },
      manualAssembler: {
        ...state.manualAssembler,
        processing: false,
        recipe: "gear",
        progress: 0,
        buildingId: manualAssemblerId,
      },
      buildingSourceWarehouseIds: {
        ...state.buildingSourceWarehouseIds,
        [manualAssemblerId]: WH,
      },
    };

    expect(
      getMachineReason(state, `manual_assembler:${manualAssemblerId}`),
    ).toBe("⏳ Wartet auf Input: Metal Plate");
  });

  it("shows no-recipe reason for manual assembler rows", () => {
    const manualAssemblerId = "manual-assembler-no-recipe";
    let state = buildState({ metalPlate: 0, gear: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [manualAssemblerId]: {
          id: manualAssemblerId,
          type: "manual_assembler",
          x: 25,
          y: 10,
          size: 2,
        },
      },
      manualAssembler: {
        ...state.manualAssembler,
        processing: false,
        recipe: null,
        progress: 0,
        buildingId: manualAssemblerId,
      },
      buildingSourceWarehouseIds: {
        ...state.buildingSourceWarehouseIds,
        [manualAssemblerId]: WH,
      },
    };

    expect(
      getMachineReason(state, `manual_assembler:${manualAssemblerId}`),
    ).toBe("🔧 Kein Rezept gewählt");
  });

  it("shows no-power blocker for unpowered smithy rows", () => {
    const smithyId = "smithy-no-power";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [smithyId]: {
          id: smithyId,
          type: "smithy",
          x: 22,
          y: 6,
          size: 2,
        },
      },
      smithy: {
        ...state.smithy,
        selectedRecipe: "iron",
        fuel: 1,
        iron: 5,
        processing: false,
        progress: 0,
        outputIngots: 0,
        outputCopperIngots: 0,
        buildingId: smithyId,
      },
      poweredMachineIds: [],
    };

    expect(getMachineReason(state, `smithy:${smithyId}`)).toBe("⚡ Kein Strom");
  });

  it("shows output-full blocker for smithy rows", () => {
    const smithyId = "smithy-output-full";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [smithyId]: {
          id: smithyId,
          type: "smithy",
          x: 23,
          y: 6,
          size: 2,
        },
      },
      smithy: {
        ...state.smithy,
        selectedRecipe: "iron",
        fuel: 0,
        iron: 0,
        processing: false,
        progress: 0,
        outputIngots: 2,
        outputCopperIngots: 0,
        buildingId: smithyId,
      },
      poweredMachineIds: [smithyId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [smithyId]: 1,
      },
    };

    expect(getMachineReason(state, `smithy:${smithyId}`)).toBe(
      "📦 Output voll",
    );
  });

  it("shows missing-input blocker for smithy rows with item label", () => {
    const smithyId = "smithy-waiting-input";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [smithyId]: {
          id: smithyId,
          type: "smithy",
          x: 24,
          y: 6,
          size: 2,
        },
      },
      smithy: {
        ...state.smithy,
        selectedRecipe: "iron",
        fuel: 3,
        iron: 0,
        processing: false,
        progress: 0,
        outputIngots: 0,
        outputCopperIngots: 0,
        buildingId: smithyId,
      },
      poweredMachineIds: [smithyId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [smithyId]: 1,
      },
    };

    expect(getMachineReason(state, `smithy:${smithyId}`)).toBe(
      "⏳ Wartet auf Input: Iron Ore",
    );
  });

  it("shows no-power blocker for unpowered auto miners", () => {
    const minerId = "miner-no-power";
    const depositId = "deposit-no-power";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [minerId]: {
          id: minerId,
          type: "auto_miner",
          x: 26,
          y: 6,
          size: 1,
          direction: "east",
        },
        [depositId]: {
          id: depositId,
          type: "iron_deposit",
          x: 26,
          y: 6,
          size: 2,
        },
      },
      autoMiners: {
        ...state.autoMiners,
        [minerId]: {
          depositId,
          resource: "iron",
          progress: 0,
        },
      },
      poweredMachineIds: [],
    };

    expect(getMachineReason(state, `auto_miner:${minerId}`)).toBe(
      "⚡ Kein Strom",
    );
  });

  it("shows output-full blocker for auto miner rows", () => {
    const minerId = "miner-output-blocked";
    const depositId = "deposit-output-blocked";
    let state = buildState({ iron: 20 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [minerId]: {
          id: minerId,
          type: "auto_miner",
          x: 28,
          y: 6,
          size: 1,
          direction: "east",
        },
        [depositId]: {
          id: depositId,
          type: "iron_deposit",
          x: 28,
          y: 6,
          size: 2,
        },
      },
      autoMiners: {
        ...state.autoMiners,
        [minerId]: {
          depositId,
          resource: "iron",
          progress: AUTO_MINER_PRODUCE_TICKS,
        },
      },
      poweredMachineIds: [minerId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [minerId]: 1,
      },
      buildingSourceWarehouseIds: {
        ...state.buildingSourceWarehouseIds,
        [minerId]: WH,
      },
      warehouseInventories: {
        ...state.warehouseInventories,
        [WH]: {
          ...state.warehouseInventories[WH],
          iron: 20,
        },
      },
    };

    expect(getMachineReason(state, `auto_miner:${minerId}`)).toBe(
      "📦 Output voll",
    );
  });

  it("shows no-cell blocker for auto miner rows", () => {
    const minerId = "miner-no-cell";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [minerId]: {
          id: minerId,
          type: "auto_miner",
          x: 30,
          y: 6,
          size: 1,
          direction: "east",
        },
      },
      autoMiners: {
        ...state.autoMiners,
        [minerId]: {
          depositId: "missing-assigned-cell",
          resource: "iron",
          progress: 0,
        },
      },
      poweredMachineIds: [minerId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [minerId]: 1,
      },
    };

    expect(getMachineReason(state, `auto_miner:${minerId}`)).toBe(
      "⛏️ Keine Zelle",
    );
  });

  it("shows startup reason for auto miner rows at zero progress", () => {
    const minerId = "miner-starting";
    const depositId = "deposit-starting";
    let state = buildState({ iron: 0 });

    state = {
      ...state,
      assets: {
        ...state.assets,
        [minerId]: {
          id: minerId,
          type: "auto_miner",
          x: 31,
          y: 6,
          size: 1,
          direction: "east",
        },
        [depositId]: {
          id: depositId,
          type: "iron_deposit",
          x: 31,
          y: 6,
          size: 2,
        },
      },
      autoMiners: {
        ...state.autoMiners,
        [minerId]: {
          depositId,
          resource: "iron",
          progress: 0,
        },
      },
      poweredMachineIds: [minerId],
      machinePowerRatio: {
        ...state.machinePowerRatio,
        [minerId]: 1,
      },
    };

    expect(getMachineReason(state, `auto_miner:${minerId}`)).toBe(
      "⏳ Startet...",
    );
  });
});
