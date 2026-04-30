import { directionOffset } from "../utils/direction";
import type { PlacedAsset } from "../types";

export type ConveyorMergerInputSide = "left" | "right";

export function getConveyorMergerInputCell(
  mergerAsset: Pick<PlacedAsset, "x" | "y" | "direction">,
  side: ConveyorMergerInputSide,
): { x: number; y: number } {
  const [dx, dy] = directionOffset(mergerAsset.direction ?? "east");
  const sideOffset = side === "left"
    ? { x: dy, y: -dx }
    : { x: -dy, y: dx };
  return {
    x: mergerAsset.x + sideOffset.x,
    y: mergerAsset.y + sideOffset.y,
  };
}

export function getConveyorMergerInputSide(
  sourceAsset: Pick<PlacedAsset, "x" | "y">,
  mergerAsset: Pick<PlacedAsset, "x" | "y" | "direction">,
): ConveyorMergerInputSide | null {
  const left = getConveyorMergerInputCell(mergerAsset, "left");
  if (sourceAsset.x === left.x && sourceAsset.y === left.y) return "left";

  const right = getConveyorMergerInputCell(mergerAsset, "right");
  if (sourceAsset.x === right.x && sourceAsset.y === right.y) return "right";

  return null;
}

/**
 * V1 splitter lateral output cells use the same left/right grid offsets as
 * merger input cells — thin alias so prompts and search land on splitter wording.
 */
export function getConveyorSplitterOutputCell(
  splitter: Pick<PlacedAsset, "x" | "y" | "direction">,
  side: ConveyorMergerInputSide,
): { x: number; y: number } {
  return getConveyorMergerInputCell(splitter, side);
}

/**
 * conveyor_splitter V1: items leave via the lateral arms only, in this order.
 * Must not depend on `Object.entries` iteration over conveyors.
 */
export const SPLITTER_OUTPUT_SIDE_PRIORITY: readonly ConveyorMergerInputSide[] = [
  "left",
  "right",
];

export function getConveyorSplitterBackCell(
  splitter: Pick<PlacedAsset, "x" | "y" | "direction">,
): { x: number; y: number } {
  const [dx, dy] = directionOffset(splitter.direction ?? "east");
  return { x: splitter.x - dx, y: splitter.y - dy };
}

/** True when the source feeds the splitter only from its back cell (not lateral). */
export function isValidConveyorSplitterInput(
  sourceAsset: Pick<PlacedAsset, "x" | "y" | "direction" | "type">,
  splitter: Pick<PlacedAsset, "x" | "y" | "direction">,
): boolean {
  if (
    sourceAsset.type !== "conveyor" &&
    sourceAsset.type !== "conveyor_corner" &&
    sourceAsset.type !== "conveyor_merger" &&
    sourceAsset.type !== "conveyor_underground_in"
  ) {
    return false;
  }
  const back = getConveyorSplitterBackCell(splitter);
  if (sourceAsset.x !== back.x || sourceAsset.y !== back.y) return false;
  const [ox, oy] = directionOffset(sourceAsset.direction ?? "east");
  return sourceAsset.x + ox === splitter.x && sourceAsset.y + oy === splitter.y;
}

/** Lateral neighbor can accept an item pushed from the splitter this tick. */
export function canAssetReceiveFromConveyorSplitterOutput(
  splitter: Pick<PlacedAsset, "x" | "y" | "direction">,
  neighbor: PlacedAsset,
): boolean {
  if (
    neighbor.type !== "conveyor" &&
    neighbor.type !== "conveyor_corner" &&
    neighbor.type !== "conveyor_merger" &&
    neighbor.type !== "conveyor_underground_in"
  ) {
    return false;
  }
  if (neighbor.type === "conveyor_merger") {
    return getConveyorMergerInputSide({ x: splitter.x, y: splitter.y }, neighbor) !== null;
  }
  const nd = neighbor.direction ?? "east";
  const [nox, noy] = directionOffset(nd);
  return neighbor.x - nox === splitter.x && neighbor.y - noy === splitter.y;
}
