import type {
  ResourceType,
  SceneAssetDefinition,
  SceneFloorTileDefinition,
  SceneResourceDefinition,
} from "../scene-types";
import type {
  AssetType,
  Direction,
  FloorTileType,
} from "../../store/types";

type SceneAssetOptions = Omit<
  SceneAssetDefinition,
  "id" | "type" | "x" | "y"
>;

export const asset = (
  id: string,
  type: AssetType,
  x: number,
  y: number,
  options: SceneAssetOptions = {},
): SceneAssetDefinition => ({ id, type, x, y, ...options });

export const warehouse = (
  id: string,
  x: number,
  y: number,
  options: SceneAssetOptions = {},
): SceneAssetDefinition => asset(id, "warehouse", x, y, options);

export const serviceHub = (
  id: string,
  x: number,
  y: number,
  options: SceneAssetOptions = {},
): SceneAssetDefinition => asset(id, "service_hub", x, y, options);

export const belt = (
  id: string,
  x: number,
  y: number,
  direction: Direction,
  options: SceneAssetOptions = {},
): SceneAssetDefinition =>
  asset(id, "conveyor", x, y, { direction, ...options });

export const conveyorCorner = (
  id: string,
  x: number,
  y: number,
  direction: Direction,
  options: SceneAssetOptions = {},
): SceneAssetDefinition =>
  asset(id, "conveyor_corner", x, y, { direction, ...options });

export const conveyorSplitter = (
  id: string,
  x: number,
  y: number,
  direction: Direction,
  options: SceneAssetOptions = {},
): SceneAssetDefinition =>
  asset(id, "conveyor_splitter", x, y, { direction, ...options });

export const undergroundIn = (
  id: string,
  x: number,
  y: number,
  direction: Direction,
  peerId: string,
  options: SceneAssetOptions = {},
): SceneAssetDefinition =>
  asset(id, "conveyor_underground_in", x, y, {
    direction,
    peerId,
    ...options,
  });

export const undergroundOut = (
  id: string,
  x: number,
  y: number,
  direction: Direction,
  peerId: string,
  options: SceneAssetOptions = {},
): SceneAssetDefinition =>
  asset(id, "conveyor_underground_out", x, y, {
    direction,
    peerId,
    ...options,
  });

export const autoMiner = (
  id: string,
  x: number,
  y: number,
  direction: Direction,
  resourceId: string,
  options: SceneAssetOptions = {},
): SceneAssetDefinition =>
  asset(id, "auto_miner", x, y, { direction, resourceId, ...options });

export const autoSmelter = (
  id: string,
  x: number,
  y: number,
  direction: Direction,
  recipeId: "iron" | "copper" = "iron",
  options: SceneAssetOptions = {},
): SceneAssetDefinition =>
  asset(id, "auto_smelter", x, y, {
    direction,
    recipeId,
    size: 2,
    width: 2,
    height: 1,
    ...options,
  });

export const autoAssembler = (
  id: string,
  x: number,
  y: number,
  direction: Direction,
  recipeId: "metal_plate" | "gear" = "metal_plate",
  options: SceneAssetOptions = {},
): SceneAssetDefinition =>
  asset(id, "auto_assembler", x, y, {
    direction,
    recipeId,
    size: 2,
    width: 2,
    height: 1,
    ...options,
  });

export const generator = (
  id: string,
  x: number,
  y: number,
  options: SceneAssetOptions = {},
): SceneAssetDefinition => asset(id, "generator", x, y, options);

export const powerNode = (
  id: string,
  x: number,
  y: number,
  options: SceneAssetOptions = {},
): SceneAssetDefinition => asset(id, "power_pole", x, y, options);

export const resource = (
  id: string,
  resourceType: ResourceType,
  x: number,
  y: number,
  options: Omit<SceneResourceDefinition, "id" | "resourceType" | "x" | "y"> =
    {},
): SceneResourceDefinition => ({ id, resourceType, x, y, ...options });

export const floorRect = (
  id: string,
  tileType: Extract<FloorTileType, "stone_floor">,
  x: number,
  y: number,
  width = 1,
  height = 1,
): SceneFloorTileDefinition => ({ id, tileType, x, y, width, height });

export const stoneFloorRect = (
  id: string,
  x: number,
  y: number,
  width = 1,
  height = 1,
): SceneFloorTileDefinition =>
  floorRect(id, "stone_floor", x, y, width, height);