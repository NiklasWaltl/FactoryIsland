import type { Module } from "../modules/module.types";
import { MODULE_EFFECTS } from "../constants/moduleLabConstants";

export function getSmelterSpeedMultiplier(
  equippedModule: Module | null,
): number {
  if (!equippedModule || equippedModule.type !== "smelter-boost") return 1.0;
  return MODULE_EFFECTS["smelter-boost"][equippedModule.tier].speedMultiplier;
}

export function getAutoSmelterTickInterval(
  baseTicks: number,
  equippedModule: Module | null,
): number {
  return Math.max(
    1,
    Math.floor(baseTicks / getSmelterSpeedMultiplier(equippedModule)),
  );
}
