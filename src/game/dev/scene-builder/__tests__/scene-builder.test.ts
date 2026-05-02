import { createInitialState } from "../../../store/initial-state";
import type { SceneDefinition } from "../../scene-types";
import {
  autoAssembler,
  autoMiner,
  autoSmelter,
  belt,
  generator,
  powerNode,
  resource,
  serviceHub,
  stoneFloorRect,
  warehouse,
} from "../helpers";
import { buildSceneState } from "../build-scene-state";

const scene: SceneDefinition = {
  id: "debug",
  label: "Builder smoke scene",
  mode: "debug",
  clearBaseWorld: true,
  resetGlobalInventory: true,
  globalInventory: { coins: 1234 },
  starterDrone: { hubId: "hub" },
  resources: [resource("iron-deposit", "iron_deposit", 20, 5)],
  assets: [
    serviceHub("hub", 4, 4, { droneIds: ["starter"] }),
    warehouse("warehouse", 8, 4, {
      inventory: [
        { itemId: "wood", count: 3 },
        { itemId: "stone", count: 2 },
      ],
    }),
    generator("generator", 11, 4, { fuel: 500, running: true }),
    powerNode("pole", 13, 4),
    autoMiner("miner", 20, 5, "west", "iron-deposit"),
    belt("belt", 19, 5, "west"),
    autoSmelter("smelter", 16, 5, "west", "iron"),
    autoAssembler("assembler", 13, 7, "west", "gear"),
  ],
  floorTiles: [stoneFloorRect("generator-floor", 11, 4, 2, 2)],
};

describe("buildSceneState", () => {
  const state = buildSceneState(scene, createInitialState("debug"));

  it("places resources and assets with stable layout IDs", () => {
    expect(state.assets["iron-deposit"]?.type).toBe("iron_deposit");
    expect(state.assets["miner"]?.type).toBe("auto_miner");
    expect(state.cellMap["20,5"]).toBe("miner");
  });

  it("registers warehouse and service hub inventories", () => {
    expect(state.inventory.coins).toBe(1234);
    expect(state.warehouseInventories.warehouse.wood).toBe(3);
    expect(state.warehouseInventories.warehouse.stone).toBe(2);
    expect(state.serviceHubs.hub.droneIds).toEqual(["starter"]);
    expect(state.drones.starter.hubId).toBe("hub");
  });

  it("registers conveyor and machine slices", () => {
    expect(state.conveyors.belt.queue).toEqual([]);
    expect(state.autoMiners.miner.depositId).toBe("iron-deposit");
    expect(state.autoMiners.miner.resource).toBe("iron");
    expect(state.autoSmelters.smelter.selectedRecipe).toBe("iron");
    expect(state.autoAssemblers.assembler.selectedRecipe).toBe("gear");
  });

  it("registers generator state, floor tiles, and power connectivity", () => {
    expect(state.generators.generator).toMatchObject({
      fuel: 500,
      progress: 0,
      running: true,
      requestedRefill: 0,
    });
    expect(state.floorMap["11,4"]).toBe("stone_floor");
    expect(state.connectedAssetIds).toContain("pole");
    expect(state.poweredMachineIds).toContain("smelter");
  });

  it("rejects duplicate layout IDs", () => {
    expect(() =>
      buildSceneState(
        {
          id: "empty",
          label: "Invalid scene",
          resources: [resource("duplicate", "tree", 1, 1)],
          assets: [warehouse("duplicate", 4, 4)],
        },
        createInitialState("debug"),
      ),
    ).toThrow(/duplicate object id/);
  });
});
