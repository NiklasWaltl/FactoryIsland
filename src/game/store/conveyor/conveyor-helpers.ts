import type { SmithyState } from "../types";
import type {
  ConveyorTargetEligibility,
  ConveyorTargetEligibilityCheck,
} from "../types/conveyor-types";
import type { ConveyorRoutingIndex } from "./conveyor-index";

export const classifyConveyorTargetEligibility = (
  checks: ReadonlyArray<ConveyorTargetEligibilityCheck>,
): ConveyorTargetEligibility => {
  for (const check of checks) {
    if (!check.condition) {
      return { eligible: false, blockReason: check.blockReason };
    }
  }
  return { eligible: true };
};

export function isConveyorZoneCompatible(
  routingIndex: ConveyorRoutingIndex,
  fromZone: string | null,
  toZone: string | null,
): boolean {
  if (!fromZone || !toZone) return true;
  return routingIndex.zoneCompatLookup.get(fromZone)?.has(toZone) ?? false;
}

export function getSmithyOreAmount(
  smithy: SmithyState,
  oreKey: "iron" | "copper",
): number {
  return oreKey === "iron" ? smithy.iron : smithy.copper;
}
