import type { Module } from "../modules/module.types";
import { MODULE_EFFECTS } from "../constants/moduleLabConstants";

export const AUTO_MINER_BASE_OUTPUT = 1;

export function getMinerYieldMultiplier(equippedModule: Module | null): number {
  if (!equippedModule || equippedModule.type !== "miner-boost") return 1.0;
  return MODULE_EFFECTS["miner-boost"][equippedModule.tier].yieldMultiplier;
}

export function getAutoMinerOutputAmount(
  equippedModule: Module | null,
): number {
  return Math.floor(AUTO_MINER_BASE_OUTPUT * getMinerYieldMultiplier(equippedModule));
}