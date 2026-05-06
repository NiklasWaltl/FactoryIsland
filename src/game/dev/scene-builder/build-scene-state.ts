import type { SceneDefinition } from "../scene-types";
import { createInitialState } from "../../store/initial-state";
import type {
  AutoAssemblerEntry,
  AutoAssemblerRecipeId,
  AutoSmelterEntry,
  GameState,
} from "../../store/types";
import {
  DEPOSIT_RESOURCE,
  isFixedResourceAssetType,
  type FixedResourceOutput,
} from "../../world/fixed-resource-layout";
import { placeSceneAsset, placeSceneResource } from "./place-asset";
import { registerSceneInventories } from "./register-inventories";
import { registerScenePower } from "./register-power";
import {
  createBaseStartLayout,
  hasRequiredBaseStartLayout,
} from "../../world/base-start-layout";
import { validateScene } from "./validate-scene";
import {
  requireStarterDrone,
  STARTER_DRONE_ID,
} from "../../store/selectors/drone-selectors";

const CONVEYOR_TYPES = new Set([
  "conveyor",
  "conveyor_corner",
  "conveyor_merger",
  "conveyor_splitter",
  "conveyor_underground_in",
  "conveyor_underground_out",
]);

interface DepositResourceReference {
  readonly id: string;
  readonly resourceType: string;
  readonly x: number;
  readonly y: number;
}

export const buildSceneState = (
  scene: SceneDefinition,
  baseState: GameState = createInitialState(scene.mode),
): GameState => {
  const resolvedScene = resolveSceneDefinition(scene, baseState);
  validateScene(resolvedScene);

  let placement: Pick<GameState, "assets" | "cellMap"> =
    resolvedScene.clearBaseWorld
      ? { assets: {}, cellMap: {} }
      : {
          assets: { ...baseState.assets },
          cellMap: { ...baseState.cellMap },
        };

  for (const resourceDefinition of resolvedScene.resources ?? []) {
    placement = placeSceneResource(placement, resourceDefinition);
  }
  for (const assetDefinition of resolvedScene.assets) {
    placement = placeSceneAsset(placement, assetDefinition);
  }

  let state: GameState = {
    ...baseState,
    mode: resolvedScene.mode ?? baseState.mode,
    assets: placement.assets,
    cellMap: placement.cellMap,
    floorMap: applySceneFloorTiles(
      resolvedScene.clearBaseWorld ? {} : baseState.floorMap,
      resolvedScene,
    ),
    purchasedBuildings: resolvedScene.purchasedBuildings
      ? [...resolvedScene.purchasedBuildings]
      : baseState.purchasedBuildings,
    placedBuildings: resolvedScene.placedBuildings
      ? [...resolvedScene.placedBuildings]
      : baseState.placedBuildings,
    ...getClearBaseWorldState(resolvedScene, baseState),
  };

  state = registerSceneInventories(state, resolvedScene);
  state = registerSceneMachines(state, resolvedScene);
  state = registerScenePower(state, resolvedScene);
  state = registerStarterDrone(state, resolvedScene);

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

const getClearBaseWorldState = (
  scene: SceneDefinition,
  baseState: GameState,
): Partial<GameState> => {
  if (!scene.clearBaseWorld) return {};

  const baseStarterDrone = requireStarterDrone(baseState);
  const starter = {
    ...baseStarterDrone,
    status: "idle" as const,
    tileX: 0,
    tileY: 0,
    targetNodeId: null,
    cargo: null,
    ticksRemaining: 0,
    hubId: null,
    currentTaskType: null,
    deliveryTargetId: null,
    craftingJobId: null,
  };

  return {
    warehouseInventories: {},
    serviceHubs: {},
    drones: { [STARTER_DRONE_ID]: starter },
    generators: {},
    connectedAssetIds: [],
    poweredMachineIds: [],
    machinePowerRatio: {},
    autoMiners: {},
    conveyors: {},
    conveyorUndergroundPeers: {},
    autoSmelters: {},
    autoAssemblers: {},
    constructionSites: {},
    buildingSourceWarehouseIds: {},
    buildingZoneIds: {},
    collectionNodes: {},
  };
};

const resolveSceneDefinition = (
  scene: SceneDefinition,
  baseState: GameState,
): SceneDefinition => {
  if (scene.baseStartLayout !== "include") return scene;
  if (!scene.clearBaseWorld && hasRequiredBaseStartLayout(baseState))
    return scene;

  const baseStart = createBaseStartLayout(baseState.tileMap);
  return {
    ...scene,
    starter: scene.starter ?? { hubId: baseStart.starterHubId },
    assets: [...baseStart.assets, ...scene.assets],
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
  const resourcesById = getDepositResourceReferences(state, scene);

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
        : findDepositUnderMiner(
            resourcesById.values(),
            definition.x,
            definition.y,
          );
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
      autoAssemblers[definition.id] = createAutoAssemblerEntry(
        definition.recipeId,
      );
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
  if (!scene.starter) return state;
  const hubAsset = state.assets[scene.starter.hubId];
  if (!hubAsset) {
    throw new Error(
      `Scene starter drone references missing hub '${scene.starter.hubId}'.`,
    );
  }

  const starter = requireStarterDrone(state);
  const nextStarterDrone = {
    ...starter,
    hubId: scene.starter.hubId,
    tileX: scene.starter.tileX ?? hubAsset.x,
    tileY: scene.starter.tileY ?? hubAsset.y,
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
    drones: {
      ...state.drones,
      [STARTER_DRONE_ID]: nextStarterDrone,
    },
  };
};

const findDepositUnderMiner = (
  resources: Iterable<DepositResourceReference>,
  x: number,
  y: number,
): DepositResourceReference | undefined => {
  for (const resource of resources) {
    if (
      resource.x === x &&
      resource.y === y &&
      isFixedResourceAssetType(resource.resourceType)
    ) {
      return resource;
    }
  }
  return undefined;
};

const getResourceForDeposit = (
  resource: DepositResourceReference,
): FixedResourceOutput => {
  const item = DEPOSIT_RESOURCE[resource.resourceType];
  if (!item) {
    throw new Error(
      `Scene resource '${resource.id}' is not a valid auto-miner deposit.`,
    );
  }
  return item;
};

const getDepositResourceReferences = (
  state: GameState,
  scene: SceneDefinition,
): Map<string, DepositResourceReference> => {
  const resourcesById = new Map<string, DepositResourceReference>();

  for (const resource of scene.resources ?? []) {
    if (!isFixedResourceAssetType(resource.resourceType)) continue;
    resourcesById.set(resource.id, resource);
  }

  for (const asset of Object.values(state.assets)) {
    if (!isFixedResourceAssetType(asset.type)) continue;
    resourcesById.set(asset.id, {
      id: asset.id,
      resourceType: asset.type,
      x: asset.x,
      y: asset.y,
    });
  }

  return resourcesById;
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
