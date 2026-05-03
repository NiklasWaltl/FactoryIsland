import type { Module, ModuleType } from "../../modules/module.types";
import type { GameState } from "../types";

export const selectModules = (state: GameState): Module[] =>
  state.moduleInventory;

export const selectModuleCount = (state: GameState): number =>
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
