export type {
  BoundedContext,
  ContextRegistry,
  AutoMinerContextState,
  AutoSmelterContextState,
  AutoAssemblerContextState,
  ResearchLabContextState,
  CraftingContextState,
  DroneContextState,
  InventoryContextState,
  WarehouseContextState,
  PowerContextState,
  ConstructionContextState,
  ModuleLabContextState,
  ConveyorContextState,
  ZoneContextState,
  ShipContextState,
  UiContextState,
} from "./types";

export { autoAssemblerContext } from "./auto-assembler-context";
export { autoMinerContext } from "./auto-miner-context";
export { autoSmelterContext } from "./auto-smelter-context";
export { constructionContext } from "./construction-context";
export { conveyorContext } from "./conveyor-context";
export { craftingContext } from "./crafting-context";
export { dronesContext } from "./drones-context";
export { inventoryContext } from "./inventory-context";
export { moduleLabContext } from "./module-lab-context";
export { powerContext } from "./power-context";
export { researchLabContext } from "./research-lab-context";
export { shipContext } from "./ship-context";
export { uiContext } from "./ui-context";
export { warehouseContext } from "./warehouse-context";
export { zoneContext } from "./zone-context";

export {
  applyContextReducers,
  createGameReducer,
  type ContextGameReducer,
} from "./create-game-reducer";
