import type { GameAction } from "../../game-actions";
import { createEmptyInventory } from "../../inventory-ops";
import type { GeneratorState } from "../../types/power-state";
import type { PowerContextState } from "../types";
import { POWER_HANDLED_ACTION_TYPES, powerContext } from "../power-context";

function createPowerState(
  overrides: Partial<PowerContextState> = {},
): PowerContextState {
  return {
    battery: { stored: 0, capacity: 100 },
    generators: {},
    poweredMachineIds: [],
    machinePowerRatio: {},
    selectedGeneratorId: null,
    constructionSites: {},
    assets: {},
    notifications: [],
    inventory: createEmptyInventory(),
    warehouseInventories: {},
    buildingZoneIds: {},
    productionZones: {},
    buildingSourceWarehouseIds: {},
    mode: "release",
    ...overrides,
  } satisfies PowerContextState;
}

function makeGenerator(
  overrides: Partial<GeneratorState> = {},
): GeneratorState {
  return {
    fuel: 5,
    progress: 0,
    running: false,
    ...overrides,
  };
}

function expectHandled(result: PowerContextState | null): PowerContextState {
  expect(result).not.toBeNull();
  if (result === null) throw new Error("Expected power action handled");
  return result;
}

describe("powerContext", () => {
  describe("reduce", () => {
    it("returns null for unrelated actions", () => {
      const state = createPowerState();
      const action = { type: "DRONE_TICK" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBeNull();
    });

    it("GENERATOR_ADD_FUEL transfers wood from the global inventory", () => {
      const inventory = createEmptyInventory();
      inventory.wood = 20;
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 5 }) },
        inventory,
      });
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 4,
      } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]?.fuel).toBe(9);
      expect(next.inventory.wood).toBe(16);
    });

    it("GENERATOR_ADD_FUEL caps the transfer at the available wood", () => {
      const inventory = createEmptyInventory();
      inventory.wood = 2;
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 5 }) },
        inventory,
      });
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 10,
      } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]?.fuel).toBe(7);
      expect(next.inventory.wood).toBe(0);
    });

    it("GENERATOR_ADD_FUEL caps the transfer at the remaining fuel headroom", () => {
      const inventory = createEmptyInventory();
      inventory.wood = 100;
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 68 }) },
        inventory,
      });
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 50,
      } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      // GENERATOR_MAX_FUEL = 70 → headroom = 2.
      expect(next.generators["gen-1"]?.fuel).toBe(70);
      expect(next.inventory.wood).toBe(98);
    });

    it("GENERATOR_ADD_FUEL pulls wood from the configured warehouse source", () => {
      const inventory = createEmptyInventory();
      const warehouseInv = createEmptyInventory();
      warehouseInv.wood = 15;
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 0 }) },
        inventory,
        assets: {
          "wh-1": {
            id: "wh-1",
            type: "warehouse",
            x: 0,
            y: 0,
            size: 1,
          } as PowerContextState["assets"][string],
        },
        warehouseInventories: { "wh-1": warehouseInv },
        buildingSourceWarehouseIds: { "gen-1": "wh-1" },
      });
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 5,
      } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]?.fuel).toBe(5);
      expect(next.warehouseInventories["wh-1"]?.wood).toBe(10);
      expect(next.inventory.wood).toBe(0);
    });

    it("GENERATOR_ADD_FUEL is a no-op when no generator is selected", () => {
      const inventory = createEmptyInventory();
      inventory.wood = 20;
      const state = createPowerState({
        generators: { "gen-1": makeGenerator({ fuel: 5 }) },
        inventory,
      });
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 5,
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_ADD_FUEL is a no-op while the generator is still under construction", () => {
      const inventory = createEmptyInventory();
      inventory.wood = 20;
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 5 }) },
        inventory,
        constructionSites: {
          "gen-1": {
            buildingType: "generator",
            remaining: { wood: 1 },
          } as PowerContextState["constructionSites"][string],
        },
      });
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 5,
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_ADD_FUEL is a no-op when no wood is available", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 5 }) },
      });
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 5,
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_ADD_FUEL is a no-op when the fuel slot is full", () => {
      const inventory = createEmptyInventory();
      inventory.wood = 20;
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 70 }) },
        inventory,
      });
      const action = {
        type: "GENERATOR_ADD_FUEL",
        amount: 5,
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_REQUEST_REFILL increments requestedRefill up to headroom", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: {
          "gen-1": makeGenerator({ fuel: 10, requestedRefill: 5 }),
        },
      });
      const action = {
        type: "GENERATOR_REQUEST_REFILL",
        amount: 3,
      } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]?.requestedRefill).toBe(8);
    });

    it("GENERATOR_REQUEST_REFILL with 'max' fills to the cap", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: {
          "gen-1": makeGenerator({ fuel: 10, requestedRefill: 0 }),
        },
      });
      const action = {
        type: "GENERATOR_REQUEST_REFILL",
        amount: "max",
      } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      // GENERATOR_MAX_FUEL is 70 → headroom = 70 - 10 - 0 = 60.
      expect(next.generators["gen-1"]?.requestedRefill).toBe(60);
    });

    it("GENERATOR_REQUEST_REFILL emits an error notification when no headroom remains", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: {
          "gen-1": makeGenerator({ fuel: 70, requestedRefill: 0 }),
        },
      });
      const action = {
        type: "GENERATOR_REQUEST_REFILL",
        amount: "max",
      } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]?.requestedRefill).toBe(0);
      expect(next.notifications).toHaveLength(1);
      expect(next.notifications[0]).toMatchObject({
        kind: "error",
        displayName: "Generator gen-1: Speicher voll",
      });
    });

    it("GENERATOR_REQUEST_REFILL error notification reports already-requested amount", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: {
          "gen-1": makeGenerator({ fuel: 10, requestedRefill: 60 }),
        },
      });
      const action = {
        type: "GENERATOR_REQUEST_REFILL",
        amount: "max",
      } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.notifications[0]?.displayName).toBe(
        "Generator gen-1: bereits 60 Holz angefordert",
      );
    });

    it("GENERATOR_REQUEST_REFILL is a no-op when no generator is selected", () => {
      const state = createPowerState({
        generators: { "gen-1": makeGenerator({ fuel: 10 }) },
      });
      const action = {
        type: "GENERATOR_REQUEST_REFILL",
        amount: 5,
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_REQUEST_REFILL is a no-op while the generator is still under construction", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 10 }) },
        constructionSites: {
          "gen-1": {
            buildingType: "generator",
            remaining: { wood: 1 },
          } as PowerContextState["constructionSites"][string],
        },
      });
      const action = {
        type: "GENERATOR_REQUEST_REFILL",
        amount: 5,
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_START flips running to true when fuel is available", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 5, running: false }) },
      });
      const action = { type: "GENERATOR_START" } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]?.running).toBe(true);
    });

    it("GENERATOR_START is a no-op when no generator is selected", () => {
      const state = createPowerState({
        generators: { "gen-1": makeGenerator({ fuel: 5 }) },
      });
      const action = { type: "GENERATOR_START" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_START is a no-op when the selected generator has no fuel", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 0 }) },
      });
      const action = { type: "GENERATOR_START" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_START is a no-op when the generator is already running", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 5, running: true }) },
      });
      const action = { type: "GENERATOR_START" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_START is a no-op while the generator is still under construction", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: { "gen-1": makeGenerator({ fuel: 5 }) },
        constructionSites: {
          "gen-1": {
            buildingType: "generator",
            remaining: { wood: 1 },
          } as PowerContextState["constructionSites"][string],
        },
      });
      const action = { type: "GENERATOR_START" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_STOP flips running to false and zeroes progress", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: {
          "gen-1": makeGenerator({ fuel: 5, running: true, progress: 0.4 }),
        },
      });
      const action = { type: "GENERATOR_STOP" } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]).toMatchObject({
        running: false,
        progress: 0,
        fuel: 4,
      });
    });

    it("GENERATOR_STOP keeps fuel intact when progress is 0", () => {
      const state = createPowerState({
        selectedGeneratorId: "gen-1",
        generators: {
          "gen-1": makeGenerator({ fuel: 5, running: true, progress: 0 }),
        },
      });
      const action = { type: "GENERATOR_STOP" } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]?.fuel).toBe(5);
      expect(next.generators["gen-1"]?.running).toBe(false);
    });

    it("GENERATOR_STOP is a no-op when no generator is selected", () => {
      const state = createPowerState({
        generators: { "gen-1": makeGenerator({ running: true }) },
      });
      const action = { type: "GENERATOR_STOP" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_TICK advances progress for a running generator", () => {
      const state = createPowerState({
        generators: {
          "gen-1": makeGenerator({ fuel: 5, running: true, progress: 0 }),
        },
      });
      const action = { type: "GENERATOR_TICK" } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      const gen = next.generators["gen-1"];
      // GENERATOR_TICKS_PER_WOOD = 25 → 1 tick = 0.04 progress.
      expect(gen?.progress).toBeCloseTo(1 / 25, 6);
      expect(gen?.fuel).toBe(5);
      expect(gen?.running).toBe(true);
    });

    it("GENERATOR_TICK consumes one wood when progress rolls over", () => {
      const state = createPowerState({
        generators: {
          "gen-1": makeGenerator({
            fuel: 5,
            running: true,
            // One tick (1/25) over current progress crosses 1.
            progress: 24 / 25,
          }),
        },
      });
      const action = { type: "GENERATOR_TICK" } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]).toMatchObject({
        fuel: 4,
        progress: 0,
        running: true,
      });
    });

    it("GENERATOR_TICK stops the generator when the last wood is burned", () => {
      const state = createPowerState({
        generators: {
          "gen-1": makeGenerator({
            fuel: 1,
            running: true,
            progress: 24 / 25,
          }),
        },
      });
      const action = { type: "GENERATOR_TICK" } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]).toMatchObject({
        fuel: 0,
        progress: 0,
        running: false,
      });
    });

    it("GENERATOR_TICK flips running to false when a running generator has no fuel", () => {
      const state = createPowerState({
        generators: {
          "gen-1": makeGenerator({ fuel: 0, running: true, progress: 0 }),
        },
      });
      const action = { type: "GENERATOR_TICK" } satisfies GameAction;

      const next = expectHandled(powerContext.reduce(state, action));

      expect(next.generators["gen-1"]?.running).toBe(false);
    });

    it("GENERATOR_TICK is a no-op for a non-running generator", () => {
      const state = createPowerState({
        generators: {
          "gen-1": makeGenerator({ fuel: 5, running: false, progress: 0 }),
        },
      });
      const action = { type: "GENERATOR_TICK" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_TICK skips generators that are under construction", () => {
      const state = createPowerState({
        generators: {
          "gen-1": makeGenerator({ fuel: 5, running: true, progress: 0 }),
        },
        constructionSites: {
          "gen-1": {
            buildingType: "generator",
            remaining: { wood: 1 },
          } as PowerContextState["constructionSites"][string],
        },
      });
      const action = { type: "GENERATOR_TICK" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("GENERATOR_TICK skips generators currently being deconstructed", () => {
      const state = createPowerState({
        generators: {
          "gen-1": makeGenerator({ fuel: 5, running: true, progress: 0 }),
        },
        assets: {
          "gen-1": {
            id: "gen-1",
            type: "generator",
            x: 0,
            y: 0,
            size: 1,
            status: "deconstructing",
          } as PowerContextState["assets"][string],
        },
      });
      const action = { type: "GENERATOR_TICK" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("ENERGY_NET_TICK keeps the slice unchanged (cross-slice no-op)", () => {
      const state = createPowerState();
      const action = { type: "ENERGY_NET_TICK" } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    it("REMOVE_POWER_POLE is a no-op (matches legacy: pole removal runs via BUILD_REMOVE_ASSET)", () => {
      const state = createPowerState();
      const action = {
        type: "REMOVE_POWER_POLE",
        assetId: "pole-1",
      } satisfies GameAction;

      expect(powerContext.reduce(state, action)).toBe(state);
    });

    describe("SET_MACHINE_PRIORITY", () => {
      it("writes the clamped priority for an energy consumer", () => {
        const state = createPowerState({
          assets: {
            "miner-1": {
              id: "miner-1",
              type: "auto_miner",
              x: 0,
              y: 0,
              size: 1,
              priority: 3,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_PRIORITY",
          assetId: "miner-1",
          priority: 1,
        } satisfies GameAction;

        const next = expectHandled(powerContext.reduce(state, action));

        expect(next.assets["miner-1"]?.priority).toBe(1);
      });

      it("clamps a priority above the cap to 5", () => {
        const state = createPowerState({
          assets: {
            "miner-1": {
              id: "miner-1",
              type: "auto_miner",
              x: 0,
              y: 0,
              size: 1,
              priority: 3,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_PRIORITY",
          assetId: "miner-1",
          priority: 6 as PowerContextState["assets"][string]["priority"],
        } as unknown as GameAction;

        const next = expectHandled(powerContext.reduce(state, action));

        expect(next.assets["miner-1"]?.priority).toBe(5);
      });

      it("clamps a priority below the floor to 1", () => {
        const state = createPowerState({
          assets: {
            "miner-1": {
              id: "miner-1",
              type: "auto_miner",
              x: 0,
              y: 0,
              size: 1,
              priority: 3,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_PRIORITY",
          assetId: "miner-1",
          priority: 0 as PowerContextState["assets"][string]["priority"],
        } as unknown as GameAction;

        const next = expectHandled(powerContext.reduce(state, action));

        expect(next.assets["miner-1"]?.priority).toBe(1);
      });

      it("returns the same state reference when the priority is unchanged", () => {
        const state = createPowerState({
          assets: {
            "miner-1": {
              id: "miner-1",
              type: "auto_miner",
              x: 0,
              y: 0,
              size: 1,
              priority: 4,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_PRIORITY",
          assetId: "miner-1",
          priority: 4,
        } satisfies GameAction;

        expect(powerContext.reduce(state, action)).toBe(state);
      });

      it("is a no-op for non-energy-consumer asset types", () => {
        const state = createPowerState({
          assets: {
            "wh-1": {
              id: "wh-1",
              type: "warehouse",
              x: 0,
              y: 0,
              size: 1,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_PRIORITY",
          assetId: "wh-1",
          priority: 2,
        } satisfies GameAction;

        expect(powerContext.reduce(state, action)).toBe(state);
      });

      it("is a no-op when the asset does not exist", () => {
        const state = createPowerState();
        const action = {
          type: "SET_MACHINE_PRIORITY",
          assetId: "missing",
          priority: 2,
        } satisfies GameAction;

        expect(powerContext.reduce(state, action)).toBe(state);
      });
    });

    describe("SET_MACHINE_BOOST", () => {
      it("enables boost on an auto_miner", () => {
        const state = createPowerState({
          assets: {
            "miner-1": {
              id: "miner-1",
              type: "auto_miner",
              x: 0,
              y: 0,
              size: 1,
              boosted: false,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_BOOST",
          assetId: "miner-1",
          boosted: true,
        } satisfies GameAction;

        const next = expectHandled(powerContext.reduce(state, action));

        expect(next.assets["miner-1"]?.boosted).toBe(true);
      });

      it("disables boost on an auto_smelter", () => {
        const state = createPowerState({
          assets: {
            "smelter-1": {
              id: "smelter-1",
              type: "auto_smelter",
              x: 0,
              y: 0,
              size: 1,
              boosted: true,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_BOOST",
          assetId: "smelter-1",
          boosted: false,
        } satisfies GameAction;

        const next = expectHandled(powerContext.reduce(state, action));

        expect(next.assets["smelter-1"]?.boosted).toBe(false);
      });

      it("returns the same state reference when boost is unchanged", () => {
        const state = createPowerState({
          assets: {
            "miner-1": {
              id: "miner-1",
              type: "auto_miner",
              x: 0,
              y: 0,
              size: 1,
              boosted: true,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_BOOST",
          assetId: "miner-1",
          boosted: true,
        } satisfies GameAction;

        expect(powerContext.reduce(state, action)).toBe(state);
      });

      it("is a no-op for asset types that do not support boost", () => {
        const state = createPowerState({
          assets: {
            "asm-1": {
              id: "asm-1",
              type: "auto_assembler",
              x: 0,
              y: 0,
              size: 1,
            } as PowerContextState["assets"][string],
          },
        });
        const action = {
          type: "SET_MACHINE_BOOST",
          assetId: "asm-1",
          boosted: true,
        } satisfies GameAction;

        expect(powerContext.reduce(state, action)).toBe(state);
      });

      it("is a no-op when the asset does not exist", () => {
        const state = createPowerState();
        const action = {
          type: "SET_MACHINE_BOOST",
          assetId: "missing",
          boosted: true,
        } satisfies GameAction;

        expect(powerContext.reduce(state, action)).toBe(state);
      });
    });
  });

  describe("handledActionTypes", () => {
    it("contains no duplicates", () => {
      const uniqueTypes = new Set(powerContext.handledActionTypes);

      expect(uniqueTypes.size).toBe(powerContext.handledActionTypes.length);
    });

    it("all listed types are valid GameAction type strings", () => {
      const validTypes =
        POWER_HANDLED_ACTION_TYPES satisfies readonly GameAction["type"][];

      expect(powerContext.handledActionTypes).toEqual(validTypes);
    });
  });
});
