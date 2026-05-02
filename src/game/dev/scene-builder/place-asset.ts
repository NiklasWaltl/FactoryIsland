import { GRID_H, GRID_W } from "../../constants/grid";
import type {
  ResourceType,
  SceneAssetDefinition,
  SceneResourceDefinition,
} from "../scene-types";
import { BUILDING_SIZES } from "../../store/constants/buildings";
import { withDefaultMachinePriority } from "../../store/helpers/machine-priority";
import type {
  AssetType,
  BuildingType,
  GameState,
  PlacedAsset,
} from "../../store/types";
import { DEPOSIT_TYPES } from "../../world/fixed-resource-layout";

interface PlacementContext {
  readonly assets: Record<string, PlacedAsset>;
  readonly cellMap: GameState["cellMap"];
}

export interface SceneAssetDimensions {
  readonly size: 1 | 2;
  readonly width: 1 | 2;
  readonly height: 1 | 2;
}

const RESOURCE_ASSET_TYPES = new Set<AssetType>([
  "tree",
  "stone",
  "iron",
  "copper",
  "sapling",
  "stone_deposit",
  "iron_deposit",
  "copper_deposit",
]);

const SPECIAL_TWO_BY_TWO_TYPES = new Set<AssetType>([
  "map_shop",
  "stone_deposit",
  "iron_deposit",
  "copper_deposit",
]);

const isBuildingType = (type: AssetType): type is BuildingType =>
  type in BUILDING_SIZES;

export const isDepositResourceType = (resourceType: ResourceType): boolean =>
  DEPOSIT_TYPES.has(resourceType);

export const getSceneAssetDimensions = (
  definition: Pick<SceneAssetDefinition, "type" | "size" | "width" | "height">,
): SceneAssetDimensions => {
  const defaultSize = getDefaultSceneAssetSize(definition.type);
  const size = definition.size ?? defaultSize;
  return {
    size,
    width:
      definition.width ??
      (definition.type === "auto_smelter" ||
      definition.type === "auto_assembler"
        ? 2
        : size),
    height:
      definition.height ??
      (definition.type === "auto_smelter" ||
      definition.type === "auto_assembler"
        ? 1
        : size),
  };
};

export const getSceneResourceDimensions = (
  definition: Pick<SceneResourceDefinition, "resourceType" | "size">,
): SceneAssetDimensions => {
  const size =
    definition.size ?? (isDepositResourceType(definition.resourceType) ? 2 : 1);
  return { size, width: size, height: size };
};

export const placeSceneResource = (
  context: PlacementContext,
  definition: SceneResourceDefinition,
): PlacementContext => {
  const dimensions = getSceneResourceDimensions(definition);
  assertWithinGrid(definition.id, definition.x, definition.y, dimensions);

  const asset: PlacedAsset = {
    id: definition.id,
    type: definition.resourceType,
    x: definition.x,
    y: definition.y,
    size: dimensions.size,
    width: dimensions.width,
    height: dimensions.height,
    fixed: definition.fixed ?? isDepositResourceType(definition.resourceType),
  };

  const assets = { ...context.assets, [definition.id]: asset };
  const cellMap = { ...context.cellMap };
  assertCellsFree(
    { assets: context.assets, cellMap: context.cellMap },
    asset,
    dimensions,
    false,
  );

  forEachCell(asset.x, asset.y, dimensions, (x, y) => {
    cellMap[`${x},${y}`] = asset.id;
  });

  return { assets, cellMap };
};

export const placeSceneAsset = (
  context: PlacementContext,
  definition: SceneAssetDefinition,
): PlacementContext => {
  const dimensions = getSceneAssetDimensions(definition);
  assertWithinGrid(definition.id, definition.x, definition.y, dimensions);

  const asset: PlacedAsset = {
    id: definition.id,
    type: definition.type,
    x: definition.x,
    y: definition.y,
    size: dimensions.size,
    width: dimensions.width,
    height: dimensions.height,
    direction: definition.direction,
    fixed: definition.fixed,
    ...withDefaultMachinePriority(definition.type),
  };

  const assets = { ...context.assets, [definition.id]: asset };
  const cellMap = { ...context.cellMap };
  assertCellsFree(
    { assets: context.assets, cellMap: context.cellMap },
    asset,
    dimensions,
    true,
    definition,
  );

  forEachCell(asset.x, asset.y, dimensions, (x, y) => {
    cellMap[`${x},${y}`] = asset.id;
  });

  return { assets, cellMap };
};

const getDefaultSceneAssetSize = (type: AssetType): 1 | 2 => {
  if (isBuildingType(type)) return BUILDING_SIZES[type];
  if (SPECIAL_TWO_BY_TWO_TYPES.has(type)) return 2;
  return 1;
};

const assertWithinGrid = (
  id: string,
  x: number,
  y: number,
  dimensions: SceneAssetDimensions,
): void => {
  if (
    x < 0 ||
    y < 0 ||
    x + dimensions.width > GRID_W ||
    y + dimensions.height > GRID_H
  ) {
    throw new Error(
      `Scene object '${id}' is outside the ${GRID_W}x${GRID_H} grid.`,
    );
  }
};

const assertCellsFree = (
  context: PlacementContext,
  asset: PlacedAsset,
  dimensions: SceneAssetDimensions,
  allowAutoMinerDepositOverlay: boolean,
  definition?: SceneAssetDefinition,
): void => {
  forEachCell(asset.x, asset.y, dimensions, (x, y) => {
    const occupiedBy = context.cellMap[`${x},${y}`];
    if (!occupiedBy) return;

    const existingAsset = context.assets[occupiedBy];
    if (
      allowAutoMinerDepositOverlay &&
      definition?.type === "auto_miner" &&
      definition.resourceId === occupiedBy &&
      existingAsset &&
      DEPOSIT_TYPES.has(existingAsset.type)
    ) {
      return;
    }

    throw new Error(
      `Scene object '${asset.id}' overlaps '${occupiedBy}' at ${x},${y}.`,
    );
  });
};

const forEachCell = (
  x: number,
  y: number,
  dimensions: SceneAssetDimensions,
  visit: (x: number, y: number) => void,
): void => {
  for (let dx = 0; dx < dimensions.width; dx += 1) {
    for (let dy = 0; dy < dimensions.height; dy += 1) {
      visit(x + dx, y + dy);
    }
  }
};

export const isResourceAssetType = (type: AssetType): boolean =>
  RESOURCE_ASSET_TYPES.has(type);
