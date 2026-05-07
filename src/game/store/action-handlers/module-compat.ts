import { MODULE_COMPATIBLE_BUILDINGS } from "../../constants/moduleLabConstants";
import type { ModuleType } from "../../modules/module.types";
import type { AssetType, GameState } from "../types";

export function isModuleCompatibleWithAsset(
  moduleType: ModuleType,
  assetType: AssetType,
): boolean {
  return MODULE_COMPATIBLE_BUILDINGS[moduleType].includes(assetType);
}

export function clearModulesEquippedToAny(
  state: GameState,
  removedAssetIds: readonly string[],
): GameState {
  const inventory = state.moduleInventory;
  if (inventory.length === 0) return state;

  const removedAssetIdSet = new Set(removedAssetIds);
  let changed = false;
  const moduleInventory = inventory.map((module) => {
    if (module.equippedTo && removedAssetIdSet.has(module.equippedTo)) {
      changed = true;
      return { ...module, equippedTo: null };
    }
    return module;
  });

  return changed ? { ...state, moduleInventory } : state;
}
