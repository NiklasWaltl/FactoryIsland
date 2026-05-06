import type {
  SceneAssetDefinition,
  SceneDefinition,
  SceneResourceDefinition,
} from "../scene-types";
import {
  getSceneAssetDimensions,
  getSceneResourceDimensions,
} from "./place-asset";
import type { AssetType } from "../../store/types";

const DIRECTIONAL_TYPES = new Set<AssetType>([
  "auto_miner",
  "auto_smelter",
  "auto_assembler",
  "conveyor",
  "conveyor_corner",
  "conveyor_merger",
  "conveyor_splitter",
  "conveyor_underground_in",
  "conveyor_underground_out",
]);

const UNDERGROUND_TYPES = new Set<AssetType>([
  "conveyor_underground_in",
  "conveyor_underground_out",
]);

export const validateScene = (scene: SceneDefinition): void => {
  const ids = new Set<string>();
  for (const resourceDefinition of scene.resources ?? []) {
    assertUniqueId(ids, resourceDefinition.id);
  }
  for (const assetDefinition of scene.assets) {
    assertUniqueId(ids, assetDefinition.id);
    assertDirection(assetDefinition);
  }

  assertNoSceneAssetOverlap(scene.assets);
  assertNoResourceOverlap(scene.resources ?? []);
  assertUndergroundPeers(scene.assets);
};

const assertUniqueId = (ids: Set<string>, id: string): void => {
  if (ids.has(id)) {
    throw new Error(`Scene contains duplicate object id '${id}'.`);
  }
  ids.add(id);
};

const assertDirection = (definition: SceneAssetDefinition): void => {
  if (DIRECTIONAL_TYPES.has(definition.type) && !definition.direction) {
    throw new Error(
      `Scene asset '${definition.id}' of type '${definition.type}' requires a direction.`,
    );
  }
};

const assertNoSceneAssetOverlap = (
  definitions: readonly SceneAssetDefinition[],
): void => {
  const cells = new Map<string, string>();
  for (const definition of definitions) {
    const dimensions = getSceneAssetDimensions(definition);
    for (let dx = 0; dx < dimensions.width; dx += 1) {
      for (let dy = 0; dy < dimensions.height; dy += 1) {
        const key = `${definition.x + dx},${definition.y + dy}`;
        const occupiedBy = cells.get(key);
        if (occupiedBy) {
          throw new Error(
            `Scene asset '${definition.id}' overlaps '${occupiedBy}' at ${key}.`,
          );
        }
        cells.set(key, definition.id);
      }
    }
  }
};

const assertNoResourceOverlap = (
  definitions: readonly SceneResourceDefinition[],
): void => {
  const cells = new Map<string, string>();
  for (const definition of definitions) {
    const dimensions = getSceneResourceDimensions(definition);
    for (let dx = 0; dx < dimensions.width; dx += 1) {
      for (let dy = 0; dy < dimensions.height; dy += 1) {
        const key = `${definition.x + dx},${definition.y + dy}`;
        const occupiedBy = cells.get(key);
        if (occupiedBy) {
          throw new Error(
            `Scene resource '${definition.id}' overlaps '${occupiedBy}' at ${key}.`,
          );
        }
        cells.set(key, definition.id);
      }
    }
  }
};

const assertUndergroundPeers = (
  definitions: readonly SceneAssetDefinition[],
): void => {
  const byId = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  for (const definition of definitions) {
    if (!UNDERGROUND_TYPES.has(definition.type)) continue;
    if (!definition.peerId) {
      throw new Error(
        `Scene underground asset '${definition.id}' requires peerId.`,
      );
    }

    const peer = byId.get(definition.peerId);
    if (!peer || !UNDERGROUND_TYPES.has(peer.type)) {
      throw new Error(
        `Scene underground asset '${definition.id}' references missing peer '${definition.peerId}'.`,
      );
    }
    if (peer.peerId !== definition.id) {
      throw new Error(
        `Scene underground asset '${definition.id}' and '${peer.id}' must reference each other.`,
      );
    }
  }
};
