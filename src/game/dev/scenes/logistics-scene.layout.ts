import type { SceneDefinition } from "../scene-types";
import {
  belt,
  generator,
  powerNode,
  resource,
  stoneFloorRect,
  warehouse,
} from "../scene-builder/helpers";

export const logisticsSceneLayout: SceneDefinition = {
  id: "logistics",
  label: "Logistics dev scene",
  mode: "debug",
  resetGlobalInventory: true,
  globalInventory: { coins: 99999 },
  purchasedBuildings: ["generator"],
  placedBuildings: ["generator"],
  resources: [
    resource("logistics-tree-1", "tree", 8, 8),
    resource("logistics-stone-1", "stone", 9, 8),
  ],
  assets: [
    warehouse("logistics-warehouse-in", 12, 12),
    belt("logistics-belt-a", 14, 12, "east"),
    belt("logistics-belt-b", 15, 12, "east"),
    warehouse("logistics-warehouse-out", 16, 12, { direction: "west" }),
    generator("logistics-generator", 12, 15, { fuel: 500, running: true }),
    powerNode("logistics-power-pole", 15, 15),
  ],
  floorTiles: [stoneFloorRect("logistics-generator-floor", 12, 15, 2, 2)],
};