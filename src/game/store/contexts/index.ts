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

export { autoMinerContext } from "./auto-miner-context";
export { craftingContext } from "./crafting-context";
export { dronesContext } from "./drones-context";
export { inventoryContext } from "./inventory-context";

export {
  applyContextReducers,
  createGameReducer,
  type ContextGameReducer,
} from "./create-game-reducer";
