import type { Module, ModuleType } from "../../modules/module.types";
import { MODULE_COMPATIBLE_BUILDINGS } from "../../constants/moduleLabConstants";
import type { GameState, PlacedAsset } from "../types";

const selectModules = (state: GameState): Module[] => state.moduleInventory;

const selectModuleCount = (state: GameState): number =>
  selectModules(state).length;

export const selectModuleFragmentCount = (state: GameState): number =>
  state.moduleFragments;

export function getEquippedModule(
  state: GameState,
  assetId: string,
): Module | null {
  const slotId = state.assets[assetId]?.moduleSlot;
  if (!slotId) return null;
  return state.moduleInventory.find((module) => module.id === slotId) ?? null;
}

export function getFreeModulesForType(
  state: GameState,
  moduleType: ModuleType,
): Module[] {
  return state.moduleInventory.filter(
    (module) => module.type === moduleType && module.equippedTo === null,
  );
}

export function getCompatibleAssetsForModule(
  state: GameState,
  moduleType: ModuleType,
): PlacedAsset[] {
  const compatibleTypes = MODULE_COMPATIBLE_BUILDINGS[moduleType];
  return Object.values(state.assets).filter(
    (asset) =>
      compatibleTypes.includes(asset.type) &&
      !asset.moduleSlot &&
      asset.status !== "deconstructing",
  );
}
