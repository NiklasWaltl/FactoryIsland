import type { SceneDefinition } from "../scene-types";
import { getFixedResourceOriginByType } from "../../world/fixed-resource-layout";
import {
  autoAssembler,
  autoMiner,
  autoSmelter,
  belt,
  conveyorCorner,
  conveyorSplitter,
  generator,
  powerNode,
  resource,
  stoneFloorRect,
  undergroundIn,
  undergroundOut,
  warehouse,
} from "../scene-builder/helpers";

const ironDepositOrigin = getFixedResourceOriginByType("iron_deposit");
const ironX = ironDepositOrigin.col;
const ironY = ironDepositOrigin.row;
const ironOffsetX = (offset: number): number => ironX + offset;
const ironOffsetY = (offset: number): number => ironY + offset;

export const debugSceneLayout: SceneDefinition = {
  id: "debug",
  label: "Extended debug scene",
  mode: "debug",
  resetGlobalInventory: true,
  globalInventory: { coins: 99999 },
  purchasedBuildings: ["generator"],
  placedBuildings: ["generator"],
  baseStartLayout: "include",
  resources: [
    resource("tree-debug-a", "tree", 10, 10),
    resource("tree-debug-b", "tree", 12, 14),
    resource("tree-debug-c", "tree", 21, 32),
    resource("stone-debug-a", "stone", 16, 10),
    resource("stone-debug-b", "stone", 24, 17),
    resource("iron-debug-a", "iron", 31, 9),
    resource("copper-debug-a", "copper", 10, 37),
  ],
  assets: [
    warehouse("warehouse-smelter-output", ironOffsetX(-8), ironOffsetY(-2)),
    generator("generator-debug-a", ironOffsetX(-7), ironOffsetY(3), {
      fuel: 500,
      running: true,
    }),
    generator("generator-debug-b", ironOffsetX(-4), ironOffsetY(3), {
      fuel: 500,
      running: true,
    }),
    powerNode("power-pole-generator", ironOffsetX(-4), ironOffsetY(2)),
    powerNode("power-pole-splitter", ironOffsetX(-6), ironOffsetY(2)),
    powerNode("power-pole-smelter-output", ironOffsetX(-7), ironOffsetY(0)),
    powerNode("power-pole-smelter-input", ironOffsetX(-3), ironOffsetY(1)),
    powerNode("power-pole-assembler", ironOffsetX(-9), ironOffsetY(4)),
    autoMiner("auto-miner-iron", ironX, ironY, "west", ironDepositOrigin.id),
    belt("belt-miner-output-a", ironOffsetX(-1), ironY, "west"),
    belt("belt-miner-output-b", ironOffsetX(-2), ironY, "west"),
    belt("belt-smelter-input", ironOffsetX(-3), ironY, "west"),
    autoSmelter("auto-smelter-iron", ironOffsetX(-5), ironY, "west", "iron"),
    conveyorCorner("corner-smelter-down", ironOffsetX(-6), ironY, "south"),
    conveyorCorner(
      "corner-route-west",
      ironOffsetX(-6),
      ironOffsetY(1),
      "west",
    ),
    belt("belt-splitter-input", ironOffsetX(-7), ironOffsetY(1), "west"),
    conveyorSplitter("splitter-debug", ironOffsetX(-8), ironOffsetY(1), "west"),
    belt("belt-warehouse-return", ironOffsetX(-8), ironY, "north"),
    undergroundIn(
      "underground-in-debug",
      ironOffsetX(-8),
      ironOffsetY(2),
      "south",
      "underground-out-debug",
    ),
    undergroundOut(
      "underground-out-debug",
      ironOffsetX(-8),
      ironOffsetY(5),
      "south",
      "underground-in-debug",
    ),
    autoAssembler(
      "auto-assembler-debug",
      ironOffsetX(-10),
      ironOffsetY(5),
      "west",
      "metal_plate",
    ),
    belt("belt-assembler-output", ironOffsetX(-11), ironOffsetY(5), "west"),
    warehouse("warehouse-assembler-output", ironOffsetX(-13), ironOffsetY(5), {
      direction: "east",
    }),
  ],
  floorTiles: [
    stoneFloorRect(
      "floor-generator-debug-a",
      ironOffsetX(-7),
      ironOffsetY(3),
      2,
      2,
    ),
    stoneFloorRect(
      "floor-generator-debug-b",
      ironOffsetX(-4),
      ironOffsetY(3),
      2,
      2,
    ),
  ],
};
