import type { PlacedAsset } from "../../store/types";
import { GRID_H, GRID_W } from "../../constants/grid";
import { sanitizeTileMap } from "../../world/tile-map-utils";
import { normalizeModuleFragmentCount } from "../../store/helpers/module-fragments";
import { normalizeShipState } from "./helpers";
import type {
  SaveGameV20,
  SaveGameV21,
  SaveGameV22,
  SaveGameV23,
  SaveGameV24,
  SaveGameV25,
  SaveGameV26,
  SaveGameV27,
  SaveGameV28,
  SaveGameV29,
  SaveGameV30,
} from "./types";

export function migrateV20ToV21(save: SaveGameV20): SaveGameV21 {
  const existingTileMap = (save as Partial<Pick<SaveGameV21, "tileMap">>)
    .tileMap;
  return {
    ...save,
    version: 21,
    tileMap: sanitizeTileMap(existingTileMap, GRID_H, GRID_W),
  };
}

export function migrateV21ToV22(save: SaveGameV21): SaveGameV22 {
  const existingShip = (save as unknown as Partial<SaveGameV22>).ship;
  const ship = normalizeShipState(existingShip);
  return { ...save, version: 22, ship };
}

export function migrateV22ToV23(save: SaveGameV22): SaveGameV23 {
  const moduleInventory = Array.isArray(
    (save as unknown as Partial<SaveGameV23>).moduleInventory,
  )
    ? (save as unknown as Partial<SaveGameV23>).moduleInventory!
    : [];
  return { ...save, version: 23, moduleInventory };
}

export function migrateV23ToV24(save: SaveGameV23): SaveGameV24 {
  const moduleFragments = normalizeModuleFragmentCount(
    (save as unknown as Partial<SaveGameV24>).moduleFragments,
  );
  return { ...save, version: 24, moduleFragments };
}

export function migrateV24ToV25(save: SaveGameV24): SaveGameV25 {
  const moduleFragments = normalizeModuleFragmentCount(save.moduleFragments);
  return { ...save, version: 25, moduleFragments };
}

export function migrateV25ToV26(save: SaveGameV25): SaveGameV26 {
  return { ...save, version: 26, moduleLabJob: null };
}

export function migrateV26ToV27(save: SaveGameV26): SaveGameV27 {
  return { ...save, version: 27, ship: normalizeShipState(save.ship) };
}

export function migrateV27ToV28(save: SaveGameV27): SaveGameV28 {
  const assets: Record<string, PlacedAsset> = {};
  for (const [id, asset] of Object.entries(save.assets ?? {})) {
    assets[id] = { ...asset, moduleSlot: asset.moduleSlot ?? null };
  }

  return { ...save, version: 28, assets };
}

export function migrateV28ToV29(save: SaveGameV28): SaveGameV29 {
  return {
    ...save,
    version: 29,
    ship: normalizeShipState((save as Partial<SaveGameV28>).ship),
  };
}

export function migrateV29ToV30(save: SaveGameV29): SaveGameV30 {
  const state = { ...save, version: 30 } as Omit<SaveGameV29, "version"> & {
    version: 30;
  };
  if (state.starterDrone !== undefined) {
    delete (state as any).starterDrone;
  }
  return state as SaveGameV30;
}
