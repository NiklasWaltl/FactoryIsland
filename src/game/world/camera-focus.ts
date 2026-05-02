import { CELL_PX } from "../constants/grid";
import { getStartAreaAnchor, isInsideCoreArea } from "./core-layout";
import type { TileCoord } from "./core-layout";
import type { TileType } from "./tile-types";

export interface CameraFocusPoint {
  readonly x: number;
  readonly y: number;
}

export function getInitialCameraFocusTile(tileMap: TileType[][]): TileCoord {
  const anchor = getStartAreaAnchor(tileMap);
  if (!isInsideCoreArea(anchor.row, anchor.col, tileMap)) {
    throw new Error(
      `Camera focus anchor resolved outside playable core at row ${anchor.row} col ${anchor.col}`,
    );
  }
  return anchor;
}

export function getInitialCameraFocusPoint(
  tileMap: TileType[][],
): CameraFocusPoint {
  const anchor = getInitialCameraFocusTile(tileMap);
  return {
    x: (anchor.col + 0.5) * CELL_PX,
    y: (anchor.row + 0.5) * CELL_PX,
  };
}