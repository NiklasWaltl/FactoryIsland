import type { GameState, Direction, PlacedAsset, SmithyState } from "../types";
import type {
  ConveyorItem,
  ConveyorNoTargetReason,
  ConveyorState,
  ConveyorTargetBlockReason,
  ConveyorTargetDecision,
  ConveyorTargetEligibility,
  ConveyorTargetEligibilityCheck,
  ConveyorTargetType,
} from "../types/conveyor-types";
import {
  getConveyorMergerInputCell,
  getConveyorMergerInputSide,
  isValidConveyorSplitterInput,
} from "./conveyor-geometry";
import { decideConveyorTickEligibility } from "./conveyor-eligibility";
import type { ConveyorRoutingIndex } from "./conveyor-index";

type SimpleConveyorTargetType = Exclude<
  ConveyorTargetType,
  "smithy" | "next_conveyor" | "workbench"
>;
type BlockableConveyorTargetType = Exclude<ConveyorTargetType, "next_conveyor">;

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

export function noConveyorTarget(
  blockReason: ConveyorNoTargetReason,
): ConveyorTargetDecision {
  return { kind: "no_target", blockReason };
}

export function targetNextConveyor(targetId: string): ConveyorTargetDecision {
  return {
    kind: "target",
    targetType: "next_conveyor",
    targetId,
    nextAssetId: targetId,
  };
}

export function blockedNextConveyor(
  targetId: string,
  blockReason: ConveyorTargetBlockReason,
): ConveyorTargetDecision {
  return {
    kind: "blocked",
    targetType: "next_conveyor",
    targetId,
    nextAssetId: targetId,
    blockReason,
  };
}

export function targetConveyorDestination(
  targetType: SimpleConveyorTargetType,
  targetId: string,
): ConveyorTargetDecision {
  return { kind: "target", targetType, targetId };
}

export function blockedConveyorDestination(
  targetType: BlockableConveyorTargetType,
  targetId: string,
  blockReason: ConveyorTargetBlockReason,
): ConveyorTargetDecision {
  return { kind: "blocked", targetType, targetId, blockReason };
}

export function isForwardConveyorTargetCompatible(
  fromAsset: PlacedAsset,
  nextAsset: PlacedAsset | null,
  direction: Direction,
): boolean {
  return (
    nextAsset?.status !== "deconstructing" &&
    (nextAsset?.type === "conveyor_corner" ||
      (nextAsset?.type === "conveyor" &&
        (nextAsset.direction ?? "east") === direction) ||
      (nextAsset?.type === "conveyor_underground_in" &&
        (nextAsset.direction ?? "east") === direction) ||
      (nextAsset?.type === "conveyor_merger" &&
        getConveyorMergerInputSide(fromAsset, nextAsset) !== null) ||
      (nextAsset?.type === "conveyor_splitter" &&
        isValidConveyorSplitterInput(fromAsset, nextAsset)))
  );
}

export function shouldDeferRightMergerInputToLeft(input: {
  convId: string;
  conveyorAsset: PlacedAsset;
  targetMergerId: string;
  assets: Record<string, PlacedAsset>;
  cellMap: GameState["cellMap"];
  connectedSet: ReadonlySet<string>;
  poweredSet: ReadonlySet<string>;
  movedThisTick: ReadonlySet<string>;
  conveyors: Record<string, ConveyorState>;
  decideRoutingFor: (
    convId: string,
    conveyorAsset: PlacedAsset,
    currentItem: ConveyorItem,
  ) => ConveyorTargetDecision;
}): boolean {
  const {
    convId,
    conveyorAsset,
    targetMergerId,
    assets,
    cellMap,
    connectedSet,
    poweredSet,
    movedThisTick,
    conveyors,
    decideRoutingFor,
  } = input;

  const mergerAsset = assets[targetMergerId];
  if (
    !mergerAsset ||
    mergerAsset.type !== "conveyor_merger" ||
    mergerAsset.status === "deconstructing"
  )
    return false;
  if (getConveyorMergerInputSide(conveyorAsset, mergerAsset) !== "right")
    return false;

  const leftInputCell = getConveyorMergerInputCell(mergerAsset, "left");
  const leftInputId =
    cellMap[cellKey(leftInputCell.x, leftInputCell.y)] ?? null;
  if (!leftInputId || leftInputId === convId) return false;

  const leftAsset = assets[leftInputId];
  if (!leftAsset) return false;
  if (leftAsset.status === "deconstructing") return false;

  const leftQueue = conveyors[leftInputId]?.queue ?? [];
  const leftItem = leftQueue[0] ?? null;
  if (!leftItem) return false;

  const leftPreflight = decideConveyorTickEligibility({
    conveyorId: leftInputId,
    movedThisTick,
    assets,
    connectedSet,
    poweredSet,
  });
  if (leftPreflight.kind === "blocked") return false;

  const leftRoutingDecision = decideRoutingFor(
    leftInputId,
    leftPreflight.conveyorAsset,
    leftItem,
  );

  return (
    leftRoutingDecision.kind === "target" &&
    leftRoutingDecision.targetType === "next_conveyor" &&
    leftRoutingDecision.nextAssetId === targetMergerId
  );
}

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

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

export function assetHeight(
  asset: Pick<PlacedAsset, "height" | "size">,
): number {
  return asset.height ?? asset.size;
}

export function isWarehouseStorageAsset(
  asset: PlacedAsset | null | undefined,
): boolean {
  return (
    !!asset && (asset.type === "warehouse" || asset.isDockWarehouse === true)
  );
}
