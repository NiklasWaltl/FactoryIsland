import type { ItemId } from "../items/types";
import type {
  AssetType,
  BuildingType,
  CollectableItemType,
  Direction,
  FloorTileType,
  GameMode,
  HubTier,
  Inventory,
} from "../store/types";

export type DevSceneId =
  | "debug"
  | "logistics"
  | "power"
  | "assembler"
  | "empty";

export const DEFAULT_DEV_SCENE: DevSceneId = "debug";

export const DEV_SCENE_IDS: readonly DevSceneId[] = [
  "debug",
  "logistics",
  "power",
  "assembler",
  "empty",
];

export const DEV_SCENE_OPTIONS: readonly DevSceneId[] = ["debug", "empty"];

export const isDevSceneId = (value: string): value is DevSceneId =>
  (DEV_SCENE_IDS as readonly string[]).includes(value);

export type ResourceType = Extract<
  AssetType,
  | "tree"
  | "stone"
  | "iron"
  | "copper"
  | "sapling"
  | "stone_deposit"
  | "iron_deposit"
  | "copper_deposit"
>;

export interface SceneItemStack {
  readonly itemId: ItemId;
  readonly count: number;
}

export interface SceneResourceDefinition {
  readonly id: string;
  readonly resourceType: ResourceType;
  readonly x: number;
  readonly y: number;
  readonly fixed?: boolean;
  readonly size?: 1 | 2;
}

export interface SceneAssetDefinition {
  readonly id: string;
  readonly type: AssetType;
  readonly x: number;
  readonly y: number;
  readonly direction?: Direction;
  readonly fixed?: boolean;
  readonly size?: 1 | 2;
  readonly width?: 1 | 2;
  readonly height?: 1 | 2;
  readonly inventory?: readonly SceneItemStack[];
  readonly recipeId?: string;
  readonly powered?: boolean;
  readonly fuel?: number;
  readonly running?: boolean;
  readonly resourceId?: string;
  readonly peerId?: string;
  readonly hubTier?: HubTier;
  readonly droneIds?: readonly string[];
  readonly targetStock?: Record<CollectableItemType, number>;
}

export interface SceneFloorTileDefinition {
  readonly id: string;
  readonly tileType: Extract<FloorTileType, "stone_floor">;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
}

export interface SceneStarterDroneDefinition {
  readonly hubId: string;
  readonly tileX?: number;
  readonly tileY?: number;
}

export interface SceneDefinition {
  readonly id: DevSceneId;
  readonly label: string;
  readonly mode?: GameMode;
  readonly resetGlobalInventory?: boolean;
  readonly globalInventory?: Partial<Inventory>;
  readonly purchasedBuildings?: readonly BuildingType[];
  readonly placedBuildings?: readonly BuildingType[];
  readonly starterDrone?: SceneStarterDroneDefinition;
  readonly resources?: readonly SceneResourceDefinition[];
  readonly assets: readonly SceneAssetDefinition[];
  readonly floorTiles?: readonly SceneFloorTileDefinition[];
}