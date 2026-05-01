import type { SceneDefinition, SceneResourceDefinition } from "../scene-types";
import { createInitialState } from "../../store/initial-state";
import type {
  AutoAssemblerEntry,
  AutoAssemblerRecipeId,
  AutoSmelterEntry,
  CollectableItemType,
  GameState,
} from "../../store/types";
import { placeSceneAsset, placeSceneResource } from "./place-asset";
import { registerSceneInventories } from "./register-inventories";
import { registerScenePower } from "./register-power";
import { validateScene } from "./validate-scene";

const CONVEYOR_TYPES = new Set([
  "conveyor",
  "conveyor_corner",
  "conveyor_merger",
  "conveyor_splitter",
  "conveyor_underground_in",
  "conveyor_underground_out",
]);

type DepositResource = Extract<CollectableItemType, "stone" | "iron" | "copper">;

const RESOURCE_BY_DEPOSIT_TYPE: Partial<Record<string, DepositResource>> = {
  stone_deposit: "stone",
  iron_deposit: "iron",
  copper_deposit: "copper",
};

export const buildSceneState = (
  scene: SceneDefinition,
  baseState: GameState = createInitialState(scene.mode),
): GameState => {
  validateScene(scene);

  let placement = {
    assets: { ...baseState.assets },
    cellMap: { ...baseState.cellMap },
  };

  for (const resourceDefinition of scene.resources ?? []) {
    placement = placeSceneResource(placement, resourceDefinition);
  }
  for (const assetDefinition of scene.assets) {
    placement = placeSceneAsset(placement, assetDefinition);
  }

  let state: GameState = {
    ...baseState,
    mode: scene.mode ?? baseState.mode,
    assets: placement.assets,
    cellMap: placement.cellMap,
    floorMap: applySceneFloorTiles(baseState.floorMap, scene),
    purchasedBuildings: scene.purchasedBuildings
      ? [...scene.purchasedBuildings]
      : baseState.purchasedBuildings,
    placedBuildings: scene.placedBuildings
      ? [...scene.placedBuildings]
      : baseState.placedBuildings,
  };

  state = registerSceneInventories(state, scene);
  state = registerSceneMachines(state, scene);
  state = registerScenePower(state, scene);
  state = registerStarterDrone(state, scene);

  return {
    ...state,
    warehousesPurchased: Object.values(state.assets).filter(
      (asset) => asset.type === "warehouse",
    ).length,
    warehousesPlaced: Object.values(state.assets).filter(
      (asset) => asset.type === "warehouse",
    ).length,
  };
};

const applySceneFloorTiles = (
  baseFloorMap: GameState["floorMap"],
  scene: SceneDefinition,
): GameState["floorMap"] => {
  const floorMap = { ...baseFloorMap };
  for (const tile of scene.floorTiles ?? []) {
    const width = tile.width ?? 1;
    const height = tile.height ?? 1;
    for (let dx = 0; dx < width; dx += 1) {
      for (let dy = 0; dy < height; dy += 1) {
        floorMap[`${tile.x + dx},${tile.y + dy}`] = tile.tileType;
      }
    }
  }
  return floorMap;
};

const registerSceneMachines = (
  state: GameState,
  scene: SceneDefinition,
): GameState => {
  const conveyors = { ...state.conveyors };
  const conveyorUndergroundPeers = { ...state.conveyorUndergroundPeers };
  const autoMiners = { ...state.autoMiners };
  const autoSmelters = { ...state.autoSmelters };
  const autoAssemblers = { ...state.autoAssemblers };
  const resourcesById = new Map(
    (scene.resources ?? []).map((resource) => [resource.id, resource]),
  );

  for (const definition of scene.assets) {
    if (CONVEYOR_TYPES.has(definition.type)) {
      conveyors[definition.id] = { queue: [] };
    }

    if (definition.peerId) {
      conveyorUndergroundPeers[definition.id] = definition.peerId;
    }

    if (definition.type === "auto_miner") {
      const resource = definition.resourceId
        ? resourcesById.get(definition.resourceId)
        : findDepositUnderMiner(scene.resources ?? [], definition.x, definition.y);
      if (!resource) {
        throw new Error(
          `Scene auto miner '${definition.id}' must reference a deposit resource.`,
        );
      }
      autoMiners[definition.id] = {
        depositId: resource.id,
        resource: getResourceForDeposit(resource),
        progress: 0,
      };
    }

    if (definition.type === "auto_smelter") {
      autoSmelters[definition.id] = createAutoSmelterEntry(definition.recipeId);
    }

    if (definition.type === "auto_assembler") {
      autoAssemblers[definition.id] = createAutoAssemblerEntry(definition.recipeId);
    }
  }

  return {
    ...state,
    conveyors,
    conveyorUndergroundPeers,
    autoMiners,
    autoSmelters,
    autoAssemblers,
  };
};

const registerStarterDrone = (
  state: GameState,
  scene: SceneDefinition,
): GameState => {
  if (!scene.starterDrone) return state;
  const hubAsset = state.assets[scene.starterDrone.hubId];
  if (!hubAsset) {
    throw new Error(
      `Scene starter drone references missing hub '${scene.starterDrone.hubId}'.`,
    );
  }

  const starterDrone = state.drones.starter;
  const nextStarterDrone = {
    ...starterDrone,
    hubId: scene.starterDrone.hubId,
    tileX: scene.starterDrone.tileX ?? hubAsset.x,
    tileY: scene.starterDrone.tileY ?? hubAsset.y,
    status: "idle" as const,
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
  };

  return {
    ...state,
    starterDrone: nextStarterDrone,
    drones: {
      ...state.drones,
      starter: nextStarterDrone,
    },
  };
};

const findDepositUnderMiner = (
  resources: readonly SceneResourceDefinition[],
  x: number,
  y: number,
): SceneResourceDefinition | undefined =>
  resources.find(
    (resource) =>
      resource.x === x &&
      resource.y === y &&
      resource.resourceType in RESOURCE_BY_DEPOSIT_TYPE,
  );

const getResourceForDeposit = (
  resource: SceneResourceDefinition,
): DepositResource => {
  const item = RESOURCE_BY_DEPOSIT_TYPE[resource.resourceType];
  if (!item) {
    throw new Error(
      `Scene resource '${resource.id}' is not a valid auto-miner deposit.`,
    );
  }
  return item;
};

const createAutoSmelterEntry = (recipeId?: string): AutoSmelterEntry => ({
  inputBuffer: [],
  processing: null,
  pendingOutput: [],
  status: "IDLE",
  lastRecipeInput: null,
  lastRecipeOutput: null,
  throughputEvents: [],
  selectedRecipe: recipeId === "copper" ? "copper" : "iron",
});

const createAutoAssemblerEntry = (recipeId?: string): AutoAssemblerEntry => ({
  ironIngotBuffer: 0,
  processing: null,
  pendingOutput: [],
  status: "IDLE",
  selectedRecipe: normalizeAssemblerRecipe(recipeId),
});

const normalizeAssemblerRecipe = (recipeId?: string): AutoAssemblerRecipeId => {
  if (recipeId === "gear") return "gear";
  return "metal_plate";
};