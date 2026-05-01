// Power/energy helper functions, extracted from reducer.ts.
// No logic changes - moved verbatim.

import { getConnectedConsumerDrainEntries } from "../../power/energy-consumers";
import {
  POWER_CABLE_CONDUCTOR_TYPES,
  POWER_POLE_RANGE_TYPES,
} from "../constants/energy/energy-balance";
import type { AssetType, GameState } from "../types";

export function isPowerCableConductorType(type: AssetType): boolean {
  return POWER_CABLE_CONDUCTOR_TYPES.has(type);
}

export function isPowerPoleRangeType(type: AssetType): boolean {
  return POWER_POLE_RANGE_TYPES.has(type);
}

export function getConnectedDemandPerPeriod(
  state: Pick<
    GameState,
    "assets" | "connectedAssetIds" | "autoSmelters" | "autoAssemblers"
  >,
): number {
  return getConnectedConsumerDrainEntries(state).reduce(
    (sum, entry) => sum + entry.drain,
    0,
  );
}
