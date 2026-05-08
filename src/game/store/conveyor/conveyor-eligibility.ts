import type { PlacedAsset } from "../types";

export type ConveyorTickEligibilityDecision =
  | { kind: "blocked" }
  | { kind: "ready"; conveyorAsset: PlacedAsset };

export const decideConveyorTickEligibility = (input: {
  conveyorId: string;
  assets: Record<string, PlacedAsset>;
  connectedSet: ReadonlySet<string>;
  poweredSet: ReadonlySet<string>;
  movedThisTick: ReadonlySet<string>;
}): ConveyorTickEligibilityDecision => {
  const { conveyorId, assets, connectedSet, poweredSet, movedThisTick } = input;

  if (movedThisTick.has(conveyorId)) return { kind: "blocked" };

  const conveyorAsset = assets[conveyorId];
  if (!conveyorAsset) return { kind: "blocked" };
  if (conveyorAsset.status === "deconstructing") return { kind: "blocked" };

  const isConnected = connectedSet.has(conveyorId);
  const isPowered = poweredSet.has(conveyorId);
  if (!isConnected || !isPowered) return { kind: "blocked" };

  return { kind: "ready", conveyorAsset };
};
